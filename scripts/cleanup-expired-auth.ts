import nextEnv from "@next/env";
import { resolve } from "node:path";

nextEnv.loadEnvConfig(resolve(import.meta.dirname, ".."));
const [{ cleanupExpiredAuthData, inspectExpiredAuthData }, { db }] = await Promise.all([
  import("../src/lib/auth-retention"),
  import("../src/lib/db"),
]);

const execute = process.argv.includes("--execute");
const unexpected = process.argv.slice(2).filter((argument) => argument !== "--execute");
if (unexpected.length) throw new Error(`Unknown argument: ${unexpected[0]}`);

const cutoff = new Date();

try {
  const before = await inspectExpiredAuthData(cutoff);
  const deleted = execute ? await cleanupExpiredAuthData(cutoff) : { expiredSessions: 0, expiredVerifications: 0 };
  const after = execute ? await inspectExpiredAuthData(cutoff) : before;
  process.stdout.write(`${JSON.stringify({
    status: execute ? "completed" : "dry-run",
    cutoff: cutoff.toISOString(),
    before,
    deleted,
    after,
  }, null, 2)}\n`);
} finally {
  await db.$disconnect();
}
