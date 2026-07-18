export type CatalogPublicationState = "DRAFT" | "PUBLISHED" | "SCHEDULED" | "UNPUBLISHED";

export function isCatalogVisible(
  state: CatalogPublicationState,
  publishAt: Date | null,
  now: Date,
): boolean {
  return state === "PUBLISHED" && (publishAt === null || publishAt.getTime() <= now.getTime());
}
