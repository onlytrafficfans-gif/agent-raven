export type ProviderErrorCode = "INVALID_CREDENTIAL" | "INSUFFICIENT_PERMISSION" | "RATE_LIMITED" | "BUDGET_BLOCKED" | "PROVIDER_UNAVAILABLE" | "INVALID_REQUEST";

export class ProviderError extends Error {
  constructor(public code: ProviderErrorCode, message: string, public retryAfter?: number) { super(message); }
}

export function mapApolloStatus(status: number, retryAfter?: string | null): ProviderError {
  if (status === 401) return new ProviderError("INVALID_CREDENTIAL", "Apollo rejected the credential.");
  if (status === 403) return new ProviderError("INSUFFICIENT_PERMISSION", "This Apollo account cannot use the requested capability.");
  if (status === 422) return new ProviderError("INVALID_REQUEST", "Apollo rejected one or more search filters.");
  if (status === 429) return new ProviderError("RATE_LIMITED", "Apollo rate limit reached. Try again later.", retryAfter ? Number(retryAfter) : undefined);
  return new ProviderError("PROVIDER_UNAVAILABLE", "Apollo is currently unavailable.");
}
