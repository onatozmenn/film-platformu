import "server-only";

import { catalogInvalidation, catalogVisibility } from "@/modules/catalog/server";
import { memberAuthorization } from "@/modules/identity/server";
import { database } from "@/shared/db/database";
import { createFixedWindowRateLimiter } from "@/shared/http/fixed-window-rate-limiter";

import {
  createLibraryService,
  type LibraryMutationResult,
} from "./application/create-library-service";
import { createLatestWriteCoalescer } from "./application/latest-write-coalescer";
import { createPrismaLibraryRepository } from "./infrastructure/prisma-library-repository";

export const libraryService = createLibraryService({
  catalogInvalidation,
  catalogVisibility,
  clock: () => new Date(),
  memberAuthorization,
  repository: createPrismaLibraryRepository(database),
});

export const progressWriteCoalescer = createLatestWriteCoalescer<LibraryMutationResult>();
export const progressWriteRateLimiter = createFixedWindowRateLimiter(12, 60_000);
