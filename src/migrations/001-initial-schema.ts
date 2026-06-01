import type mysql from "mysql2/promise";
import type { MigrationFn } from "umzug";

const up: MigrationFn = async ({ context }) => {
  const conn = context as mysql.Pool;

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id                     VARCHAR(255) PRIMARY KEY,
      destination            TEXT NOT NULL,
      method                 VARCHAR(10) NOT NULL,
      body                   LONGBLOB NOT NULL,
      forward_headers_json   LONGTEXT NOT NULL,
      retries                INT NOT NULL,
      attempt                INT NOT NULL DEFAULT 0,
      not_before_ms          BIGINT NOT NULL,
      timeout_ms             INT NOT NULL,
      callback_url           TEXT,
      failure_callback_url   TEXT,
      status                 VARCHAR(20) NOT NULL,
      last_error             TEXT,
      created_ms             BIGINT NOT NULL,
      updated_ms             BIGINT NOT NULL,
      queue_name             VARCHAR(255),
      INDEX idx_messages_pending (status, not_before_ms),
      INDEX idx_messages_queue (queue_name, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS tokens (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      token        VARCHAR(255) NOT NULL UNIQUE,
      app_name     VARCHAR(255) NOT NULL,
      created_at   BIGINT NOT NULL,
      last_used_at BIGINT,
      INDEX idx_token (token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

const down: MigrationFn = async ({ context }) => {
  const conn = context as mysql.Pool;

  await conn.execute("DROP TABLE IF EXISTS messages");
  await conn.execute("DROP TABLE IF EXISTS tokens");
};

export { up, down };
