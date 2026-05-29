#!/usr/bin/env bun
import { type ConfigOverrides, type LogLevel, resolveConfig } from "./config.ts";
import { openDb } from "./db.ts";
import { createLogger } from "./logger.ts";
import { createRedisStore } from "./redis/mysql-store.ts";
import { createServer } from "./server.ts";
import { createWorker } from "./worker/loop.ts";

interface ParsedArgs {
  command: "serve" | "reset" | "keys" | "help";
  overrides: ConfigOverrides;
  quiet: boolean;
}

const VALUE_FLAGS = new Set([
  "port",
  "mysql-host",
  "mysql-port",
  "mysql-user",
  "mysql-password",
  "mysql-database",
  "tick-ms",
  "current-signing-key",
  "next-signing-key",
  "log-level",
  "redis-token",
]);

function parseArgs(argv: string[]): ParsedArgs {
  const overrides: ConfigOverrides = {};
  let quiet = false;
  let command: ParsedArgs["command"] = "serve";
  let commandFound = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) {
      if (commandFound) {
        console.error(`unexpected argument: ${arg}`);
        process.exit(2);
      }
      if (arg === "serve" || arg === "reset" || arg === "keys" || arg === "help") {
        command = arg;
        commandFound = true;
        continue;
      }
      console.error(`unknown command: ${arg}`);
      process.exit(2);
    }

    const eqIdx = arg.indexOf("=");
    let name: string;
    let value: string | undefined;
    if (eqIdx >= 0) {
      name = arg.slice(2, eqIdx);
      value = arg.slice(eqIdx + 1);
    } else {
      name = arg.slice(2);
      if (VALUE_FLAGS.has(name)) {
        const next = argv[i + 1];
        if (next === undefined) {
          console.error(`flag --${name} requires a value`);
          process.exit(2);
        }
        value = next;
        i++;
      }
    }
    switch (name) {
      case "port":
        overrides.port = requireInt(name, value);
        break;
      case "mysql-host":
        overrides.mysql = { ...overrides.mysql, host: requireValue(name, value) };
        break;
      case "mysql-port":
        overrides.mysql = { ...overrides.mysql, port: requireInt(name, value) };
        break;
      case "mysql-user":
        overrides.mysql = { ...overrides.mysql, user: requireValue(name, value) };
        break;
      case "mysql-password":
        overrides.mysql = { ...overrides.mysql, password: requireValue(name, value) };
        break;
      case "mysql-database":
        overrides.mysql = { ...overrides.mysql, database: requireValue(name, value) };
        break;
      case "tick-ms":
        overrides.tickMs = requireInt(name, value);
        break;
      case "current-signing-key":
        overrides.currentSigningKey = requireValue(name, value);
        break;
      case "next-signing-key":
        overrides.nextSigningKey = requireValue(name, value);
        break;
      case "log-level":
        overrides.logLevel = requireValue(name, value) as LogLevel;
        break;
      case "redis-token":
        overrides.redisToken = requireValue(name, value);
        break;
      case "quiet":
        quiet = true;
        break;
      case "help":
        command = "help";
        break;
      default:
        console.error(`unknown flag: --${name}`);
        process.exit(2);
    }
  }

  if (quiet && overrides.logLevel === undefined) {
    overrides.logLevel = "warn";
  }

  return { command, overrides, quiet };
}

function requireValue(name: string, value: string | undefined): string {
  if (value === undefined || value === "") {
    console.error(`flag --${name} requires a value`);
    process.exit(2);
  }
  return value;
}

function requireInt(name: string, value: string | undefined): number {
  const raw = requireValue(name, value);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    console.error(`flag --${name} must be a non-negative integer, got: ${raw}`);
    process.exit(2);
  }
  return parsed;
}

function printHelp(): void {
  console.log(`downstash - local Upstash-compatible dev server (QStash + Redis)

usage:
  downstash                        start the server (default port 8080)
  downstash serve                  explicit serve subcommand
  downstash reset                  truncate the messages table
  downstash keys                   print signing keys and Redis config for .env.local
  downstash help                   show this help

MySQL configuration (required):
  --mysql-host <host>              MySQL host (env: DOWNSTASH_MYSQL_HOST, default localhost)
  --mysql-port <n>                 MySQL port (env: DOWNSTASH_MYSQL_PORT, default 3306)
  --mysql-user <user>              MySQL user (env: DOWNSTASH_MYSQL_USER, default root)
  --mysql-password <password>      MySQL password (env: DOWNSTASH_MYSQL_PASSWORD)
  --mysql-database <db>            MySQL database (env: DOWNSTASH_MYSQL_DATABASE, default downstash)

Other flags:
  --port <n>                       HTTP port (env: DOWNSTASH_PORT, default 8080)
  --tick-ms <n>                    delivery loop interval (env: DOWNSTASH_TICK_MS, default 250)
  --current-signing-key <s>        override current key (env: DOWNSTASH_CURRENT_SIGNING_KEY)
  --next-signing-key <s>           override next key (env: DOWNSTASH_NEXT_SIGNING_KEY)
  --redis-token <s>                Redis auth token (env: DOWNSTASH_REDIS_TOKEN, default "dev")
  --log-level <debug|info|warn|error>   log verbosity (env: DOWNSTASH_LOG_LEVEL)
  --quiet                          shorthand for --log-level=warn
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = resolveConfig(args.overrides);

  if (args.command === "help") {
    printHelp();
    return;
  }

  if (args.command === "keys") {
    console.log(`QSTASH_CURRENT_SIGNING_KEY=${config.currentSigningKey}`);
    console.log(`QSTASH_NEXT_SIGNING_KEY=${config.nextSigningKey}`);
    console.log(`UPSTASH_REDIS_REST_URL=http://localhost:${config.port}`);
    console.log(`UPSTASH_REDIS_REST_TOKEN=${config.redisToken}`);
    console.log(`DOWNSTASH_MYSQL_HOST=${config.mysql.host}`);
    console.log(`DOWNSTASH_MYSQL_PORT=${config.mysql.port}`);
    console.log(`DOWNSTASH_MYSQL_USER=${config.mysql.user}`);
    console.log(`DOWNSTASH_MYSQL_DATABASE=${config.mysql.database}`);
    return;
  }

  if (args.command === "reset") {
    const db = await openDb(config.mysql);
    await db.reset();
    await db.close();
    console.log(`reset: cleared messages in MySQL database ${config.mysql.database}`);
    return;
  }

  const logger = createLogger(config.logLevel);
  const db = await openDb(config.mysql);
  const redisStore = await createRedisStore(config.mysql);
  const app = createServer({ db, logger, redisStore, redisToken: config.redisToken });
  const worker = createWorker({
    db,
    logger,
    currentSigningKey: config.currentSigningKey,
    tickMs: config.tickMs,
  });

  const server = Bun.serve({
    port: config.port,
    fetch: app.fetch,
  });
  worker.start();

  logger.info("downstash listening", {
    port: config.port,
    mysql: config.mysql,
    tickMs: config.tickMs,
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("shutting down", { signal });
    await worker.stop();
    server.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

await main();