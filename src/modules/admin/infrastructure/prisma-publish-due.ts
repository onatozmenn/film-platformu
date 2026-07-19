import type { PrismaClient } from "@/generated/prisma/client";

import type {
  AdminCommandRepositoryPort,
  PublishDueRepositoryResult,
} from "../application/admin-command-port";
import {
  evaluatePublicationReadiness,
  type PublicationIssueCode,
} from "../domain/publication-policy";
import {
  appendAuditEvent,
  mapPublicationCandidate,
  publicationCandidateSelect,
} from "./prisma-admin-command-support";

type PublishDueMethod = Pick<AdminCommandRepositoryPort, "publishDue">;

type PublishDueOptions = Readonly<{
  supportedTerritories: readonly string[];
}>;

type DueCandidate = Readonly<{ id: string }>;
type RowOutcome =
  | Readonly<{ kind: "failed" }>
  | Readonly<{ kind: "published"; movie: Readonly<{ id: string; slug: string }> }>
  | Readonly<{ kind: "skipped" }>;

const transactionOptions = { maxWait: 2_000, timeout: 5_000 } as const;

function failureCode(issues: readonly PublicationIssueCode[]) {
  if (issues.includes("ACTIVE_READY_ASSET_REQUIRED")) {
    return "ASSET_UNAVAILABLE" as const;
  }
  if (issues.includes("RIGHTS_UNAVAILABLE")) {
    return "RIGHTS_UNAVAILABLE" as const;
  }
  return "CONTENT_INCOMPLETE" as const;
}

export function createPrismaPublishDue(
  client: PrismaClient,
  options: PublishDueOptions,
): PublishDueMethod {
  return {
    async publishDue(now, limit, requestId): Promise<PublishDueRepositoryResult> {
      const candidates = await client.$queryRaw<DueCandidate[]>`
        SELECT id
        FROM movies
        WHERE publication_state = 'SCHEDULED'::"PublicationState"
          AND publish_at <= ${now}
          AND (last_publish_attempt_at IS NULL OR last_publish_attempt_at < ${now})
        ORDER BY publish_at ASC, id ASC
        LIMIT ${limit}
      `;
      const publishedMovies: Array<{ id: string; slug: string }> = [];
      let failed = 0;
      let skipped = 0;

      for (const candidate of candidates) {
        try {
          const outcome = await client.$transaction<RowOutcome>(async (transaction) => {
            const claimed = await transaction.$queryRaw<DueCandidate[]>`
              SELECT id
              FROM movies
              WHERE id = ${candidate.id}::uuid
                AND publication_state = 'SCHEDULED'::"PublicationState"
                AND publish_at <= ${now}
                AND (last_publish_attempt_at IS NULL OR last_publish_attempt_at < ${now})
              FOR UPDATE SKIP LOCKED
            `;
            if (claimed.length === 0) {
              return { kind: "skipped" };
            }
            const movie = await transaction.movie.findUniqueOrThrow({
              where: { id: candidate.id },
              select: publicationCandidateSelect,
            });
            const decision = evaluatePublicationReadiness({
              at: now,
              candidate: mapPublicationCandidate(movie),
              supportedTerritories: options.supportedTerritories,
            });
            if (!decision.ready) {
              const code = failureCode(decision.issues);
              await transaction.movie.update({
                where: { id: movie.id },
                data: {
                  lastPublishAttemptAt: now,
                  lastPublishFailure: code,
                  revision: { increment: 1 },
                },
              });
              await appendAuditEvent(transaction, {
                action: "MOVIE_PUBLICATION_FAILED",
                actorUserId: null,
                metadata: { failureCode: code, issueCodes: decision.issues },
                requestId,
                targetId: movie.id,
                targetType: "MOVIE",
              });
              return { kind: "failed" };
            }
            await transaction.movie.update({
              where: { id: movie.id },
              data: {
                firstPublishedAt: movie.firstPublishedAt ?? now,
                lastPublishAttemptAt: null,
                lastPublishFailure: null,
                publicationState: "PUBLISHED",
                publishAt: null,
                revision: { increment: 1 },
              },
            });
            await appendAuditEvent(transaction, {
              action: "MOVIE_PUBLISHED",
              actorUserId: null,
              metadata: { source: "SCHEDULED" },
              requestId,
              targetId: movie.id,
              targetType: "MOVIE",
            });
            return { kind: "published", movie: { id: movie.id, slug: movie.slug } };
          }, transactionOptions);

          switch (outcome.kind) {
            case "published":
              publishedMovies.push(outcome.movie);
              break;
            case "failed":
              failed += 1;
              break;
            case "skipped":
              skipped += 1;
              break;
          }
        } catch {
          failed += 1;
        }
      }

      return { examined: candidates.length, failed, publishedMovies, skipped };
    },
  };
}
