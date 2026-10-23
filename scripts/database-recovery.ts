import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { accessSync, constants } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import nextEnv from "@next/env";

type Mode = "backup" | "drill";
type Counts = Record<string, number>;

const projectRoot = resolve(import.meta.dirname, "..");
nextEnv.loadEnvConfig(projectRoot);

const sourceUrl = requiredDatabaseUrl();
const source = new URL(sourceUrl);
const mode = process.argv[2] as Mode | undefined;
const startedAt = new Date();

if (mode !== "backup" && mode !== "drill") {
  fail("Usage: npm run db:backup or npm run db:restore-drill");
}

if (!isLocalHost(source.hostname) && process.env.ALLOW_REMOTE_RECOVERY_OPERATION !== "true") {
  fail("Remote database recovery operations require ALLOW_REMOTE_RECOVERY_OPERATION=true.");
}

const pgBin = resolvePostgresBin();
const recoveryRoot = join(projectRoot, ".recovery");
const backupRoot = join(recoveryRoot, "backups");
const reportRoot = join(recoveryRoot, "reports");
const stamp = startedAt.toISOString().replaceAll(":", "-").replaceAll(".", "-");
const backupPath = join(backupRoot, `agent-raven-${stamp}.dump`);

await mkdir(backupRoot, { recursive: true, mode: 0o700 });
await mkdir(reportRoot, { recursive: true, mode: 0o700 });

const dumpStarted = Date.now();
runPostgres("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", backupPath, ...connectionArgs(source)]);
await chmod(backupPath, 0o600);
const checksum = await sha256(backupPath);
await writeFile(`${backupPath}.sha256`, `${checksum}  ${basename(backupPath)}\n`, { mode: 0o600 });
const dumpDurationMs = Date.now() - dumpStarted;

if (mode === "backup") {
  process.stdout.write(`${JSON.stringify({ status: "backup-created", backupPath, sha256: checksum, durationMs: dumpDurationMs }, null, 2)}\n`);
  process.exit(0);
}

const drillDatabase = `agent_raven_restore_${Date.now()}_${randomBytes(3).toString("hex")}`;
const maintenance = databaseUrl(source, "postgres");
const restored = databaseUrl(source, drillDatabase);
let drillPassed = false;
let restoredCounts: Counts = {};

try {
  runPostgres("psql", [...connectionArgs(maintenance), "--set", "ON_ERROR_STOP=1", "--command", `CREATE DATABASE "${drillDatabase}" TEMPLATE template0`]);
  runPostgres("pg_restore", ["--exit-on-error", "--no-owner", "--no-acl", "--dbname", drillDatabase, ...serverArgs(restored), backupPath]);

  const sourceCounts = databaseCounts(source);
  restoredCounts = databaseCounts(restored);
  if (JSON.stringify(sourceCounts) !== JSON.stringify(restoredCounts)) {
    throw new Error(`Restored row counts differ from source. Source=${JSON.stringify(sourceCounts)} Restored=${JSON.stringify(restoredCounts)}`);
  }

  run("npx", ["prisma", "migrate", "status"], {
    ...process.env,
    DATABASE_URL: restored.toString(),
  });

  drillPassed = true;
} finally {
  runPostgres(
    "psql",
    [...connectionArgs(maintenance), "--set", "ON_ERROR_STOP=1", "--command", `DROP DATABASE IF EXISTS "${drillDatabase}" WITH (FORCE)`],
    undefined,
    drillPassed,
  );
}

const completedAt = new Date();
const report = {
  status: "passed",
  startedAt: startedAt.toISOString(),
  completedAt: completedAt.toISOString(),
  durationMs: completedAt.getTime() - startedAt.getTime(),
  dumpDurationMs,
  sourceDatabase: decodeURIComponent(source.pathname.slice(1)),
  isolatedRestoreDatabase: drillDatabase,
  backupPath,
  sha256: checksum,
  counts: restoredCounts,
  checks: {
    checksumCreated: true,
    isolatedDatabaseCreated: true,
    restoreCompleted: true,
    rowCountsMatch: true,
    migrationsCurrent: true,
    isolatedDatabaseRemoved: true,
  },
};
const reportPath = join(reportRoot, `restore-drill-${stamp}.json`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({ ...report, reportPath }, null, 2)}\n`);

function requiredDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) fail("DATABASE_URL is required.");
  const parsed = new URL(value);
  if (!parsed.protocol.startsWith("postgres")) fail("DATABASE_URL must use PostgreSQL.");
  return value;
}

function isLocalHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function resolvePostgresBin(): string {
  const candidates = [
    process.env.PG_BIN,
    join(projectRoot, ".runtime/postgres-root/usr/lib/postgresql/16/bin"),
    "/usr/lib/postgresql/16/bin",
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    try {
      accessSync(join(candidate, "pg_dump"), constants.X_OK);
      accessSync(join(candidate, "pg_restore"), constants.X_OK);
      accessSync(join(candidate, "psql"), constants.X_OK);
      return candidate;
    } catch {
      // Try the next known PostgreSQL tool location.
    }
  }
  fail("PostgreSQL client tools were not found. Set PG_BIN to their directory.");
}

function databaseUrl(base: URL, databaseName: string): URL {
  const result = new URL(base);
  result.pathname = `/${databaseName}`;
  result.searchParams.delete("schema");
  return result;
}

function serverArgs(url: URL): string[] {
  return ["--host", url.hostname, "--port", url.port || "5432", "--username", decodeURIComponent(url.username)];
}

function connectionArgs(url: URL): string[] {
  return [...serverArgs(url), "--dbname", decodeURIComponent(url.pathname.slice(1))];
}

function postgresEnv(url: URL): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
  const bundledLibraryPath = join(projectRoot, ".runtime/postgres-root/usr/lib/x86_64-linux-gnu");
  try {
    accessSync(bundledLibraryPath, constants.R_OK);
    env.LD_LIBRARY_PATH = [bundledLibraryPath, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
  } catch {
    // System PostgreSQL clients do not need the bundled runtime library path.
  }
  const sslMode = url.searchParams.get("sslmode");
  if (sslMode) env.PGSSLMODE = sslMode;
  return env;
}

function runPostgres(command: "pg_dump" | "pg_restore" | "psql", args: string[], url = source, quiet = false): string {
  return run(join(pgBin, command), args, postgresEnv(url), quiet);
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv, quiet = false): string {
  const result = spawnSync(command, args, { cwd: projectRoot, env, encoding: "utf8" });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${basename(command)} failed${detail ? `: ${detail}` : "."}`);
  }
  if (!quiet && result.stderr.trim()) process.stderr.write(result.stderr);
  return result.stdout.trim();
}

function databaseCounts(url: URL): Counts {
  const tables = [
    "User",
    "Session",
    "Account",
    "Verification",
    "Organization",
    "Membership",
    "IntegrationConnection",
    "SearchQuery",
    "SearchRun",
    "ProspectCompany",
    "ProspectNote",
    "Tag",
    "ProspectTag",
    "IntegrationUsage",
    "AuditLog",
    "_prisma_migrations",
  ];
  const pairs = tables.map((table) => `'${table}', (SELECT COUNT(*)::int FROM "${table}")`).join(", ");
  const output = runPostgres("psql", [...connectionArgs(url), "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--command", `SELECT json_build_object(${pairs})`], url, true);
  return JSON.parse(output) as Counts;
}

async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function fail(message: string): never {
  throw new Error(message);
}
