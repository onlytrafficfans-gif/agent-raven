import nextEnv from "@next/env";
import { resolve } from "node:path";

nextEnv.loadEnvConfig(resolve(import.meta.dirname, ".."));
const [{ inspectCredentialRotation, rotateStoredCredentials }, { db }] = await Promise.all([
  import("../src/lib/credential-rotation"),
  import("../src/lib/db"),
]);

const execute = process.argv.includes("--execute");
const unexpected = process.argv.slice(2).filter((argument) => argument !== "--execute");
if (unexpected.length) throw new Error(`Unknown argument: ${unexpected[0]}`);

try {
  const result = execute ? await rotateStoredCredentials() : await inspectCredentialRotation();
  process.stdout.write(`${JSON.stringify({ status: execute ? "completed" : "dry-run", ...result }, null, 2)}\n`);
} catch {
  process.stdout.write(`${JSON.stringify({ status: "failed", error: "Credential rotation could not decrypt every stored integration credential." }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
