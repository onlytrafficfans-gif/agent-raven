import { describe, expect, it } from "vitest";
import { decideBudget } from "./budget";

describe("decideBudget", () => {
  it("allows an operation inside the limit", () => expect(decideBudget(4, 1, 10)).toEqual({ allowed: true, remaining: 5 }));
  it("blocks before a paid operation exceeds the limit", () => expect(decideBudget(10, 1, 10)).toMatchObject({ allowed: false, remaining: 0 }));
  it("fails closed on invalid configuration", () => expect(decideBudget(-1, 1, 10)).toMatchObject({ allowed: false }));
});
