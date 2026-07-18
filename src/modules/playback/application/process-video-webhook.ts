import type {
  ApplyVideoEventResult,
  VideoProviderPort,
  VideoWebhookRepositoryPort,
} from "./playback-ports";
import { VideoProviderError } from "./playback-ports";

type ProcessVideoWebhookDependencies = Readonly<{
  clock: () => Date;
  repository: VideoWebhookRepositoryPort;
  videoProvider: VideoProviderPort;
}>;

export function createVideoWebhookService(dependencies: ProcessVideoWebhookDependencies) {
  return {
    async process(rawBody: string, headers: Headers): Promise<ApplyVideoEventResult | "invalid"> {
      try {
        const event = await dependencies.videoProvider.verifyWebhook(
          rawBody,
          headers,
          dependencies.clock(),
        );
        return dependencies.repository.applyVerifiedEvent(event);
      } catch (error) {
        if (
          error instanceof VideoProviderError ||
          (typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "INVALID_WEBHOOK")
        ) {
          return "invalid";
        }
        throw error;
      }
    },
  };
}
