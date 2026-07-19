import { describe, expect, it, vi } from "vitest";

import { createLatestWriteCoalescer } from "./latest-write-coalescer";

function deferred<Result>() {
  let resolve: (value: Result) => void = () => undefined;
  const promise = new Promise<Result>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe("latest write coalescer", () => {
  it("runs the first and latest observations while collapsing intermediates", async () => {
    const first = deferred<string>();
    const latest = deferred<string>();
    const firstWrite = vi.fn(() => first.promise);
    const middleWrite = vi.fn(async () => "middle");
    const latestWrite = vi.fn(() => latest.promise);
    const coalescer = createLatestWriteCoalescer<string>();

    const firstResult = coalescer.run("user:movie", new Date(1_000), firstWrite);
    const middleResult = coalescer.run("user:movie", new Date(2_000), middleWrite);
    const latestResult = coalescer.run("user:movie", new Date(3_000), latestWrite);
    first.resolve("first");
    await expect(firstResult).resolves.toBe("first");
    expect(middleWrite).not.toHaveBeenCalled();
    expect(latestWrite).toHaveBeenCalledOnce();
    latest.resolve("latest");
    await expect(Promise.all([middleResult, latestResult])).resolves.toEqual(["latest", "latest"]);
  });

  it("joins older duplicate observations to the active write", async () => {
    const active = deferred<string>();
    const activeWrite = vi.fn(() => active.promise);
    const duplicateWrite = vi.fn(async () => "duplicate");
    const coalescer = createLatestWriteCoalescer<string>();

    const firstResult = coalescer.run("user:movie", new Date(2_000), activeWrite);
    const duplicateResult = coalescer.run("user:movie", new Date(1_000), duplicateWrite);
    active.resolve("active");

    await expect(Promise.all([firstResult, duplicateResult])).resolves.toEqual([
      "active",
      "active",
    ]);
    expect(duplicateWrite).not.toHaveBeenCalled();
  });

  it("runs independently by key and falls back to direct writes at capacity", async () => {
    const active = deferred<string>();
    const coalescer = createLatestWriteCoalescer<string>(1);
    const first = coalescer.run("first", new Date(1_000), () => active.promise);

    await expect(coalescer.run("second", new Date(1_000), async () => "direct")).resolves.toBe(
      "direct",
    );
    active.resolve("first");
    await expect(first).resolves.toBe("first");
  });

  it("rejects every queued caller when the latest write fails", async () => {
    const first = deferred<string>();
    const coalescer = createLatestWriteCoalescer<string>();
    const firstResult = coalescer.run("user:movie", new Date(1_000), () => first.promise);
    const queued = coalescer.run("user:movie", new Date(2_000), async () => {
      throw new Error("write failed");
    });
    first.resolve("first");

    await expect(firstResult).resolves.toBe("first");
    await expect(queued).rejects.toThrow("write failed");
  });
});
