import { describe, expect, it } from "vitest";
import { normalizeDomain } from "./domain";

describe("normalizeDomain", () => {
  it.each([
    [" HTTPS://WWW.Example.COM/path?q=1#top ", "example.com"],
    ["example.com.", "example.com"],
    ["https://münich.example/path", "xn--mnich-kva.example"],
  ])("normalizes %s", (input, expected) => expect(normalizeDomain(input)).toBe(expected));
  it("rejects malformed input", () => expect(normalizeDomain("not a domain / nope")).toBeNull());
});
