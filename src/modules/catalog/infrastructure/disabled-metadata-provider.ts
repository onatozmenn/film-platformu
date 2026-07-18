import {
  MetadataProviderError,
  type MetadataProviderPort,
} from "../application/metadata-provider-port";

function disabled(): never {
  throw new MetadataProviderError("disabled", "Metadata provider is disabled");
}

export const disabledMetadataProvider: MetadataProviderPort = {
  getMovie: async () => disabled(),
  searchMovies: async () => disabled(),
};
