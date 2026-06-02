import type mysql from "mysql2/promise";
import type { MigrationFn } from "umzug";

const up: MigrationFn = async ({ context }) => {
  const conn = context as mysql.Pool;

  await conn.execute(`
    ALTER TABLE tokens 
    ADD COLUMN current_signing_key VARCHAR(255) NOT NULL DEFAULT 'sig_default_current',
    ADD COLUMN next_signing_key VARCHAR(255) NOT NULL DEFAULT 'sig_default_next'
  `);

  await conn.execute(`
    ALTER TABLE messages 
    ADD COLUMN token_id INT,
    ADD INDEX idx_messages_token (token_id),
    ADD CONSTRAINT fk_messages_token FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL
  `);

  await conn.execute(`
    ALTER TABLE schedules 
    ADD COLUMN token_id INT,
    ADD INDEX idx_schedules_token (token_id),
    ADD CONSTRAINT fk_schedules_token FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE SET NULL
  `);
};

const down: MigrationFn = async ({ context }) => {
  const conn = context as mysql.Pool;

  await conn.execute("ALTER TABLE messages DROP FOREIGN KEY fk_messages_token");
  await conn.execute("ALTER TABLE messages DROP COLUMN token_id");

  await conn.execute("ALTER TABLE schedules DROP FOREIGN KEY fk_schedules_token");
  await conn.execute("ALTER TABLE schedules DROP COLUMN token_id");

  await conn.execute("ALTER TABLE tokens DROP COLUMN current_signing_key");
  await conn.execute("ALTER TABLE tokens DROP COLUMN next_signing_key");
};

export { up, down };