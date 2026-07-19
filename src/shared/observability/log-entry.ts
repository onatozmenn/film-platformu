import { redactLogContext } from "./redaction";

export type LogLevel = "debug" | "error" | "info" | "warn";

export function createLogEntry(
  input: Readonly<{
    context: Readonly<Record<string, unknown>>;
    event: string;
    level: LogLevel;
    releaseId: string;
    timestamp: Date;
  }>,
): Readonly<Record<string, unknown>> {
  return {
    ...redactLogContext(input.context),
    event: input.event,
    level: input.level,
    releaseId: input.releaseId,
    timestamp: input.timestamp.toISOString(),
  };
}
