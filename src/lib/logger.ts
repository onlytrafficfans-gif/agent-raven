import { redact } from "@/lib/security";

export function logEvent(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...redact(fields) as object });
  if (level === "error") console.error(line); else if (level === "warn") console.warn(line); else console.info(line);
}

export function correlationId(request: Request): string {
  return request.headers.get("x-request-id")?.slice(0, 128) || crypto.randomUUID();
}
