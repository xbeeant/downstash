import mysql from "mysql2/promise";
import { Umzug } from "umzug";
import { newMessageId } from "./ids.js";
import * as initialSchema from "./migrations/001-initial-schema.js";
import * as qstashExtensions from "./migrations/002-qstash-extensions.js";
import * as tokenSigningKeys from "./migrations/003-token-signing-keys.js";

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
  queueName: string | null;
  tokenId: number | null;
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
  queueName?: string | null;
  tokenId?: number | null;
}

export interface ScheduleRow {
  id: string;
  destination: string;
  cron: string;
  method: string;
  body: Uint8Array;
  forwardHeaders: Record<string, string>;
  retries: number;
  timeoutMs: number;
  callbackUrl: string | null;
  failureCallbackUrl: string | null;
  lastRunMs: number | null;
  nextRunMs: number;
  createdMs: number;
  updatedMs: number;
  tokenId: number | null;
}

export interface InsertSchedule {
  id: string;
  destination: string;
  cron: string;
  method: string;
  body: Uint8Array;
  forwardHeaders: Record<string, string>;
  retries: number;
  timeoutMs: number;
  callbackUrl: string | null;
  failureCallbackUrl: string | null;
  nextRunMs: number;
  tokenId?: number | null;
}

export interface QueueRow {
  name: string;
  parallelism: number;
  createdMs: number;
  updatedMs: number;
}

export interface UrlGroupRow {
  name: string;
  endpoints: { url: string }[];
  createdMs: number;
  updatedMs: number;
}

export interface EventRow {
  id: string;
  type: string;
  messageId: string | null;
  data: Record<string, unknown> | null;
  createdMs: number;
}

export interface DlqRow {
  id: string;
  messageId: string;
  destination: string;
  method: string;
  body: Uint8Array;
  forwardHeaders: Record<string, string>;
  lastError: string;
  createdMs: number;
}

export interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface TokenRow {
  id: number;
  token: string;
  appName: string;
  createdAt: number;
  lastUsedAt: number | null;
  currentSigningKey: string;
  nextSigningKey: string;
}

export interface TokenStore {
  createToken: (appName: string) => Promise<{ token: string; appName: string }>;
  verifyToken: (token: string) => Promise<TokenRow | null>;
  verifyTokenByUserId: (userId: number) => Promise<TokenRow | null>;
  listTokens: () => Promise<Omit<TokenRow, "token">[]>;
  revokeToken: (token: string) => Promise<boolean>;
  updateLastUsed: (token: string) => Promise<void>;
  updateSigningKeys: (tokenId: number, currentSigningKey: string, nextSigningKey: string) => Promise<void>;
}

export interface Db extends TokenStore {
  insertMessage: (msg: InsertMessage) => Promise<void>;
  getMessage: (id: string) => Promise<MessageRow | null>;
  listMessages: () => Promise<MessageRow[]>;
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
  moveToDlq: (id: string, error: string, now: number) => Promise<void>;
  insertSchedule: (schedule: InsertSchedule) => Promise<void>;
  getSchedule: (id: string) => Promise<ScheduleRow | null>;
  listSchedules: () => Promise<ScheduleRow[]>;
  deleteSchedule: (id: string) => Promise<boolean>;
  claimDueSchedules: (now: number) => Promise<ScheduleRow[]>;
  updateScheduleNextRun: (id: string, lastRunMs: number, nextRunMs: number) => Promise<void>;
  insertQueue: (name: string, parallelism?: number) => Promise<void>;
  getQueue: (name: string) => Promise<QueueRow | null>;
  listQueues: () => Promise<QueueRow[]>;
  deleteQueue: (name: string) => Promise<boolean>;
  upsertUrlGroup: (name: string, endpoints: { url: string }[]) => Promise<void>;
  getUrlGroup: (name: string) => Promise<UrlGroupRow | null>;
  listUrlGroups: () => Promise<UrlGroupRow[]>;
  deleteUrlGroup: (name: string) => Promise<boolean>;
  insertEvent: (type: string, messageId?: string, data?: Record<string, unknown>) => Promise<void>;
  listEvents: () => Promise<EventRow[]>;
  listDlq: () => Promise<DlqRow[]>;
  getDlq: (id: string) => Promise<DlqRow | null>;
  deleteDlq: (id: string) => Promise<boolean>;
  requeueDlq: (id: string) => Promise<string | null>;
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

  const umzug = new Umzug({
    logger: console,
    migrations: [
      { name: "001-initial-schema", up: initialSchema.up, down: initialSchema.down },
      { name: "002-qstash-extensions", up: qstashExtensions.up, down: qstashExtensions.down },
      { name: "003-token-signing-keys", up: tokenSigningKeys.up, down: tokenSigningKeys.down },
    ],
    context: pool,
    storage: {
      async logMigration({ name }) {
        await pool.execute("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)", [
          name,
          Date.now(),
        ]);
      },
      async unlogMigration({ name }) {
        await pool.execute("DELETE FROM schema_migrations WHERE name = ?", [name]);
      },
      async executed() {
        try {
          await pool.execute(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
              name VARCHAR(255) PRIMARY KEY,
              applied_at BIGINT NOT NULL
            )
          `);
          const [rows] = await pool.execute<mysql.RowDataPacket[]>(
            "SELECT name FROM schema_migrations ORDER BY applied_at",
          );
          return rows.map((r) => r.name as string);
        } catch {
          return [];
        }
      },
    },
  });

  await umzug.up();

  async function insertMessage(msg: InsertMessage): Promise<void> {
    const now = Date.now();
    await pool.execute(
      `INSERT INTO messages (
        id, destination, method, body, forward_headers_json,
        retries, attempt, not_before_ms, timeout_ms,
        callback_url, failure_callback_url, status,
        created_ms, updated_ms, queue_name, token_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        msg.queueName || null,
        msg.tokenId ?? null,
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
    await pool.execute("DELETE FROM schedules");
    await pool.execute("DELETE FROM queues");
    await pool.execute("DELETE FROM url_groups");
    await pool.execute("DELETE FROM events");
    await pool.execute("DELETE FROM dlq");
  }

  async function close(): Promise<void> {
    await pool.end();
  }

  async function listMessages(): Promise<MessageRow[]> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM messages ORDER BY created_ms DESC",
    );
    return rows.map(rowToMessage);
  }

  async function moveToDlq(id: string, error: string, now: number): Promise<void> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM messages WHERE id = ?",
      [id],
    );
    if (rows.length === 0) return;

    const msg = rowToMessage(rows[0]!);
    const dlqId = newMessageId();
    await pool.execute(
      `INSERT INTO dlq (
        id, message_id, destination, method, body,
        forward_headers_json, last_error, created_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dlqId,
        msg.id,
        msg.destination,
        msg.method,
        msg.body,
        JSON.stringify(msg.forwardHeaders),
        error,
        now,
      ],
    );
    await pool.execute("DELETE FROM messages WHERE id = ?", [id]);
    await insertEvent("dlq.message_added", msg.id, { error });
  }

  async function insertSchedule(schedule: InsertSchedule): Promise<void> {
    const now = Date.now();
    await pool.execute(
      `INSERT INTO schedules (
        id, destination, cron, method, body,
        forward_headers_json, retries, timeout_ms,
        callback_url, failure_callback_url,
        last_run_ms, next_run_ms, created_ms, updated_ms, token_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schedule.id,
        schedule.destination,
        schedule.cron,
        schedule.method,
        schedule.body,
        JSON.stringify(schedule.forwardHeaders),
        schedule.retries,
        schedule.timeoutMs,
        schedule.callbackUrl,
        schedule.failureCallbackUrl,
        null,
        schedule.nextRunMs,
        now,
        now,
        schedule.tokenId ?? null,
      ],
    );
  }

  async function getSchedule(id: string): Promise<ScheduleRow | null> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM schedules WHERE id = ?",
      [id],
    );
    if (rows.length === 0) return null;
    return rowToSchedule(rows[0]!);
  }

  async function listSchedules(): Promise<ScheduleRow[]> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM schedules ORDER BY created_ms DESC",
    );
    return rows.map(rowToSchedule);
  }

  async function deleteSchedule(id: string): Promise<boolean> {
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      "DELETE FROM schedules WHERE id = ?",
      [id],
    );
    return result.affectedRows > 0;
  }

  async function claimDueSchedules(now: number): Promise<ScheduleRow[]> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM schedules WHERE next_run_ms <= ?",
      [now],
    );
    return rows.map(rowToSchedule);
  }

  async function updateScheduleNextRun(
    id: string,
    lastRunMs: number,
    nextRunMs: number,
  ): Promise<void> {
    const now = Date.now();
    await pool.execute(
      "UPDATE schedules SET last_run_ms = ?, next_run_ms = ?, updated_ms = ? WHERE id = ?",
      [lastRunMs, nextRunMs, now, id],
    );
  }

  async function insertQueue(name: string, parallelism = 1): Promise<void> {
    const now = Date.now();
    await pool.execute(
      `INSERT INTO queues (name, parallelism, created_ms, updated_ms)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE parallelism = VALUES(parallelism), updated_ms = VALUES(updated_ms)`,
      [name, parallelism, now, now],
    );
  }

  async function getQueue(name: string): Promise<QueueRow | null> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM queues WHERE name = ?",
      [name],
    );
    if (rows.length === 0) return null;
    return {
      name: rows[0].name,
      parallelism: rows[0].parallelism,
      createdMs: rows[0].created_ms,
      updatedMs: rows[0].updated_ms,
    };
  }

  async function listQueues(): Promise<QueueRow[]> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM queues ORDER BY created_ms DESC",
    );
    return rows.map((row) => ({
      name: row.name,
      parallelism: row.parallelism,
      createdMs: row.created_ms,
      updatedMs: row.updated_ms,
    }));
  }

  async function deleteQueue(name: string): Promise<boolean> {
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      "DELETE FROM queues WHERE name = ?",
      [name],
    );
    return result.affectedRows > 0;
  }

  async function upsertUrlGroup(name: string, endpoints: { url: string }[]): Promise<void> {
    const now = Date.now();
    await pool.execute(
      `INSERT INTO url_groups (name, endpoints_json, created_ms, updated_ms)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE endpoints_json = VALUES(endpoints_json), updated_ms = VALUES(updated_ms)`,
      [name, JSON.stringify(endpoints), now, now],
    );
  }

  async function getUrlGroup(name: string): Promise<UrlGroupRow | null> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM url_groups WHERE name = ?",
      [name],
    );
    if (rows.length === 0) return null;
    return {
      name: rows[0].name,
      endpoints: JSON.parse(rows[0].endpoints_json) as { url: string }[],
      createdMs: rows[0].created_ms,
      updatedMs: rows[0].updated_ms,
    };
  }

  async function listUrlGroups(): Promise<UrlGroupRow[]> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM url_groups ORDER BY created_ms DESC",
    );
    return rows.map((row) => ({
      name: row.name,
      endpoints: JSON.parse(row.endpoints_json) as { url: string }[],
      createdMs: row.created_ms,
      updatedMs: row.updated_ms,
    }));
  }

  async function deleteUrlGroup(name: string): Promise<boolean> {
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      "DELETE FROM url_groups WHERE name = ?",
      [name],
    );
    return result.affectedRows > 0;
  }

  async function insertEvent(
    type: string,
    messageId?: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const id = newMessageId();
    const now = Date.now();
    await pool.execute(
      "INSERT INTO events (id, type, message_id, data_json, created_ms) VALUES (?, ?, ?, ?, ?)",
      [id, type, messageId || null, data ? JSON.stringify(data) : null, now],
    );
  }

  async function listEvents(): Promise<EventRow[]> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM events ORDER BY created_ms DESC LIMIT 1000",
    );
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      messageId: row.message_id,
      data: row.data_json ? (JSON.parse(row.data_json) as Record<string, unknown>) : null,
      createdMs: row.created_ms,
    }));
  }

  async function listDlq(): Promise<DlqRow[]> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM dlq ORDER BY created_ms DESC",
    );
    return rows.map(rowToDlq);
  }

  async function getDlq(id: string): Promise<DlqRow | null> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>("SELECT * FROM dlq WHERE id = ?", [
      id,
    ]);
    if (rows.length === 0) return null;
    return rowToDlq(rows[0]!);
  }

  async function deleteDlq(id: string): Promise<boolean> {
    const [result] = await pool.execute<mysql.ResultSetHeader>("DELETE FROM dlq WHERE id = ?", [
      id,
    ]);
    return result.affectedRows > 0;
  }

  async function requeueDlq(id: string): Promise<string | null> {
    const dlqItem = await getDlq(id);
    if (!dlqItem) return null;

    const newMsgId = newMessageId();
    await insertMessage({
      id: newMsgId,
      destination: dlqItem.destination,
      method: dlqItem.method,
      body: dlqItem.body,
      forwardHeaders: dlqItem.forwardHeaders,
      retries: 3,
      notBeforeMs: Date.now(),
      timeoutMs: 30_000,
      callbackUrl: null,
      failureCallbackUrl: null,
    });

    await deleteDlq(id);
    await insertEvent("dlq.message_requeued", dlqItem.messageId, { newMessageId: newMsgId });

    return newMsgId;
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
      status: row.status as MessageStatus,
      lastError: row.last_error,
      createdMs: row.created_ms,
      updatedMs: row.updated_ms,
      queueName: row.queue_name || null,
      tokenId: row.token_id || null,
    };
  }

  function rowToSchedule(row: mysql.RowDataPacket): ScheduleRow {
    return {
      id: row.id,
      destination: row.destination,
      cron: row.cron,
      method: row.method,
      body: toUint8(row.body),
      forwardHeaders: JSON.parse(row.forward_headers_json) as Record<string, string>,
      retries: row.retries,
      timeoutMs: row.timeout_ms,
      callbackUrl: row.callback_url,
      failureCallbackUrl: row.failure_callback_url,
      lastRunMs: row.last_run_ms,
      nextRunMs: row.next_run_ms,
      createdMs: row.created_ms,
      updatedMs: row.updated_ms,
      tokenId: row.token_id || null,
    };
  }

  function rowToDlq(row: mysql.RowDataPacket): DlqRow {
    return {
      id: row.id,
      messageId: row.message_id,
      destination: row.destination,
      method: row.method,
      body: toUint8(row.body),
      forwardHeaders: JSON.parse(row.forward_headers_json) as Record<string, string>,
      lastError: row.last_error,
      createdMs: row.created_ms,
    };
  }

  function generateToken(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function rowToToken(row: mysql.RowDataPacket): TokenRow {
    return {
      id: row.id,
      token: row.token,
      appName: row.app_name,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      currentSigningKey: row.current_signing_key,
      nextSigningKey: row.next_signing_key,
    };
  }

  function generateSigningKey(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "sig_";
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async function createToken(appName: string): Promise<{ token: string; appName: string }> {
    const token = generateToken();
    const currentSigningKey = generateSigningKey();
    const nextSigningKey = generateSigningKey();
    const now = Date.now();
    await pool.execute(
      "INSERT INTO tokens (token, app_name, created_at, current_signing_key, next_signing_key) VALUES (?, ?, ?, ?, ?)",
      [token, appName, now, currentSigningKey, nextSigningKey],
    );
    return { token, appName };
  }

  async function updateSigningKeys(
    tokenId: number,
    currentSigningKey: string,
    nextSigningKey: string,
  ): Promise<void> {
    await pool.execute(
      "UPDATE tokens SET current_signing_key = ?, next_signing_key = ? WHERE id = ?",
      [currentSigningKey, nextSigningKey, tokenId],
    );
  }

  async function verifyToken(token: string): Promise<TokenRow | null> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM tokens WHERE token = ?",
      [token],
    );
    if (rows.length === 0) return null;
    return rowToToken(rows[0]!);
  }

  async function verifyTokenByUserId(userId: number): Promise<TokenRow | null> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM tokens WHERE id = ?",
      [userId],
    );
    if (rows.length === 0) return null;
    return rowToToken(rows[0]!);
  }

  async function listTokens(): Promise<Omit<TokenRow, "token">[]> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT id, app_name, created_at, last_used_at, current_signing_key, next_signing_key FROM tokens ORDER BY created_at DESC",
    );
    return rows.map((r) => ({
      id: r.id,
      appName: r.app_name,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
      currentSigningKey: r.current_signing_key,
      nextSigningKey: r.next_signing_key,
    }));
  }

  async function revokeToken(token: string): Promise<boolean> {
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      "DELETE FROM tokens WHERE token = ?",
      [token],
    );
    return result.affectedRows > 0;
  }

  async function updateLastUsed(token: string): Promise<void> {
    const now = Date.now();
    await pool.execute("UPDATE tokens SET last_used_at = ? WHERE token = ?", [now, token]);
  }

  return {
    insertMessage,
    getMessage,
    listMessages,
    cancelMessage,
    claimDue,
    markDelivered,
    markFailed,
    rescheduleRetry,
    moveToDlq,
    insertSchedule,
    getSchedule,
    listSchedules,
    deleteSchedule,
    claimDueSchedules,
    updateScheduleNextRun,
    insertQueue,
    getQueue,
    listQueues,
    deleteQueue,
    upsertUrlGroup,
    getUrlGroup,
    listUrlGroups,
    deleteUrlGroup,
    insertEvent,
    listEvents,
    listDlq,
    getDlq,
    deleteDlq,
    requeueDlq,
    reset,
    close,
    createToken,
    verifyToken,
    verifyTokenByUserId,
    listTokens,
    revokeToken,
    updateLastUsed,
    updateSigningKeys,
  };
}

function toUint8(value: Buffer | Uint8Array): Uint8Array {
  if (value instanceof Uint8Array) return value;
  return new Uint8Array(value);
}
