import mysql from "mysql2/promise";

export type MessageStatus = "pending" | "in_flight" | "delivered" | "failed" | "cancelled";

export interface MessageRow {
  id: string;
  destination: string;
  method: string;
  body: Uint8Array;
  forwardHeaders: Record<string, string>;
  retries: number;
  attempt: number;
  notBeforeMs: number;
  timeoutMs: number;
  callbackUrl: string | null;
  failureCallbackUrl: string | null;
  status: MessageStatus;
  lastError: string | null;
  createdMs: number;
  updatedMs: number;
}

export interface InsertMessage {
  id: string;
  destination: string;
  method: string;
  body: Uint8Array;
  forwardHeaders: Record<string, string>;
  retries: number;
  notBeforeMs: number;
  timeoutMs: number;
  callbackUrl: string | null;
  failureCallbackUrl: string | null;
}

export interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const SCHEMA = `
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
  INDEX idx_messages_pending (status, not_before_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

export interface Db {
  insertMessage: (msg: InsertMessage) => Promise<void>;
  getMessage: (id: string) => Promise<MessageRow | null>;
  cancelMessage: (id: string) => Promise<boolean>;
  claimDue: (limit: number, now: number) => Promise<MessageRow[]>;
  markDelivered: (id: string, now: number) => Promise<void>;
  markFailed: (id: string, error: string, now: number) => Promise<void>;
  rescheduleRetry: (
    id: string,
    attempt: number,
    notBeforeMs: number,
    error: string,
    now: number,
  ) => Promise<void>;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

export async function openDb(config: MySQLConfig): Promise<Db> {
  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  const conn = await pool.getConnection();
  await conn.query(SCHEMA);
  conn.release();

  async function insertMessage(msg: InsertMessage): Promise<void> {
    const now = Date.now();
    await pool.execute(
      `INSERT INTO messages (
        id, destination, method, body, forward_headers_json,
        retries, attempt, not_before_ms, timeout_ms,
        callback_url, failure_callback_url, status,
        created_ms, updated_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        msg.id,
        msg.destination,
        msg.method,
        msg.body,
        JSON.stringify(msg.forwardHeaders),
        msg.retries,
        0,
        msg.notBeforeMs,
        msg.timeoutMs,
        msg.callbackUrl,
        msg.failureCallbackUrl,
        "pending",
        now,
        now,
      ],
    );
  }

  async function getMessage(id: string): Promise<MessageRow | null> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM messages WHERE id = ?",
      [id],
    );
    if (rows.length === 0) return null;
    return rowToMessage(rows[0]!);
  }

  async function cancelMessage(id: string): Promise<boolean> {
    const now = Date.now();
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      "UPDATE messages SET status = 'cancelled', updated_ms = ? WHERE id = ? AND status = 'pending'",
      [now, id],
    );
    return result.affectedRows > 0;
  }

  async function claimDue(limit: number, now: number): Promise<MessageRow[]> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute<mysql.RowDataPacket[]>(
        `SELECT * FROM messages 
         WHERE status = 'pending' AND not_before_ms <= ? 
         ORDER BY not_before_ms 
         LIMIT ${Number.parseInt(String(limit), 10)} FOR UPDATE`,
        [now],
      );
      const claimed: MessageRow[] = [];
      for (const row of rows) {
        await conn.execute(
          "UPDATE messages SET status = 'in_flight', updated_ms = ? WHERE id = ?",
          [now, row.id],
        );
        claimed.push(rowToMessage({ ...row, status: "in_flight", updated_ms: now }));
      }
      await conn.commit();
      return claimed;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async function markDelivered(id: string, now: number): Promise<void> {
    await pool.execute(
      "UPDATE messages SET status = 'delivered', updated_ms = ?, last_error = NULL WHERE id = ?",
      [now, id],
    );
  }

  async function markFailed(id: string, error: string, now: number): Promise<void> {
    await pool.execute(
      "UPDATE messages SET status = 'failed', last_error = ?, updated_ms = ? WHERE id = ?",
      [error, now, id],
    );
  }

  async function rescheduleRetry(
    id: string,
    attempt: number,
    notBeforeMs: number,
    error: string,
    now: number,
  ): Promise<void> {
    await pool.execute(
      `UPDATE messages
       SET status = 'pending',
           attempt = ?,
           not_before_ms = ?,
           last_error = ?,
           updated_ms = ?
       WHERE id = ?`,
      [attempt, notBeforeMs, error, now, id],
    );
  }

  async function reset(): Promise<void> {
    await pool.execute("DELETE FROM messages");
  }

  async function close(): Promise<void> {
    await pool.end();
  }

  function rowToMessage(row: mysql.RowDataPacket): MessageRow {
    return {
      id: row.id,
      destination: row.destination,
      method: row.method,
      body: toUint8(row.body),
      forwardHeaders: JSON.parse(row.forward_headers_json) as Record<string, string>,
      retries: row.retries,
      attempt: row.attempt,
      notBeforeMs: row.not_before_ms,
      timeoutMs: row.timeout_ms,
      callbackUrl: row.callback_url,
      failureCallbackUrl: row.failure_callback_url,
      status: row.status,
      lastError: row.last_error,
      createdMs: row.created_ms,
      updatedMs: row.updated_ms,
    };
  }

  return {
    insertMessage,
    getMessage,
    cancelMessage,
    claimDue,
    markDelivered,
    markFailed,
    rescheduleRetry,
    reset,
    close,
  };
}

function toUint8(value: Buffer | Uint8Array): Uint8Array {
  if (value instanceof Uint8Array) return value;
  return new Uint8Array(value);
}