type DeploymentFetch = typeof fetch;

export type DeploymentVerification = {
  valid: boolean;
  origin: string | null;
  checks: {
    liveness: boolean;
    readiness: boolean;
    signIn: boolean;
  };
  errors: string[];
  observed: {
    databaseLatencyMs: number | null;
    databaseLatencyWarningMs: number | null;
    securityHeaders: boolean;
  };
};

type VerifyDeploymentOptions = {
  fetcher?: DeploymentFetch;
  allowInsecureLoopback?: boolean;
  timeoutMs?: number;
};

const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const sensitiveKeyPattern = /(secret|password|token|credential|api.?key|database.?url)/i;
const sensitiveValuePattern = /(postgres(?:ql)?:\/\/|bearer\s+[a-z0-9._-]+|re_[a-z0-9_-]{8,}|apollo(?:-|_)?(?:key|token)[=:])/i;

export async function verifyDeployment(
  input: string | undefined,
  options: VerifyDeploymentOptions = {},
): Promise<DeploymentVerification> {
  const result: DeploymentVerification = {
    valid: false,
    origin: null,
    checks: { liveness: false, readiness: false, signIn: false },
    errors: [],
    observed: { databaseLatencyMs: null, databaseLatencyWarningMs: null, securityHeaders: false },
  };
  const origin = deploymentOrigin(input, Boolean(options.allowInsecureLoopback), result.errors);
  if (!origin) return result;
  result.origin = origin;

  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  await verifyLiveness(fetcher, origin, timeoutMs, result);
  await verifyReadiness(fetcher, origin, timeoutMs, result);
  await verifySignIn(fetcher, origin, timeoutMs, result);
  result.valid = result.errors.length === 0 && Object.values(result.checks).every(Boolean);
  return result;
}

function deploymentOrigin(input: string | undefined, allowInsecureLoopback: boolean, errors: string[]): string | null {
  if (!input) {
    errors.push("DEPLOYMENT_URL is required.");
    return null;
  }
  try {
    const url = new URL(input);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      errors.push("DEPLOYMENT_URL must be a canonical origin with no credentials, path, query, or fragment.");
      return null;
    }
    const secure = url.protocol === "https:";
    const allowedLoopback = url.protocol === "http:" && allowInsecureLoopback && loopbackHosts.has(url.hostname);
    if (!secure && !allowedLoopback) {
      errors.push("DEPLOYMENT_URL must use HTTPS; HTTP is allowed only for an explicitly enabled loopback check.");
      return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      errors.push("DEPLOYMENT_URL must use HTTP or HTTPS.");
      return null;
    }
    return url.origin;
  } catch {
    errors.push("DEPLOYMENT_URL must be a valid URL.");
    return null;
  }
}

async function verifyLiveness(
  fetcher: DeploymentFetch,
  origin: string,
  timeoutMs: number,
  result: DeploymentVerification,
) {
  const requestId = `deploy-live-${crypto.randomUUID()}`;
  const response = await safeFetch(fetcher, `${origin}/api/health/live`, requestId, timeoutMs, "Liveness", result.errors);
  if (!response) return;
  const body = await safeJson(response, "Liveness", result.errors);
  if (
    response.status !== 200 ||
    body?.status !== "operational" ||
    body?.application !== "operational" ||
    response.headers.get("x-health-status") !== "operational" ||
    response.headers.get("x-request-id") !== requestId ||
    body?.correlationId !== requestId ||
    !response.headers.get("cache-control")?.includes("no-store") ||
    containsSensitiveData(body)
  ) {
    result.errors.push("Liveness response failed the sanitized operational contract.");
    return;
  }
  result.checks.liveness = true;
}

async function verifyReadiness(
  fetcher: DeploymentFetch,
  origin: string,
  timeoutMs: number,
  result: DeploymentVerification,
) {
  const requestId = `deploy-ready-${crypto.randomUUID()}`;
  const response = await safeFetch(fetcher, `${origin}/api/health`, requestId, timeoutMs, "Readiness", result.errors);
  if (!response) return;
  const body = await safeJson(response, "Readiness", result.errors);
  const latency = body?.databaseLatencyMs;
  const warning = body?.databaseLatencyWarningMs;
  if (
    response.status !== 200 ||
    body?.status !== "operational" ||
    body?.application !== "operational" ||
    body?.database !== "operational" ||
    typeof latency !== "number" ||
    latency < 0 ||
    typeof warning !== "number" ||
    warning < 1 ||
    response.headers.get("x-health-status") !== "operational" ||
    response.headers.get("x-request-id") !== requestId ||
    body?.correlationId !== requestId ||
    !response.headers.get("cache-control")?.includes("no-store") ||
    !/^database;dur=\d+$/.test(response.headers.get("server-timing") ?? "") ||
    containsSensitiveData(body)
  ) {
    result.errors.push("Readiness response failed the database-backed operational contract.");
    return;
  }
  result.observed.databaseLatencyMs = latency;
  result.observed.databaseLatencyWarningMs = warning;
  result.checks.readiness = true;
}

async function verifySignIn(
  fetcher: DeploymentFetch,
  origin: string,
  timeoutMs: number,
  result: DeploymentVerification,
) {
  const response = await safeFetch(fetcher, `${origin}/sign-in`, undefined, timeoutMs, "Sign-in", result.errors);
  if (!response) return;
  const headers = response.headers;
  const policyValid =
    headers.get("content-security-policy")?.includes("frame-ancestors 'none'") === true &&
    headers.get("x-content-type-options") === "nosniff" &&
    headers.get("x-frame-options") === "DENY" &&
    headers.get("referrer-policy") === "strict-origin-when-cross-origin" &&
    headers.get("permissions-policy")?.includes("camera=()") === true &&
    headers.get("cross-origin-opener-policy") === "same-origin" &&
    headers.get("cross-origin-resource-policy") === "same-origin" &&
    !headers.has("x-powered-by");
  result.observed.securityHeaders = policyValid;
  if (response.status !== 200 || response.redirected || !policyValid) {
    result.errors.push("Sign-in page failed the direct-response security contract.");
    return;
  }
  result.checks.signIn = true;
}

async function safeFetch(
  fetcher: DeploymentFetch,
  url: string,
  requestId: string | undefined,
  timeoutMs: number,
  label: string,
  errors: string[],
): Promise<Response | null> {
  try {
    return await fetcher(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: requestId ? { "x-request-id": requestId } : undefined,
    });
  } catch {
    errors.push(`${label} request failed.`);
    return null;
  }
}

async function safeJson(response: Response, label: string, errors: string[]): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid JSON object");
    return value as Record<string, unknown>;
  } catch {
    errors.push(`${label} response was not a JSON object.`);
    return null;
  }
}

function containsSensitiveData(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitiveData);
  if (!value || typeof value !== "object") return typeof value === "string" && sensitiveValuePattern.test(value);
  return Object.entries(value).some(([key, child]) => sensitiveKeyPattern.test(key) || containsSensitiveData(child));
}
