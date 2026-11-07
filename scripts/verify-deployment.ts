import { resolve } from "node:path";
import nextEnv from "@next/env";
import { verifyDeployment } from "../src/lib/deployment-verifier";

nextEnv.loadEnvConfig(resolve(import.meta.dirname, ".."));

const result = await verifyDeployment(process.env.DEPLOYMENT_URL, {
  allowInsecureLoopback: process.env.DEPLOYMENT_VERIFY_ALLOW_HTTP === "true",
});
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

if (!result.valid) process.exitCode = 1;
