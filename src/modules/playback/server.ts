import "server-only";

import { randomUUID } from "node:crypto";

import { getServerEnvironment } from "@/shared/config/server-environment";
import { database } from "@/shared/db/database";
import { createFixedWindowRateLimiter } from "@/shared/http/fixed-window-rate-limiter";

import { createPlaybackService } from "./application/create-playback-session";
import { createVideoWebhookService } from "./application/process-video-webhook";
import { createPrismaPlaybackRepository } from "./infrastructure/prisma-playback-repository";
import { createPrismaVideoWebhookRepository } from "./infrastructure/prisma-video-webhook-repository";
import { createTerritoryResolver } from "./infrastructure/territory-resolver";
import { createVideoProvider } from "./infrastructure/video-provider-factory";

const environment = getServerEnvironment();
const repository = createPrismaPlaybackRepository(database);
const webhookRepository = createPrismaVideoWebhookRepository(database);

export const videoProvider = createVideoProvider(
  environment.playback.videoProvider,
  environment.nodeEnvironment,
);

export const territoryResolver = createTerritoryResolver(
  environment.playback,
  process.env.VERCEL === "1",
);

export const playbackSessionRateLimiter = createFixedWindowRateLimiter(20, 60_000);

export const playbackService = createPlaybackService({
  clock: () => new Date(),
  createSessionId: () => `ps_${randomUUID().replaceAll("-", "")}`,
  repository,
  videoProvider,
});

export const videoWebhookService = createVideoWebhookService({
  clock: () => new Date(),
  repository: webhookRepository,
  videoProvider,
});
