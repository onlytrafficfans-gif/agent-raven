import { isIPv4 } from "node:net";

type DeploymentEnvironment = Record<string, string | undefined>;

export type DeploymentEnvironmentCheck = {
  valid: boolean;
  errors: string[];
  configured: {
    database: boolean;
    authentication: boolean;
    credentialEncryption: boolean;
    passwordEmail: boolean;
    apolloBudget: boolean;
  };
};

const placeholderPattern = /(change-me|replace-with|example\.com|example\.test)/i;

export function checkProductionEnvironment(env: DeploymentEnvironment): DeploymentEnvironmentCheck {
  const errors: string[] = [];
  const database = validPostgresUrl(env.DATABASE_URL, errors);
  const authentication = validAuthentication(env, errors);
  const credentialEncryption = validEncryptionConfiguration(env, errors);
  const passwordEmail = validPasswordEmail(env, errors);
  const apolloBudget = validApolloBudget(env.APOLLO_MONTHLY_OPERATION_LIMIT, errors);

  return {
    valid: errors.length === 0,
    errors,
    configured: { database, authentication, credentialEncryption, passwordEmail, apolloBudget },
  };
}

function validPostgresUrl(value: string | undefined, errors: string[]): boolean {
  if (!value) {
    errors.push("DATABASE_URL is required.");
    return false;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      errors.push("DATABASE_URL must use PostgreSQL.");
      return false;
    }
    if (!url.hostname || !url.pathname.slice(1)) {
      errors.push("DATABASE_URL must include a host and database name.");
      return false;
    }
    // Use the special-URL parser to canonicalize numeric host spellings.
    const host = new URL(`http://${url.hostname}`).hostname.replace(/\.$/, "");
    if (host === "localhost" || host.endsWith(".localhost") || (isIPv4(host) && host.startsWith("127.")) ||
        host === "[::1]" || /^\[::ffff:7f[0-9a-f]{2}:/.test(host)) {
      errors.push("DATABASE_URL must point to the production PostgreSQL host, not a loopback address.");
      return false;
    }
    if (placeholderPattern.test(value)) {
      errors.push("DATABASE_URL still contains a placeholder value.");
      return false;
    }
    return true;
  } catch {
    errors.push("DATABASE_URL must be a valid URL.");
    return false;
  }
}

function validAuthentication(env: DeploymentEnvironment, errors: string[]): boolean {
  let valid = true;
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32 || placeholderPattern.test(secret)) {
    errors.push("BETTER_AUTH_SECRET must be a non-placeholder value of at least 32 characters.");
    valid = false;
  }

  const origin = env.BETTER_AUTH_URL;
  if (!origin) {
    errors.push("BETTER_AUTH_URL is required.");
    return false;
  }
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.origin !== origin.replace(/\/$/, "")) {
      errors.push("BETTER_AUTH_URL must be the canonical HTTPS origin with no path.");
      valid = false;
    }
    if (placeholderPattern.test(origin)) {
      errors.push("BETTER_AUTH_URL still contains a placeholder value.");
      valid = false;
    }
  } catch {
    errors.push("BETTER_AUTH_URL must be a valid URL.");
    valid = false;
  }
  return valid;
}

function validEncryptionConfiguration(env: DeploymentEnvironment, errors: string[]): boolean {
  let valid = validEncryptionKey(env.INTEGRATION_ENCRYPTION_KEY, "INTEGRATION_ENCRYPTION_KEY", errors);
  const currentKeyId = env.INTEGRATION_ENCRYPTION_KEY_ID?.trim() || "v1";
  if (!validEncryptionKeyId(currentKeyId)) {
    errors.push("INTEGRATION_ENCRYPTION_KEY_ID must use 1-64 letters, numbers, dots, underscores, or hyphens.");
    valid = false;
  }
  const previousRaw = env.INTEGRATION_ENCRYPTION_PREVIOUS_KEYS?.trim();
  if (!previousRaw) return valid;
  let previous: unknown;
  try {
    previous = JSON.parse(previousRaw);
  } catch {
    errors.push("INTEGRATION_ENCRYPTION_PREVIOUS_KEYS must be a JSON object of key IDs to base64 keys.");
    return false;
  }
  if (!previous || Array.isArray(previous) || typeof previous !== "object") {
    errors.push("INTEGRATION_ENCRYPTION_PREVIOUS_KEYS must be a JSON object of key IDs to base64 keys.");
    return false;
  }
  for (const [keyId, key] of Object.entries(previous)) {
    if (!validEncryptionKeyId(keyId) || keyId === currentKeyId || typeof key !== "string") {
      errors.push("INTEGRATION_ENCRYPTION_PREVIOUS_KEYS contains an invalid or duplicate key ID.");
      valid = false;
      continue;
    }
    if (!validEncryptionKey(key, "A previous integration encryption key", errors)) valid = false;
  }
  return valid;
}

function validEncryptionKeyId(value: string): boolean {
  return /^[A-Za-z0-9._-]{1,64}$/.test(value);
}

function validEncryptionKey(value: string | undefined, label: string, errors: string[]): boolean {
  if (!value || placeholderPattern.test(value)) {
    errors.push(`${label} must be a non-placeholder base64 value.`);
    return false;
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32 || decoded.toString("base64") !== value) {
    errors.push(`${label} must be canonical base64 encoding exactly 32 bytes.`);
    return false;
  }
  return true;
}

function validPasswordEmail(env: DeploymentEnvironment, errors: string[]): boolean {
  const apiKey = env.RESEND_API_KEY;
  const sender = env.AUTH_EMAIL_FROM;
  if (!apiKey || placeholderPattern.test(apiKey)) {
    errors.push("RESEND_API_KEY is required for production password recovery.");
    return false;
  }
  const email = sender?.match(/<([^>]+)>/)?.[1] ?? sender;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || placeholderPattern.test(email)) {
    errors.push("AUTH_EMAIL_FROM must contain a non-placeholder verified sender address.");
    return false;
  }
  return true;
}

function validApolloBudget(value: string | undefined, errors: string[]): boolean {
  const parsed = Number(value);
  if (!value || !Number.isSafeInteger(parsed) || parsed < 1) {
    errors.push("APOLLO_MONTHLY_OPERATION_LIMIT must be a positive integer.");
    return false;
  }
  return true;
}
