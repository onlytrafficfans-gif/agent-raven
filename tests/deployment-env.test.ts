import { describe, expect, it } from "vitest";
import { checkProductionEnvironment } from "@/lib/deployment-env";

const validEnvironment = {
  DATABASE_URL: "postgresql://agent_raven:strong-password@database.internal:5432/agent_raven?schema=public",
  BETTER_AUTH_SECRET: "production-auth-secret-with-more-than-32-characters",
  BETTER_AUTH_URL: "https://raven.acme.invalid",
  INTEGRATION_ENCRYPTION_KEY: Buffer.from("0123456789abcdef0123456789abcdef").toString("base64"),
  INTEGRATION_ENCRYPTION_KEY_ID: "primary-2026-11",
  INTEGRATION_ENCRYPTION_PREVIOUS_KEYS: JSON.stringify({ "primary-2026-10": Buffer.from("abcdef0123456789abcdef0123456789").toString("base64") }),
  RESEND_API_KEY: "re_production_configured_value",
  AUTH_EMAIL_FROM: "Agent.Raven <auth@acme.invalid>",
  APOLLO_MONTHLY_OPERATION_LIMIT: "100",
};

describe("production deployment environment", () => {
  it("accepts a complete secret-safe configuration", () => {
    const result = checkProductionEnvironment(validEnvironment);
    expect(result).toEqual({
      valid: true,
      errors: [],
      configured: {
        database: true,
        authentication: true,
        credentialEncryption: true,
        passwordEmail: true,
        apolloBudget: true,
      },
    });
  });

  it("reports every missing production dependency without echoing values", () => {
    const result = checkProductionEnvironment({});
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(6);
    expect(JSON.stringify(result)).not.toContain("undefined");
  });

  it.each(["localhost", "LOCALHOST.", "db.localhost", "127.0.0.1", "127.1", "[::1]", "[::ffff:127.0.0.2]"])(
    "rejects a loopback database host (%s) without exposing credentials",
    (host) => {
      const result = checkProductionEnvironment({
        ...validEnvironment,
        DATABASE_URL: `postgresql://raven:private-password@${host}:5432/agent_raven`,
      });
      expect(result.valid).toBe(false);
      expect(result.configured.database).toBe(false);
      expect(result.errors).toEqual([expect.stringContaining("loopback")]);
      expect(JSON.stringify(result)).not.toContain("private-password");
    },
  );

  it("rejects insecure origins, placeholders, malformed encryption, and disabled budgets", () => {
    const result = checkProductionEnvironment({
      ...validEnvironment,
      DATABASE_URL: "mysql://user:secret@database.internal/app",
      BETTER_AUTH_URL: "http://raven.acme.invalid/path",
      INTEGRATION_ENCRYPTION_KEY: "not-a-32-byte-key",
      INTEGRATION_ENCRYPTION_KEY_ID: "invalid key id",
      INTEGRATION_ENCRYPTION_PREVIOUS_KEYS: "not-json",
      AUTH_EMAIL_FROM: "Agent.Raven <auth@example.com>",
      APOLLO_MONTHLY_OPERATION_LIMIT: "0",
    });
    expect(result.valid).toBe(false);
    expect(result.configured).toEqual({
      database: false,
      authentication: false,
      credentialEncryption: false,
      passwordEmail: false,
      apolloBudget: false,
    });
  });
});
