import "server-only";

import {
  parseInternalJobsEnvironment,
  type InternalJobsEnvironment,
} from "./internal-jobs-environment";

export function getInternalJobsEnvironment(): InternalJobsEnvironment {
  return parseInternalJobsEnvironment({
    CRON_SECRET: process.env.CRON_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    PUBLISH_BATCH_LIMIT: process.env.PUBLISH_BATCH_LIMIT,
    RETENTION_BATCH_LIMIT: process.env.RETENTION_BATCH_LIMIT,
  });
}
