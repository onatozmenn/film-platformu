export type PublicationAssetState = "DISABLED" | "ERRORED" | "PREPARING" | "READY";

export type PublicationImageSnapshot = Readonly<{
  alt: string;
  focalPosition: string;
  height: number;
  referenceValidated: boolean;
  src: string;
  width: number;
}>;

export type PublicationRightSnapshot = Readonly<{
  allowStreaming: boolean;
  endsAt: Date;
  evidenceReference: string | null;
  startsAt: Date;
  territory: string;
}>;

export type PublicationAssetSnapshot = Readonly<{
  durationSeconds: number | null;
  isActive: boolean;
  providerPlaybackId: string | null;
  state: PublicationAssetState;
}>;

export type PublicationCandidate = Readonly<{
  assets: readonly PublicationAssetSnapshot[];
  backdrop: PublicationImageSnapshot | null;
  genreIds: readonly string[];
  poster: PublicationImageSnapshot | null;
  releaseDate: Date;
  rights: readonly PublicationRightSnapshot[];
  runtimeMinutes: number;
  synopsis: string;
  title: string;
}>;

export type PublicationIssueCode =
  | "ACTIVE_READY_ASSET_REQUIRED"
  | "BACKDROP_INVALID"
  | "GENRE_REQUIRED"
  | "POSTER_INVALID"
  | "RELEASE_DATE_INVALID"
  | "RIGHTS_UNAVAILABLE"
  | "RUNTIME_INVALID"
  | "SCHEDULE_MUST_BE_FUTURE"
  | "SYNOPSIS_INVALID"
  | "TITLE_INVALID";

export type PublicationDecision =
  Readonly<{ ready: true }> | Readonly<{ issues: readonly PublicationIssueCode[]; ready: false }>;

export type PublicationReadinessInput = Readonly<{
  at: Date;
  candidate: PublicationCandidate;
  supportedTerritories: readonly string[];
}>;

export type ScheduleReadinessInput = Readonly<{
  candidate: PublicationCandidate;
  now: Date;
  publishAt: Date;
  supportedTerritories: readonly string[];
}>;

function isFiniteDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

function isValidImage(image: PublicationImageSnapshot | null): boolean {
  return (
    image !== null &&
    image.referenceValidated &&
    image.src.trim().length > 0 &&
    image.alt.trim().length > 0 &&
    image.focalPosition.trim().length > 0 &&
    Number.isInteger(image.width) &&
    image.width > 0 &&
    Number.isInteger(image.height) &&
    image.height > 0
  );
}

function hasEligibleRight(input: PublicationReadinessInput): boolean {
  const supportedTerritories = new Set(input.supportedTerritories);

  return input.candidate.rights.some(
    (right) =>
      supportedTerritories.has(right.territory) &&
      right.allowStreaming &&
      right.evidenceReference !== null &&
      right.evidenceReference.trim().length > 0 &&
      isFiniteDate(right.startsAt) &&
      isFiniteDate(right.endsAt) &&
      right.startsAt.getTime() <= input.at.getTime() &&
      input.at.getTime() < right.endsAt.getTime(),
  );
}

function hasOneActiveReadyAsset(candidate: PublicationCandidate): boolean {
  const activeAssets = candidate.assets.filter((asset) => asset.isActive);
  const asset = activeAssets[0];

  return (
    activeAssets.length === 1 &&
    asset !== undefined &&
    asset.state === "READY" &&
    asset.providerPlaybackId !== null &&
    asset.providerPlaybackId.trim().length > 0 &&
    asset.durationSeconds !== null &&
    Number.isInteger(asset.durationSeconds) &&
    asset.durationSeconds > 0
  );
}

export function evaluatePublicationReadiness(
  input: PublicationReadinessInput,
): PublicationDecision {
  const issues: PublicationIssueCode[] = [];
  const title = input.candidate.title.trim();
  const synopsis = input.candidate.synopsis.trim();

  if (title.length < 1 || title.length > 160) {
    issues.push("TITLE_INVALID");
  }
  if (synopsis.length < 10 || synopsis.length > 5_000) {
    issues.push("SYNOPSIS_INVALID");
  }
  if (!isFiniteDate(input.candidate.releaseDate)) {
    issues.push("RELEASE_DATE_INVALID");
  }
  if (!Number.isInteger(input.candidate.runtimeMinutes) || input.candidate.runtimeMinutes <= 0) {
    issues.push("RUNTIME_INVALID");
  }
  if (!isValidImage(input.candidate.poster)) {
    issues.push("POSTER_INVALID");
  }
  if (!isValidImage(input.candidate.backdrop)) {
    issues.push("BACKDROP_INVALID");
  }
  if (input.candidate.genreIds.length === 0) {
    issues.push("GENRE_REQUIRED");
  }
  if (!hasEligibleRight(input)) {
    issues.push("RIGHTS_UNAVAILABLE");
  }
  if (!hasOneActiveReadyAsset(input.candidate)) {
    issues.push("ACTIVE_READY_ASSET_REQUIRED");
  }

  return issues.length === 0 ? { ready: true } : { issues, ready: false };
}

export function evaluateScheduleReadiness(input: ScheduleReadinessInput): PublicationDecision {
  if (!isFiniteDate(input.publishAt) || input.publishAt.getTime() <= input.now.getTime()) {
    return { issues: ["SCHEDULE_MUST_BE_FUTURE"], ready: false };
  }

  return evaluatePublicationReadiness({
    at: input.publishAt,
    candidate: input.candidate,
    supportedTerritories: input.supportedTerritories,
  });
}
