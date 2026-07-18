import "server-only";

import { getServerEnvironment } from "@/shared/config/server-environment";

import { createMetadataProvider } from "./infrastructure/metadata-provider-factory";

export const metadataProvider = createMetadataProvider(getServerEnvironment().metadataProvider);
