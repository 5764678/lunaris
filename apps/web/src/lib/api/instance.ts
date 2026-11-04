import { config } from "@/lib/config";

import { createApiClient } from "./client";

/** Application-wide API client bound to the configured base URL. */
export const api = createApiClient({
  baseUrl: config.apiBaseUrl,
  timeoutMs: config.requestTimeoutMs,
});
