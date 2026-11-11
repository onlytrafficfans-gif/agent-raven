const secretPattern = /(api[_-]?key|authorization|token|credential|password)\s*[=:]\s*[^\s,;}]+/gi;

export function redact(value: unknown): unknown {
  if (typeof value === "string") return value.replace(secretPattern, "$1=[REDACTED]");
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        /key|token|secret|password|credential|authorization|cookie|session/i.test(key) ? "[REDACTED]" : redact(nested),
      ]),
    );
  }
  return value;
}
