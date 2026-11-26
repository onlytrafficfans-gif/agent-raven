import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

describe("persistent authentication rate limiting", () => {
  it("keeps server-side password-reset initiation available", async () => {
    await expect(auth.api.requestPasswordReset({
      body: { email: `reset-${randomUUID()}@example.test`, redirectTo: "/reset-password" },
      headers: new Headers(),
    })).resolves.toMatchObject({ status: true });
  });

  it("persists and enforces the Better Auth sign-in limit in PostgreSQL", async () => {
    const suffix = randomBytes(4).toString("hex");
    const subnet = `2001:0db8:${suffix.slice(0, 4)}:${suffix.slice(4)}`;
    const key = `${subnet}:0000:0000:0000:0000|/sign-in/email`;
    const attempt = () => auth.handler(new Request("http://127.0.0.1:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `${subnet}::1`,
      },
      body: JSON.stringify({ email: "rate-limit-probe@example.test", password: "not-the-password-2026" }),
    }));

    try {
      for (let index = 0; index < 3; index++) {
        await expect(attempt()).resolves.toMatchObject({ status: 401 });
      }

      const blocked = await attempt();
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers.get("x-retry-after"))).toBeGreaterThan(0);
      await expect(db.rateLimit.findUniqueOrThrow({ where: { key } })).resolves.toMatchObject({ count: 3 });
    } finally {
      await db.rateLimit.deleteMany({ where: { key } });
    }
  });
});
