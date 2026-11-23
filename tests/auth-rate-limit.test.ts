import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

describe("persistent authentication rate limiting", () => {
  beforeEach(async () => {
    await db.rateLimit.deleteMany();
  });

  afterEach(async () => {
    await db.rateLimit.deleteMany();
  });

  it("persists and enforces the Better Auth sign-in limit in PostgreSQL", async () => {
    const attempt = () => auth.handler(new Request("http://127.0.0.1:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "192.0.2.80",
      },
      body: JSON.stringify({ email: "rate-limit-probe@example.test", password: "not-the-password-2026" }),
    }));

    for (let index = 0; index < 3; index++) {
      await expect(attempt()).resolves.toMatchObject({ status: 401 });
    }

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("x-retry-after"))).toBeGreaterThan(0);
    await expect(db.rateLimit.findFirstOrThrow()).resolves.toMatchObject({ count: 3 });
  });
});
