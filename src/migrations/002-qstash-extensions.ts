import type mysql from "mysql2/promise";
import type { MigrationFn } from "umzug";

const up: MigrationFn = async ({ context }) => {
  const conn = context as mysql.Pool;

  try {
    await conn.execute("ALTER TABLE messages ADD COLUMN queue_name VARCHAR(255)");
  } catch {}

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS schedules (
      id                     VARCHAR(255) PRIMARY KEY,
      destination            TEXT NOT NULL,
      cron                   VARCHAR(255) NOT NULL,
      method                 VARCHAR(10) NOT NULL,
      body                   LONGBLOB NOT NULL,
      forward_headers_json   LONGTEXT NOT NULL,
      retries                INT NOT NULL,
      timeout_ms             INT NOT NULL,
      callback_url           TEXT,
      failure_callback_url   TEXT,
      last_run_ms            BIGINT,
      next_run_ms            BIGINT NOT NULL,
      created_ms             BIGINT NOT NULL,
      updated_ms             BIGINT NOT NULL,
      INDEX idx_schedules_next_run (next_run_ms)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS queues (
      name        VARCHAR(255) PRIMARY KEY,
      parallelism INT NOT NULL DEFAULT 1,
      created_ms  BIGINT NOT NULL,
      updated_ms  BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS url_groups (
      name             VARCHAR(255) PRIMARY KEY,
      endpoints_json   LONGTEXT NOT NULL,
      created_ms       BIGINT NOT NULL,
      updated_ms       BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id          VARCHAR(255) PRIMARY KEY,
      type        VARCHAR(50) NOT NULL,
      message_id  VARCHAR(255),
      data_json   LONGTEXT,
      created_ms  BIGINT NOT NULL,
      INDEX idx_events_created (created_ms)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS dlq (
      id                     VARCHAR(255) PRIMARY KEY,
      message_id             VARCHAR(255) NOT NULL,
      destination            TEXT NOT NULL,
      method                 VARCHAR(10) NOT NULL,
      body                   LONGBLOB NOT NULL,
      forward_headers_json   LONGTEXT NOT NULL,
      last_error             TEXT NOT NULL,
      created_ms             BIGINT NOT NULL,
      INDEX idx_dlq_created (created_ms)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

const down: MigrationFn = async ({ context }) => {
  const conn = context as mysql.Pool;

  await conn.execute("DROP TABLE IF EXISTS schedules");
  await conn.execute("DROP TABLE IF EXISTS queues");
  await conn.execute("DROP TABLE IF EXISTS url_groups");
  await conn.execute("DROP TABLE IF EXISTS events");
  await conn.execute("DROP TABLE IF EXISTS dlq");
};

export { up, down };
