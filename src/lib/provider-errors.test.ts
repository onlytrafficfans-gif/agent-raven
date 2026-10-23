import { describe, expect, it } from "vitest";
import { mapApolloStatus } from "./provider-errors";

describe("Apollo error mapping", () => {
  it.each([[401,"INVALID_CREDENTIAL"],[403,"INSUFFICIENT_PERMISSION"],[422,"INVALID_REQUEST"],[429,"RATE_LIMITED"],[503,"PROVIDER_UNAVAILABLE"]] as const)("maps %i", (status, code) => expect(mapApolloStatus(status).code).toBe(code));
});
