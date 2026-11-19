const jsonBodyLimit = 64 * 1024;
export const csvMultipartBodyLimit = 2_100_000;

export class RequestBodyError extends Error {
  constructor(
    public readonly code: "INVALID_CONTENT_TYPE" | "INVALID_JSON" | "PAYLOAD_TOO_LARGE",
    message: string,
    public readonly status: 400 | 413 | 415,
  ) {
    super(message);
    this.name = "RequestBodyError";
  }
}

function declaredLength(request: Request): number | null {
  const value = request.headers.get("content-length");
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (declaredLength(request) !== null && declaredLength(request)! > maxBytes) {
    throw new RequestBodyError("PAYLOAD_TOO_LARGE", "The request payload is too large.", 413);
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RequestBodyError("PAYLOAD_TOO_LARGE", "The request payload is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function parseBoundedJson(request: Request, maxBytes = jsonBodyLimit): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new RequestBodyError("INVALID_CONTENT_TYPE", "Content-Type must be application/json.", 415);
  }
  const bytes = await readBoundedBody(request, maxBytes);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new RequestBodyError("INVALID_JSON", "The request body must contain valid JSON.", 400);
  }
}

export async function parseBoundedFormData(request: Request, maxBytes = csvMultipartBodyLimit): Promise<FormData> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data;")) {
    throw new RequestBodyError("INVALID_CONTENT_TYPE", "Content-Type must be multipart/form-data.", 415);
  }
  const bytes = await readBoundedBody(request, maxBytes);
  const buffered = new Request("http://request-body.local", {
    method: "POST",
    headers: { "content-type": request.headers.get("content-type")! },
    body: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  });
  try {
    return await buffered.formData();
  } catch {
    throw new RequestBodyError("INVALID_CONTENT_TYPE", "The multipart request body is invalid.", 400);
  }
}
