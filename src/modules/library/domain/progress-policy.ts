const maximumDurationSeconds = 12 * 60 * 60;
const maximumFutureObservationMilliseconds = 5 * 60 * 1_000;

export type ProgressValue = Readonly<{
  completed: boolean;
  durationSeconds: number;
  observedAt: Date;
  positionSeconds: number;
}>;

export type ProgressDecision =
  | Readonly<{ accepted: false; reason: "INVALID_OBSERVATION" | "INVALID_PROGRESS" }>
  | Readonly<{ accepted: true; value: ProgressValue }>;

export function durationsAreCompatible(previous: number, next: number): boolean {
  if (!Number.isFinite(previous) || !Number.isFinite(next) || previous <= 0 || next <= 0) {
    return false;
  }
  return Math.abs(previous - next) <= Math.max(5, previous * 0.02);
}

export function evaluateProgress(
  input: Readonly<{
    durationSeconds: number;
    now: Date;
    observedAt: Date;
    positionSeconds: number;
  }>,
): ProgressDecision {
  if (
    !Number.isFinite(input.durationSeconds) ||
    input.durationSeconds <= 0 ||
    input.durationSeconds > maximumDurationSeconds ||
    !Number.isFinite(input.positionSeconds)
  ) {
    return { accepted: false, reason: "INVALID_PROGRESS" };
  }
  const observedAt = input.observedAt.getTime();
  const now = input.now.getTime();
  if (
    !Number.isFinite(observedAt) ||
    !Number.isFinite(now) ||
    observedAt > now + maximumFutureObservationMilliseconds
  ) {
    return { accepted: false, reason: "INVALID_OBSERVATION" };
  }

  const positionSeconds = Math.min(Math.max(input.positionSeconds, 0), input.durationSeconds);
  const remainingSeconds = input.durationSeconds - positionSeconds;
  const completed =
    positionSeconds >= input.durationSeconds * 0.95 ||
    (input.durationSeconds >= 20 * 60 && remainingSeconds <= 120);

  return {
    accepted: true,
    value: {
      completed,
      durationSeconds: input.durationSeconds,
      observedAt: input.observedAt,
      positionSeconds,
    },
  };
}
