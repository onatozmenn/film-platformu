import { z } from "zod";

import { durationsAreCompatible, evaluateProgress } from "../domain/progress-policy";

const maximumStoredEntries = 100;
const maximumStoredBytes = 64 * 1_024;
export const guestProgressStorageKey = "film-platform:guest-progress:v1";

const entrySchema = z
  .object({
    durationSeconds: z.number().finite().positive(),
    observedAt: z.iso.datetime(),
    positionSeconds: z.number().finite().nonnegative(),
  })
  .strict();

const storeSchema = z
  .object({
    entries: z.record(z.uuid(), entrySchema),
    version: z.literal(1),
  })
  .strict();

type StoragePort = Pick<Storage, "getItem" | "setItem">;
type GuestProgressEntry = z.infer<typeof entrySchema>;

function readEntries(storage: StoragePort): Record<string, GuestProgressEntry> {
  try {
    const raw = storage.getItem(guestProgressStorageKey);
    if (raw === null || new TextEncoder().encode(raw).byteLength > maximumStoredBytes) {
      return {};
    }
    const parsed = storeSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data.entries : {};
  } catch {
    return {};
  }
}

export function getGuestResumePosition(
  input: Readonly<{
    durationSeconds: number;
    movieId: string;
    now: Date;
    storage: StoragePort;
  }>,
): number {
  const entry = readEntries(input.storage)[input.movieId];
  if (
    entry === undefined ||
    !durationsAreCompatible(entry.durationSeconds, input.durationSeconds)
  ) {
    return 0;
  }
  const decision = evaluateProgress({
    durationSeconds: input.durationSeconds,
    now: input.now,
    observedAt: new Date(entry.observedAt),
    positionSeconds: entry.positionSeconds,
  });
  return decision.accepted && !decision.value.completed ? decision.value.positionSeconds : 0;
}

export function writeGuestProgress(
  input: Readonly<{
    durationSeconds: number;
    movieId: string;
    now: Date;
    positionSeconds: number;
    storage: StoragePort;
  }>,
): boolean {
  const decision = evaluateProgress({
    durationSeconds: input.durationSeconds,
    now: input.now,
    observedAt: input.now,
    positionSeconds: input.positionSeconds,
  });
  if (!decision.accepted || !z.uuid().safeParse(input.movieId).success) {
    return false;
  }

  const entries = readEntries(input.storage);
  entries[input.movieId] = {
    durationSeconds: decision.value.durationSeconds,
    observedAt: decision.value.observedAt.toISOString(),
    positionSeconds: decision.value.positionSeconds,
  };
  const boundedEntries = Object.fromEntries(
    Object.entries(entries)
      .sort(
        ([, left], [, right]) =>
          new Date(right.observedAt).getTime() - new Date(left.observedAt).getTime(),
      )
      .slice(0, maximumStoredEntries),
  );
  try {
    input.storage.setItem(
      guestProgressStorageKey,
      JSON.stringify({ entries: boundedEntries, version: 1 }),
    );
    return true;
  } catch {
    return false;
  }
}
