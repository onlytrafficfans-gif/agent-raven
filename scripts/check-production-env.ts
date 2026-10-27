import { resolve } from "node:path";
import nextEnv from "@next/env";
import { checkProductionEnvironment } from "../src/lib/deployment-env";

nextEnv.loadEnvConfig(resolve(import.meta.dirname, ".."));

const result = checkProductionEnvironment(process.env);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

if (!result.valid) process.exitCode = 1;
