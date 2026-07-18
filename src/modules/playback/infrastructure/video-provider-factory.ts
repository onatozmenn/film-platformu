import type {
  ServerEnvironment,
  VideoProviderEnvironment,
} from "@/shared/config/server-environment-schema";

import { VideoProviderError, type VideoProviderPort } from "../application/playback-ports";
import { fakeVideoProvider } from "./fake-video-provider";
import { createMuxVideoProvider } from "./mux-video-provider";

const disabledVideoProvider: VideoProviderPort = {
  createPlaybackGrant: async () => {
    throw new VideoProviderError("UNAVAILABLE");
  },
  getAsset: async () => {
    throw new VideoProviderError("UNAVAILABLE");
  },
  verifyWebhook: async () => {
    throw new VideoProviderError("INVALID_WEBHOOK");
  },
};

export function createVideoProvider(
  config: VideoProviderEnvironment,
  nodeEnvironment: ServerEnvironment["nodeEnvironment"],
): VideoProviderPort {
  if (config.kind === "mux") {
    return createMuxVideoProvider(config);
  }
  return nodeEnvironment === "production" ? disabledVideoProvider : fakeVideoProvider;
}
