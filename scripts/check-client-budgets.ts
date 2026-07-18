import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { chromium } from "@playwright/test";

const maximumJavaScriptBytes = 180 * 1024;
const maximumCssBytes = 60 * 1024;
const port = 3201;
const origin = `http://127.0.0.1:${port}`;
const routes = ["/", "/filmler", "/arama?q=Nehir%20Ekin", "/film/kiyidaki-sessizlik"];

async function waitForServer(server: ChildProcess): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Production server exited with code ${server.exitCode}`);
    }

    try {
      const response = await fetch(origin);
      if (response.ok) {
        return;
      }
    } catch {
      // The server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Production server did not become ready before the budget check deadline");
}

function gzipAsset(pathname: string): number {
  if (!pathname.startsWith("/_next/static/")) {
    return 0;
  }

  const nextRoot = path.resolve(".next");
  const assetPath = path.resolve(nextRoot, pathname.slice("/_next/".length));
  if (!assetPath.startsWith(`${nextRoot}${path.sep}`) || !existsSync(assetPath)) {
    throw new Error("Browser requested an unexpected build asset");
  }

  return gzipSync(readFileSync(assetPath)).length;
}

async function checkBudgets(): Promise<void> {
  if (process.env.DATABASE_URL === undefined) {
    throw new Error("DATABASE_URL is required to run the production budget check");
  }

  const server = spawn(
    process.execPath,
    [
      path.resolve("node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let serverErrorOutput = "";
  server.stderr.on("data", (chunk: Buffer) => {
    serverErrorOutput += chunk.toString().slice(0, 2_000);
  });

  try {
    await waitForServer(server);
    const browser = await chromium.launch({ headless: true });

    try {
      for (const route of routes) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const assets = new Set<string>();
        page.on("response", (response) => {
          const type = response.request().resourceType();
          if (type === "script" || type === "stylesheet") {
            assets.add(new URL(response.url()).pathname);
          }
        });

        await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
        let javascriptBytes = 0;
        let cssBytes = 0;

        for (const asset of assets) {
          const gzipBytes = gzipAsset(asset);
          if (asset.endsWith(".js")) {
            javascriptBytes += gzipBytes;
          } else if (asset.endsWith(".css")) {
            cssBytes += gzipBytes;
          }
        }

        process.stdout.write(
          `${route}: JS ${(javascriptBytes / 1024).toFixed(1)} KB gzip, CSS ${(cssBytes / 1024).toFixed(1)} KB gzip\n`,
        );

        if (javascriptBytes > maximumJavaScriptBytes) {
          throw new Error(`${route} exceeds the 180 KB JavaScript budget`);
        }
        if (cssBytes > maximumCssBytes) {
          throw new Error(`${route} exceeds the 60 KB CSS budget`);
        }

        await context.close();
      }
    } finally {
      await browser.close();
    }
  } catch (error: unknown) {
    if (serverErrorOutput.length > 0) {
      process.stderr.write(serverErrorOutput);
    }
    throw error;
  } finally {
    server.kill();
  }
}

void checkBudgets().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown budget-check failure";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
