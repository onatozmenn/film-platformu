import "server-only";

import { getServerEnvironment } from "@/shared/config/server-environment";

import { redactLogContext } from "./redaction";

type LogLevel = "debug" | "error" | "info" | "warn";

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function write(level: LogLevel, event: string, context: Readonly<Record<string, unknown>>): void {
  const configuredLevel = getServerEnvironment().logLevel;

  if (priorities[level] < priorities[configuredLevel]) {
    return;
  }

  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...redactLogContext(context),
  });

  const stream = level === "error" ? process.stderr : process.stdout;
  stream.write(`${entry}\n`);
}

export const logger = {
  debug: (event: string, context: Readonly<Record<string, unknown>> = {}) =>
    write("debug", event, context),
  error: (event: string, context: Readonly<Record<string, unknown>> = {}) =>
    write("error", event, context),
  info: (event: string, context: Readonly<Record<string, unknown>> = {}) =>
    write("info", event, context),
  warn: (event: string, context: Readonly<Record<string, unknown>> = {}) =>
    write("warn", event, context),
};
