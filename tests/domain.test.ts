import { describe,expect,it } from "vitest";
import { normalizeDomain } from "@/lib/domain";
describe("normalizeDomain",()=>{it.each([
  [" HTTPS://WWW.Example.COM/path?q=1#x ","example.com"],["www.example.com.","example.com"],["https://sub.example.co.uk/a","example.co.uk"],["https://münich.de","xn--mnich-kva.de"],
])("normalizes %s",(input,expected)=>expect(normalizeDomain(input)).toBe(expected));it("rejects malformed input",()=>expect(normalizeDomain("http://[broken")).toBeNull())});
