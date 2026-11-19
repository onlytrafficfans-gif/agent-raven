import { describe, expect, it } from "vitest";
import { jsonError } from "@/lib/http";
import { parseBoundedFormData, parseBoundedJson, readBoundedBody } from "@/lib/request-body";

describe("bounded request bodies", () => {
  it("parses JSON within the byte limit", async () => {
    const request = new Request("https://raven.test/api/prospects", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ name: "Acme" }),
    });
    await expect(parseBoundedJson(request, 64)).resolves.toEqual({ name: "Acme" });
  });

  it("rejects a declared oversized body before reading it", async () => {
    const request = new Request("https://raven.test/api/prospects", {
      method: "POST",
      headers: { "content-length": "1000" },
      body: "small",
    });
    await expect(readBoundedBody(request, 10)).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE", status: 413 });
  });

  it("rejects a chunked body that exceeds the actual byte limit", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("123456"));
        controller.enqueue(new TextEncoder().encode("789012"));
        controller.close();
      },
    });
    const request = new Request("https://raven.test/api/prospects", { method: "POST", body, duplex: "half" } as RequestInit);
    await expect(readBoundedBody(request, 10)).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE", status: 413 });
  });

  it("returns a correlated, sanitized 413 response", async () => {
    const request = new Request("https://raven.test/api/prospects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: "do-not-return", filler: "x".repeat(100) }),
    });
    let error: unknown;
    try {
      await parseBoundedJson(request, 32);
    } catch (caught) {
      error = caught;
    }
    const response = jsonError(error, "body-limit-test");
    expect(response.status).toBe(413);
    expect(response.headers.get("x-request-id")).toBe("body-limit-test");
    expect(await response.json()).toEqual({
      error: { code: "PAYLOAD_TOO_LARGE", message: "The request payload is too large." },
      correlationId: "body-limit-test",
    });
  });

  it("buffers valid multipart form data within the request limit", async () => {
    const source = new FormData();
    source.set("file", new File(["company_name,domain\nAcme,acme.test"], "prospects.csv", { type: "text/csv" }));
    const request = new Request("https://raven.test/api/import/csv", { method: "POST", body: source });
    const parsed = await parseBoundedFormData(request, 1024);
    expect((parsed.get("file") as File).name).toBe("prospects.csv");
  });
});
