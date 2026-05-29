import mysql from "mysql2/promise";
import { globToRegex } from "./glob.ts";

export type RedisType = "string" | "list" | "set" | "zset" | "hash";

interface RedisEntry {
  type: RedisType;
  value: string | string[] | Set<string> | Map<string, string> | Map<string, number>;
  expiresAt: number | null;
}

export interface SetOptions {
  ex?: number;
  px?: number;
  nx?: boolean;
  xx?: boolean;
  get?: boolean;
  exat?: number;
  pxat?: number;
  keepttl?: boolean;
}

export interface ScanOptions {
  match?: string;
  count?: number;
}

export interface ZAddOptions {
  nx?: boolean;
  xx?: boolean;
  gt?: boolean;
  lt?: boolean;
  ch?: boolean;
}

export interface ZRangeByScoreOptions {
  withScores?: boolean;
  limit?: { offset: number; count: number };
}

export interface RedisStore {
  set(key: string, value: string, opts?: SetOptions): Promise<string | null>;
  get(key: string): Promise<string | null>;
  mset(pairs: [string, string][]): Promise<void>;
  mget(keys: string[]): Promise<(string | null)[]>;
  incr(key: string): Promise<number>;
  incrby(key: string, increment: number): Promise<number>;
  incrbyfloat(key: string, increment: number): Promise<string>;
  decr(key: string): Promise<number>;
  decrby(key: string, decrement: number): Promise<number>;
  append(key: string, value: string): Promise<number>;
  strlen(key: string): Promise<number>;
  getrange(key: string, start: number, end: number): Promise<string>;
  setrange(key: string, offset: number, value: string): Promise<number>;
  getdel(key: string): Promise<string | null>;
  getex(key: string, opts?: SetOptions): Promise<string | null>;
  setnx(key: string, value: string): Promise<boolean>;
  setex(key: string, seconds: number, value: string): Promise<void>;
  psetex(key: string, ms: number, value: string): Promise<void>;

  del(keys: string[]): Promise<number>;
  exists(keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<boolean>;
  expireat(key: string, timestamp: number): Promise<boolean>;
  pexpire(key: string, ms: number): Promise<boolean>;
  pexpireat(key: string, ms: number): Promise<boolean>;
  ttl(key: string): Promise<number>;
  pttl(key: string): Promise<number>;
  persist(key: string): Promise<boolean>;
  rename(from: string, to: string): Promise<void>;
  type(key: string): Promise<string>;
  keys(pattern: string): Promise<string[]>;
  scan(cursor: number, opts?: ScanOptions): Promise<[number, string[]]>;
  unlink(keys: string[]): Promise<number>;
  dbsize(): Promise<number>;
  flushdb(): Promise<void>;
  flushall(): Promise<void>;
  randomkey(): Promise<string | null>;
  copy(source: string, dest: string, replace?: boolean): Promise<boolean>;

  hset(key: string, fields: [string, string][]): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hmset(key: string, fields: [string, string][]): Promise<void>;
  hmget(key: string, fields: string[]): Promise<(string | null)[]>;
  hgetall(key: string): Promise<string[]>;
  hdel(key: string, fields: string[]): Promise<number>;
  hexists(key: string, field: string): Promise<boolean>;
  hlen(key: string): Promise<number>;
  hkeys(key: string): Promise<string[]>;
  hvals(key: string): Promise<string[]>;
  hincrby(key: string, field: string, increment: number): Promise<number>;
  hincrbyfloat(key: string, field: string, increment: number): Promise<string>;
  hsetnx(key: string, field: string, value: string): Promise<boolean>;
  hscan(key: string, cursor: number, opts?: ScanOptions): Promise<[number, string[]]>;

  lpush(key: string, values: string[]): Promise<number>;
  rpush(key: string, values: string[]): Promise<number>;
  lpop(key: string, count?: number): Promise<string | string[] | null>;
  rpop(key: string, count?: number): Promise<string | string[] | null>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  llen(key: string): Promise<number>;
  lindex(key: string, index: number): Promise<string | null>;
  lset(key: string, index: number, value: string): Promise<void>;
  linsert(key: string, before: boolean, pivot: string, value: string): Promise<number>;
  lrem(key: string, count: number, value: string): Promise<number>;
  ltrim(key: string, start: number, stop: number): Promise<void>;

  sadd(key: string, members: string[]): Promise<number>;
  srem(key: string, members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sismember(key: string, member: string): Promise<boolean>;
  scard(key: string): Promise<number>;
  spop(key: string, count?: number): Promise<string | string[] | null>;
  srandmember(key: string, count?: number): Promise<string | string[] | null>;
  sunion(keys: string[]): Promise<string[]>;
  sinter(keys: string[]): Promise<string[]>;
  sdiff(keys: string[]): Promise<string[]>;
  sunionstore(dest: string, keys: string[]): Promise<number>;
  sinterstore(dest: string, keys: string[]): Promise<number>;
  sdiffstore(dest: string, keys: string[]): Promise<number>;
  sscan(key: string, cursor: number, opts?: ScanOptions): Promise<[number, string[]]>;

  zadd(key: string, entries: [number, string][], opts?: ZAddOptions): Promise<number | string>;
  zrem(key: string, members: string[]): Promise<number>;
  zscore(key: string, member: string): Promise<number | null>;
  zrank(key: string, member: string): Promise<number | null>;
  zrevrank(key: string, member: string): Promise<number | null>;
  zrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]>;
  zrangebyscore(
    key: string,
    min: string,
    max: string,
    opts?: ZRangeByScoreOptions,
  ): Promise<string[]>;
  zrevrange(key: string, start: number, stop: number, withScores?: boolean): Promise<string[]>;
  zrevrangebyscore(
    key: string,
    max: string,
    min: string,
    opts?: ZRangeByScoreOptions,
  ): Promise<string[]>;
  zcard(key: string): Promise<number>;
  zcount(key: string, min: string, max: string): Promise<number>;
  zincrby(key: string, increment: number, member: string): Promise<string>;
  zpopmin(key: string, count?: number): Promise<string[]>;
  zpopmax(key: string, count?: number): Promise<string[]>;
  zunionstore(dest: string, keys: string[], weights?: number[]): Promise<number>;
  zinterstore(dest: string, keys: string[], weights?: number[]): Promise<number>;
  zscan(key: string, cursor: number, opts?: ScanOptions): Promise<[number, string[]]>;

  ping(message?: string): string;
  echo(message: string): string;
  time(): [string, string];
}

const WRONGTYPE = "WRONGTYPE Operation against a key holding the wrong kind of value";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS redis_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(255) NOT NULL UNIQUE,
  key_type VARCHAR(10) NOT NULL,
  value_string LONGTEXT,
  value_list LONGTEXT,
  value_set LONGTEXT,
  value_hash LONGTEXT,
  value_zset LONGTEXT,
  expires_at BIGINT,
  INDEX idx_key_name (key_name),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

export interface MySQLConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export async function createRedisStore(config: MySQLConfig): Promise<RedisStore> {
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

  async function getEntry(key: string): Promise<RedisEntry | null> {
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      "SELECT * FROM redis_data WHERE key_name = ?",
      [key],
    );
    if (rows.length === 0) return null;
    const row = rows[0]!;
    if (row.expires_at !== null && row.expires_at <= Date.now()) {
      await pool.execute("DELETE FROM redis_data WHERE key_name = ?", [key]);
      return null;
    }
    return rowToEntry(row);
  }

  function rowToEntry(row: mysql.RowDataPacket): RedisEntry {
    const type = row.key_type as RedisType;
    let value: string | string[] | Set<string> | Map<string, string> | Map<string, number>;

    switch (type) {
      case "string":
        value = row.value_string || "";
        break;
      case "list":
        value = row.value_list ? JSON.parse(row.value_list) : [];
        break;
      case "set":
        value = new Set(row.value_set ? JSON.parse(row.value_set) : []);
        break;
      case "hash":
        value = new Map<string, string>(row.value_hash ? JSON.parse(row.value_hash) : []);
        break;
      case "zset":
        value = new Map<string, number>(row.value_zset ? JSON.parse(row.value_zset) : []);
        break;
      default:
        value = "";
    }

    return {
      type,
      value,
      expiresAt: row.expires_at,
    };
  }

  async function setEntry(key: string, entry: RedisEntry): Promise<void> {
    const valueString = entry.type === "string" ? (entry.value as string) : null;
    const valueList = entry.type === "list" ? JSON.stringify(entry.value as string[]) : null;
    const valueSet =
      entry.type === "set" ? JSON.stringify(Array.from(entry.value as Set<string>)) : null;
    const valueHash =
      entry.type === "hash"
        ? JSON.stringify(Array.from((entry.value as Map<string, string>).entries()))
        : null;
    const valueZset =
      entry.type === "zset"
        ? JSON.stringify(Array.from((entry.value as Map<string, number>).entries()))
        : null;

    await pool.execute(
      `INSERT INTO redis_data (key_name, key_type, value_string, value_list, value_set, value_hash, value_zset, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         key_type = VALUES(key_type),
         value_string = VALUES(value_string),
         value_list = VALUES(value_list),
         value_set = VALUES(value_set),
         value_hash = VALUES(value_hash),
         value_zset = VALUES(value_zset),
         expires_at = VALUES(expires_at)`,
      [key, entry.type, valueString, valueList, valueSet, valueHash, valueZset, entry.expiresAt],
    );
  }

  async function deleteEntry(key: string): Promise<void> {
    await pool.execute("DELETE FROM redis_data WHERE key_name = ?", [key]);
  }

  async function assertType(key: string, expected: RedisType): Promise<RedisEntry | null> {
    const entry = await getEntry(key);
    if (!entry) return null;
    if (entry.type !== expected) throw new Error(WRONGTYPE);
    return entry;
  }

  async function getStringVal(key: string): Promise<string | null> {
    const entry = await assertType(key, "string");
    return entry ? (entry.value as string) : null;
  }

  async function getOrCreateList(
    key: string,
  ): Promise<{ list: string[]; entry: RedisEntry | null }> {
    const entry = await getEntry(key);
    if (!entry) {
      const list: string[] = [];
      const newEntry: RedisEntry = { type: "list", value: list, expiresAt: null };
      return { list, entry: newEntry };
    }
    if (entry.type !== "list") throw new Error(WRONGTYPE);
    return { list: entry.value as string[], entry };
  }

  async function getOrCreateSet(
    key: string,
  ): Promise<{ set: Set<string>; entry: RedisEntry | null }> {
    const entry = await getEntry(key);
    if (!entry) {
      const s = new Set<string>();
      const newEntry: RedisEntry = { type: "set", value: s, expiresAt: null };
      return { set: s, entry: newEntry };
    }
    if (entry.type !== "set") throw new Error(WRONGTYPE);
    return { set: entry.value as Set<string>, entry };
  }

  async function getOrCreateHash(
    key: string,
  ): Promise<{ hash: Map<string, string>; entry: RedisEntry | null }> {
    const entry = await getEntry(key);
    if (!entry) {
      const m = new Map<string, string>();
      const newEntry: RedisEntry = { type: "hash", value: m, expiresAt: null };
      return { hash: m, entry: newEntry };
    }
    if (entry.type !== "hash") throw new Error(WRONGTYPE);
    return { hash: entry.value as Map<string, string>, entry };
  }

  async function getOrCreateZset(
    key: string,
  ): Promise<{ zset: Map<string, number>; entry: RedisEntry | null }> {
    const entry = await getEntry(key);
    if (!entry) {
      const m = new Map<string, number>();
      const newEntry: RedisEntry = { type: "zset", value: m, expiresAt: null };
      return { zset: m, entry: newEntry };
    }
    if (entry.type !== "zset") throw new Error(WRONGTYPE);
    return { zset: entry.value as Map<string, number>, entry };
  }

  function sortedMembers(zset: Map<string, number>): [string, number][] {
    return Array.from(zset.entries()).sort((a, b) => {
      if (a[1] !== b[1]) return a[1] - b[1];
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    });
  }

  function parseScoreBound(s: string, isMin: boolean): number {
    if (s === "-inf") return Number.NEGATIVE_INFINITY;
    if (s === "+inf" || s === "inf") return Number.POSITIVE_INFINITY;
    if (s.startsWith("(")) {
      const val = Number.parseFloat(s.slice(1));
      return isMin ? val + Number.EPSILON : val - Number.EPSILON;
    }
    return Number.parseFloat(s);
  }

  function resolveIndex(index: number, len: number): number {
    return index < 0 ? Math.max(0, len + index) : index;
  }

  async function scanIterable(
    items: string[],
    cursor: number,
    opts?: ScanOptions,
  ): Promise<[number, string[]]> {
    const count = opts?.count ?? 10;
    const pattern = opts?.match ? globToRegex(opts.match) : null;
    const results: string[] = [];
    let i = cursor;
    let scanned = 0;
    while (i < items.length && scanned < count) {
      const item = items[i]!;
      if (!pattern || pattern.test(item)) {
        results.push(item);
      }
      i++;
      scanned++;
    }
    const nextCursor = i >= items.length ? 0 : i;
    return [nextCursor, results];
  }

  async function cleanupEmpty(key: string, entry: RedisEntry | null): Promise<void> {
    if (!entry) return;
    if (entry.type === "list" && (entry.value as string[]).length === 0) {
      await deleteEntry(key);
    } else if (entry.type === "set" && (entry.value as Set<string>).size === 0) {
      await deleteEntry(key);
    } else if (entry.type === "zset" && (entry.value as Map<string, number>).size === 0) {
      await deleteEntry(key);
    } else if (entry.type === "hash" && (entry.value as Map<string, string>).size === 0) {
      await deleteEntry(key);
    }
  }

  async function applyExpiry(key: string, entry: RedisEntry, opts?: SetOptions): Promise<void> {
    if (opts?.keepttl) return;
    if (opts?.ex !== undefined) {
      entry.expiresAt = Date.now() + opts.ex * 1000;
    } else if (opts?.px !== undefined) {
      entry.expiresAt = Date.now() + opts.px;
    } else if (opts?.exat !== undefined) {
      entry.expiresAt = opts.exat * 1000;
    } else if (opts?.pxat !== undefined) {
      entry.expiresAt = opts.pxat;
    } else if (!opts?.keepttl) {
      entry.expiresAt = null;
    }
    await setEntry(key, entry);
  }

  const store: RedisStore = {
    async set(key, value, opts) {
      const existing = await getEntry(key);
      if (opts?.nx && existing) return null;
      if (opts?.xx && !existing) return null;

      let prev: string | null = null;
      if (opts?.get) {
        if (existing && existing.type !== "string") throw new Error(WRONGTYPE);
        prev = existing ? (existing.value as string) : null;
      }

      const entry: RedisEntry = { type: "string", value, expiresAt: null };
      await applyExpiry(key, entry, opts);

      return opts?.get ? prev : "OK";
    },

    async get(key) {
      return await getStringVal(key);
    },

    async mset(pairs) {
      for (const [k, v] of pairs) {
        const entry: RedisEntry = { type: "string", value: v, expiresAt: null };
        await setEntry(k, entry);
      }
    },

    async mget(keys) {
      return await Promise.all(keys.map((k) => getStringVal(k)));
    },

    async incr(key) {
      return await store.incrby(key, 1);
    },

    async incrby(key, increment) {
      const current = await getStringVal(key);
      const val = current === null ? 0 : Number.parseInt(current, 10);
      if (!Number.isFinite(val)) throw new Error("ERR value is not an integer or out of range");
      const result = val + increment;
      if (!Number.isSafeInteger(result))
        throw new Error("ERR value is not an integer or out of range");
      const entry = await getEntry(key);
      const expiresAt = entry?.expiresAt ?? null;
      const newEntry: RedisEntry = { type: "string", value: String(result), expiresAt };
      await setEntry(key, newEntry);
      return result;
    },

    async incrbyfloat(key, increment) {
      const current = await getStringVal(key);
      const val = current === null ? 0 : Number.parseFloat(current);
      if (!Number.isFinite(val)) throw new Error("ERR value is not a valid float");
      const result = val + increment;
      const entry = await getEntry(key);
      const expiresAt = entry?.expiresAt ?? null;
      const str = Number.isInteger(result) ? `${result}` : `${result}`;
      const newEntry: RedisEntry = { type: "string", value: str, expiresAt };
      await setEntry(key, newEntry);
      return str;
    },

    async decr(key) {
      return await store.incrby(key, -1);
    },

    async decrby(key, decrement) {
      return await store.incrby(key, -decrement);
    },

    async append(key, value) {
      const current = (await getStringVal(key)) ?? "";
      const result = current + value;
      const entry = await getEntry(key);
      const expiresAt = entry?.expiresAt ?? null;
      const newEntry: RedisEntry = { type: "string", value: result, expiresAt };
      await setEntry(key, newEntry);
      return result.length;
    },

    async strlen(key) {
      const val = await getStringVal(key);
      return val === null ? 0 : val.length;
    },

    async getrange(key, start, end) {
      const val = (await getStringVal(key)) ?? "";
      const s = resolveIndex(start, val.length);
      let e = end < 0 ? val.length + end : end;
      e = Math.min(e, val.length - 1);
      if (s > e) return "";
      return val.slice(s, e + 1);
    },

    async setrange(key, offset, value) {
      let current = (await getStringVal(key)) ?? "";
      if (current.length < offset) {
        current = current.padEnd(offset, "\0");
      }
      const result = current.slice(0, offset) + value + current.slice(offset + value.length);
      const entry = await getEntry(key);
      const expiresAt = entry?.expiresAt ?? null;
      const newEntry: RedisEntry = { type: "string", value: result, expiresAt };
      await setEntry(key, newEntry);
      return result.length;
    },

    async getdel(key) {
      const val = await getStringVal(key);
      if (val !== null) await deleteEntry(key);
      return val;
    },

    async getex(key, opts) {
      const val = await getStringVal(key);
      if (val !== null) {
        const entry = await getEntry(key);
        if (entry && opts) {
          await applyExpiry(key, entry, opts);
        }
      }
      return val;
    },

    async setnx(key, value) {
      if (await getEntry(key)) return false;
      const entry: RedisEntry = { type: "string", value, expiresAt: null };
      await setEntry(key, entry);
      return true;
    },

    async setex(key, seconds, value) {
      const entry: RedisEntry = { type: "string", value, expiresAt: Date.now() + seconds * 1000 };
      await setEntry(key, entry);
    },

    async psetex(key, ms, value) {
      const entry: RedisEntry = { type: "string", value, expiresAt: Date.now() + ms };
      await setEntry(key, entry);
    },

    async del(keys) {
      let count = 0;
      for (const k of keys) {
        const [result] = await pool.execute<mysql.ResultSetHeader>(
          "DELETE FROM redis_data WHERE key_name = ?",
          [k],
        );
        count += result.affectedRows;
      }
      return count;
    },

    async exists(keys) {
      let count = 0;
      for (const k of keys) {
        if (await getEntry(k)) count++;
      }
      return count;
    },

    async expire(key, seconds) {
      const entry = await getEntry(key);
      if (!entry) return false;
      entry.expiresAt = Date.now() + seconds * 1000;
      await setEntry(key, entry);
      return true;
    },

    async expireat(key, timestamp) {
      const entry = await getEntry(key);
      if (!entry) return false;
      entry.expiresAt = timestamp * 1000;
      await setEntry(key, entry);
      return true;
    },

    async pexpire(key, ms) {
      const entry = await getEntry(key);
      if (!entry) return false;
      entry.expiresAt = Date.now() + ms;
      await setEntry(key, entry);
      return true;
    },

    async pexpireat(key, ms) {
      const entry = await getEntry(key);
      if (!entry) return false;
      entry.expiresAt = ms;
      await setEntry(key, entry);
      return true;
    },

    async ttl(key) {
      const entry = await getEntry(key);
      if (!entry) return -2;
      if (entry.expiresAt === null) return -1;
      return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
    },

    async pttl(key) {
      const entry = await getEntry(key);
      if (!entry) return -2;
      if (entry.expiresAt === null) return -1;
      return Math.max(0, entry.expiresAt - Date.now());
    },

    async persist(key) {
      const entry = await getEntry(key);
      if (!entry || entry.expiresAt === null) return false;
      entry.expiresAt = null;
      await setEntry(key, entry);
      return true;
    },

    async rename(from, to) {
      const entry = await getEntry(from);
      if (!entry) throw new Error("ERR no such key");
      await deleteEntry(from);
      await setEntry(to, entry);
    },

    async type(key) {
      const entry = await getEntry(key);
      return entry ? entry.type : "none";
    },

    async keys(pattern) {
      const regex = globToRegex(pattern);
      const [rows] = await pool.execute<mysql.RowDataPacket[]>("SELECT key_name FROM redis_data");
      const result: string[] = [];
      for (const row of rows) {
        const entry = await getEntry(row.key_name);
        if (entry && regex.test(row.key_name)) {
          result.push(row.key_name);
        }
      }
      return result;
    },

    async scan(cursor, opts) {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>("SELECT key_name FROM redis_data");
      const allKeys: string[] = [];
      for (const row of rows) {
        const entry = await getEntry(row.key_name);
        if (entry) allKeys.push(row.key_name);
      }
      return await scanIterable(allKeys, cursor, opts);
    },

    async unlink(keys) {
      return await store.del(keys);
    },

    async dbsize() {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) as count FROM redis_data",
      );
      return rows[0]!.count;
    },

    async flushdb() {
      await pool.execute("DELETE FROM redis_data");
    },

    async flushall() {
      await pool.execute("DELETE FROM redis_data");
    },

    async randomkey() {
      const [rows] = await pool.execute<mysql.RowDataPacket[]>(
        "SELECT key_name FROM redis_data ORDER BY RAND() LIMIT 1",
      );
      if (rows.length === 0) return null;
      const entry = await getEntry(rows[0]!.key_name);
      return entry ? rows[0]!.key_name : null;
    },

    async copy(source, dest, replace) {
      const entry = await getEntry(source);
      if (!entry) return false;
      if ((await getEntry(dest)) && !replace) return false;
      const cloned = structuredClone(entry);
      cloned.expiresAt = null;
      await setEntry(dest, cloned);
      return true;
    },

    async hset(key, fields) {
      const { hash, entry } = await getOrCreateHash(key);
      let added = 0;
      for (const [f, v] of fields) {
        if (!hash.has(f)) added++;
        hash.set(f, v);
      }
      const newEntry: RedisEntry = {
        type: "hash",
        value: hash,
        expiresAt: entry?.expiresAt ?? null,
      };
      await setEntry(key, newEntry);
      return added;
    },

    async hget(key, field) {
      const entry = await assertType(key, "hash");
      if (!entry) return null;
      return (entry.value as Map<string, string>).get(field) ?? null;
    },

    async hmset(key, fields) {
      const { hash, entry } = await getOrCreateHash(key);
      for (const [f, v] of fields) {
        hash.set(f, v);
      }
      const newEntry: RedisEntry = {
        type: "hash",
        value: hash,
        expiresAt: entry?.expiresAt ?? null,
      };
      await setEntry(key, newEntry);
    },

    async hmget(key, fields) {
      const entry = await assertType(key, "hash");
      if (!entry) return fields.map(() => null);
      const hash = entry.value as Map<string, string>;
      return fields.map((f) => hash.get(f) ?? null);
    },

    async hgetall(key) {
      const entry = await assertType(key, "hash");
      if (!entry) return [];
      const result: string[] = [];
      for (const [f, v] of entry.value as Map<string, string>) {
        result.push(f, v);
      }
      return result;
    },

    async hdel(key, fields) {
      const entry = await assertType(key, "hash");
      if (!entry) return 0;
      const hash = entry.value as Map<string, string>;
      let count = 0;
      for (const f of fields) {
        if (hash.delete(f)) count++;
      }
      await setEntry(key, entry);
      await cleanupEmpty(key, entry);
      return count;
    },

    async hexists(key, field) {
      const entry = await assertType(key, "hash");
      if (!entry) return false;
      return (entry.value as Map<string, string>).has(field);
    },

    async hlen(key) {
      const entry = await assertType(key, "hash");
      if (!entry) return 0;
      return (entry.value as Map<string, string>).size;
    },

    async hkeys(key) {
      const entry = await assertType(key, "hash");
      if (!entry) return [];
      return Array.from((entry.value as Map<string, string>).keys());
    },

    async hvals(key) {
      const entry = await assertType(key, "hash");
      if (!entry) return [];
      return Array.from((entry.value as Map<string, string>).values());
    },

    async hincrby(key, field, increment) {
      const { hash, entry } = await getOrCreateHash(key);
      const current = hash.get(field);
      const val = current === undefined ? 0 : Number.parseInt(current, 10);
      if (!Number.isFinite(val)) throw new Error("ERR hash value is not an integer");
      const result = val + increment;
      hash.set(field, String(result));
      const newEntry: RedisEntry = {
        type: "hash",
        value: hash,
        expiresAt: entry?.expiresAt ?? null,
      };
      await setEntry(key, newEntry);
      return result;
    },

    async hincrbyfloat(key, field, increment) {
      const { hash, entry } = await getOrCreateHash(key);
      const current = hash.get(field);
      const val = current === undefined ? 0 : Number.parseFloat(current);
      if (!Number.isFinite(val)) throw new Error("ERR hash value is not a valid float");
      const result = val + increment;
      const str = String(result);
      hash.set(field, str);
      const newEntry: RedisEntry = {
        type: "hash",
        value: hash,
        expiresAt: entry?.expiresAt ?? null,
      };
      await setEntry(key, newEntry);
      return str;
    },

    async hsetnx(key, field, value) {
      const { hash, entry } = await getOrCreateHash(key);
      if (hash.has(field)) return false;
      hash.set(field, value);
      const newEntry: RedisEntry = {
        type: "hash",
        value: hash,
        expiresAt: entry?.expiresAt ?? null,
      };
      await setEntry(key, newEntry);
      return true;
    },

    async hscan(key, cursor, opts) {
      const entry = await assertType(key, "hash");
      if (!entry) return [0, []];
      const items = Array.from((entry.value as Map<string, string>).entries()).flat();
      return await scanIterable(items.map(String), cursor, opts);
    },

    async lpush(key, values) {
      const { list, entry } = await getOrCreateList(key);
      list.unshift(...values);
      const newEntry: RedisEntry = {
        type: "list",
        value: list,
        expiresAt: entry?.expiresAt ?? null,
      };
      await setEntry(key, newEntry);
      return list.length;
    },

    async rpush(key, values) {
      const { list, entry } = await getOrCreateList(key);
      list.push(...values);
      const newEntry: RedisEntry = {
        type: "list",
        value: list,
        expiresAt: entry?.expiresAt ?? null,
      };
      await setEntry(key, newEntry);
      return list.length;
    },

    async lpop(key, count) {
      const entry = await assertType(key, "list");
      if (!entry) return null;
      const list = entry.value as string[];
      if (list.length === 0) return null;
      if (count === undefined) {
        const val = list.shift()!;
        await setEntry(key, entry);
        await cleanupEmpty(key, entry);
        return val;
      }
      const result = list.splice(0, count);
      await setEntry(key, entry);
      await cleanupEmpty(key, entry);
      return result;
    },

    async rpop(key, count) {
      const entry = await assertType(key, "list");
      if (!entry) return null;
      const list = entry.value as string[];
      if (list.length === 0) return null;
      if (count === undefined) {
        const val = list.pop()!;
        await setEntry(key, entry);
        await cleanupEmpty(key, entry);
        return val;
      }
      const result = list.splice(-count);
      await setEntry(key, entry);
      await cleanupEmpty(key, entry);
      return result;
    },

    async lrange(key, start, stop) {
      const entry = await assertType(key, "list");
      if (!entry) return [];
      const list = entry.value as string[];
      const s = resolveIndex(start, list.length);
      const e = stop < 0 ? list.length + stop : stop;
      return list.slice(s, e + 1);
    },

    async llen(key) {
      const entry = await assertType(key, "list");
      if (!entry) return 0;
      return (entry.value as string[]).length;
    },

    async lindex(key, index) {
      const entry = await assertType(key, "list");
      if (!entry) return null;
      const list = entry.value as string[];
      const i = resolveIndex(index, list.length);
      return list[i] ?? null;
    },

    async lset(key, index, value) {
      const entry = await assertType(key, "list");
      if (!entry) throw new Error("ERR no such key");
      const list = entry.value as string[];
      const i = resolveIndex(index, list.length);
      if (i < 0 || i >= list.length) throw new Error("ERR index out of range");
      list[i] = value;
      await setEntry(key, entry);
    },

    async linsert(key, before, pivot, value) {
      const entry = await assertType(key, "list");
      if (!entry) return 0;
      const list = entry.value as string[];
      const idx = list.indexOf(pivot);
      if (idx === -1) return -1;
      list.splice(before ? idx : idx + 1, 0, value);
      await setEntry(key, entry);
      return list.length;
    },

    async lrem(key, count, value) {
      const entry = await assertType(key, "list");
      if (!entry) return 0;
      const list = entry.value as string[];
      let removed = 0;
      if (count === 0) {
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i] === value) {
            list.splice(i, 1);
            removed++;
          }
        }
      } else if (count > 0) {
        for (let i = 0; i < list.length && removed < count; i++) {
          if (list[i] === value) {
            list.splice(i, 1);
            removed++;
            i--;
          }
        }
      } else {
        for (let i = list.length - 1; i >= 0 && removed < -count; i--) {
          if (list[i] === value) {
            list.splice(i, 1);
            removed++;
          }
        }
      }
      await setEntry(key, entry);
      await cleanupEmpty(key, entry);
      return removed;
    },

    async ltrim(key, start, stop) {
      const entry = await assertType(key, "list");
      if (!entry) return;
      const list = entry.value as string[];
      const s = resolveIndex(start, list.length);
      const e = stop < 0 ? list.length + stop : stop;
      const trimmed = list.slice(s, e + 1);
      entry.value = trimmed;
      await setEntry(key, entry);
      await cleanupEmpty(key, entry);
    },

    async sadd(key, members) {
      const { set, entry } = await getOrCreateSet(key);
      let added = 0;
      for (const m of members) {
        if (!set.has(m)) {
          set.add(m);
          added++;
        }
      }
      const newEntry: RedisEntry = { type: "set", value: set, expiresAt: entry?.expiresAt ?? null };
      await setEntry(key, newEntry);
      return added;
    },

    async srem(key, members) {
      const entry = await assertType(key, "set");
      if (!entry) return 0;
      const set = entry.value as Set<string>;
      let removed = 0;
      for (const m of members) {
        if (set.delete(m)) removed++;
      }
      await setEntry(key, entry);
      await cleanupEmpty(key, entry);
      return removed;
    },

    async smembers(key) {
      const entry = await assertType(key, "set");
      if (!entry) return [];
      return Array.from(entry.value as Set<string>);
    },

    async sismember(key, member) {
      const entry = await assertType(key, "set");
      if (!entry) return false;
      return (entry.value as Set<string>).has(member);
    },

    async scard(key) {
      const entry = await assertType(key, "set");
      if (!entry) return 0;
      return (entry.value as Set<string>).size;
    },

    async spop(key, count) {
      const entry = await assertType(key, "set");
      if (!entry) return null;
      const set = entry.value as Set<string>;
      if (set.size === 0) return null;
      const arr = Array.from(set);
      if (count === undefined) {
        const idx = Math.floor(Math.random() * arr.length);
        const val = arr[idx]!;
        set.delete(val);
        await setEntry(key, entry);
        await cleanupEmpty(key, entry);
        return val;
      }
      const result: string[] = [];
      for (let i = 0; i < count && arr.length > 0; i++) {
        const idx = Math.floor(Math.random() * arr.length);
        result.push(arr[idx]!);
        set.delete(arr[idx]!);
        arr.splice(idx, 1);
      }
      await setEntry(key, entry);
      await cleanupEmpty(key, entry);
      return result;
    },

    async srandmember(key, count) {
      const entry = await assertType(key, "set");
      if (!entry) return null;
      const set = entry.value as Set<string>;
      if (set.size === 0) return null;
      const arr = Array.from(set);
      if (count === undefined) {
        return arr[Math.floor(Math.random() * arr.length)]!;
      }
      const result: string[] = [];
      for (let i = 0; i < Math.abs(count); i++) {
        result.push(arr[Math.floor(Math.random() * arr.length)]!);
      }
      return result;
    },

    async sunion(keys) {
      const result = new Set<string>();
      for (const k of keys) {
        const entry = await assertType(k, "set");
        if (entry) {
          for (const m of entry.value as Set<string>) {
            result.add(m);
          }
        }
      }
      return Array.from(result);
    },

    async sinter(keys) {
      if (keys.length === 0) return [];
      const first = await assertType(keys[0]!, "set");
      if (!first) return [];
      let result = new Set(first.value as Set<string>);
      for (let i = 1; i < keys.length; i++) {
        const entry = await assertType(keys[i]!, "set");
        if (!entry) return [];
        result = new Set([...result].filter((x) => (entry.value as Set<string>).has(x)));
      }
      return Array.from(result);
    },

    async sdiff(keys) {
      if (keys.length === 0) return [];
      const first = await assertType(keys[0]!, "set");
      if (!first) return [];
      let result = new Set(first.value as Set<string>);
      for (let i = 1; i < keys.length; i++) {
        const entry = await assertType(keys[i]!, "set");
        if (entry) {
          for (const m of entry.value as Set<string>) {
            result.delete(m);
          }
        }
      }
      return Array.from(result);
    },

    async sunionstore(dest, keys) {
      const result = new Set<string>();
      for (const k of keys) {
        const entry = await assertType(k, "set");
        if (entry) {
          for (const m of entry.value as Set<string>) {
            result.add(m);
          }
        }
      }
      const newEntry: RedisEntry = { type: "set", value: result, expiresAt: null };
      await setEntry(dest, newEntry);
      return result.size;
    },

    async sinterstore(dest, keys) {
      if (keys.length === 0) {
        await deleteEntry(dest);
        return 0;
      }
      const first = await assertType(keys[0]!, "set");
      if (!first) {
        await deleteEntry(dest);
        return 0;
      }
      let result = new Set(first.value as Set<string>);
      for (let i = 1; i < keys.length; i++) {
        const entry = await assertType(keys[i]!, "set");
        if (!entry) {
          await deleteEntry(dest);
          return 0;
        }
        result = new Set([...result].filter((x) => (entry.value as Set<string>).has(x)));
      }
      const newEntry: RedisEntry = { type: "set", value: result, expiresAt: null };
      await setEntry(dest, newEntry);
      return result.size;
    },

    async sdiffstore(dest, keys) {
      if (keys.length === 0) {
        await deleteEntry(dest);
        return 0;
      }
      const first = await assertType(keys[0]!, "set");
      if (!first) {
        await deleteEntry(dest);
        return 0;
      }
      let result = new Set(first.value as Set<string>);
      for (let i = 1; i < keys.length; i++) {
        const entry = await assertType(keys[i]!, "set");
        if (entry) {
          for (const m of entry.value as Set<string>) {
            result.delete(m);
          }
        }
      }
      const newEntry: RedisEntry = { type: "set", value: result, expiresAt: null };
      await setEntry(dest, newEntry);
      return result.size;
    },

    async sscan(key, cursor, opts) {
      const entry = await assertType(key, "set");
      if (!entry) return [0, []];
      const items = Array.from(entry.value as Set<string>);
      return await scanIterable(items, cursor, opts);
    },

    async zadd(key, entries, opts) {
      const { zset, entry } = await getOrCreateZset(key);
      let added = 0;
      let changed = 0;
      for (const [score, member] of entries) {
        const existing = zset.get(member);
        if (existing !== undefined) {
          if (opts?.nx) continue;
          if (opts?.xx) {
            if (opts?.gt && score <= existing) continue;
            if (opts?.lt && score >= existing) continue;
            zset.set(member, score);
            changed++;
          } else {
            zset.set(member, score);
            changed++;
          }
        } else {
          if (opts?.xx) continue;
          zset.set(member, score);
          added++;
          changed++;
        }
      }
      const newEntry: RedisEntry = {
        type: "zset",
        value: zset,
        expiresAt: entry?.expiresAt ?? null,
      };
      await setEntry(key, newEntry);
      return opts?.ch ? changed : added;
    },

    async zrem(key, members) {
      const entry = await assertType(key, "zset");
      if (!entry) return 0;
      const zset = entry.value as Map<string, number>;
      let removed = 0;
      for (const m of members) {
        if (zset.delete(m)) removed++;
      }
      await setEntry(key, entry);
      await cleanupEmpty(key, entry);
      return removed;
    },

    async zscore(key, member) {
      const entry = await assertType(key, "zset");
      if (!entry) return null;
      return (entry.value as Map<string, number>).get(member) ?? null;
    },

    async zrank(key, member) {
      const entry = await assertType(key, "zset");
      if (!entry) return null;
      const sorted = sortedMembers(entry.value as Map<string, number>);
      const idx = sorted.findIndex(([m]) => m === member);
      return idx === -1 ? null : idx;
    },

    async zrevrank(key, member) {
      const entry = await assertType(key, "zset");
      if (!entry) return null;
      const sorted = sortedMembers(entry.value as Map<string, number>).reverse();
      const idx = sorted.findIndex(([m]) => m === member);
      return idx === -1 ? null : idx;
    },

    async zrange(key, start, stop, withScores) {
      const entry = await assertType(key, "zset");
      if (!entry) return [];
      const sorted = sortedMembers(entry.value as Map<string, number>);
      const s = resolveIndex(start, sorted.length);
      const e = stop < 0 ? sorted.length + stop : stop;
      const slice = sorted.slice(s, e + 1);
      if (withScores) {
        return slice.flat().map(String);
      }
      return slice.map(([m]) => m);
    },

    async zrangebyscore(key, min, max, opts) {
      const entry = await assertType(key, "zset");
      if (!entry) return [];
      const sorted = sortedMembers(entry.value as Map<string, number>);
      const minVal = parseScoreBound(min, true);
      const maxVal = parseScoreBound(max, false);
      const filtered = sorted.filter(([, s]) => s >= minVal && s <= maxVal);
      let result = filtered;
      if (opts?.limit) {
        result = filtered.slice(opts.limit.offset, opts.limit.offset + opts.limit.count);
      }
      if (opts?.withScores) {
        return result.flat().map(String);
      }
      return result.map(([m]) => m);
    },

    async zrevrange(key, start, stop, withScores) {
      const entry = await assertType(key, "zset");
      if (!entry) return [];
      const sorted = sortedMembers(entry.value as Map<string, number>).reverse();
      const s = resolveIndex(start, sorted.length);
      const e = stop < 0 ? sorted.length + stop : stop;
      const slice = sorted.slice(s, e + 1);
      if (withScores) {
        return slice.flat().map(String);
      }
      return slice.map(([m]) => m);
    },

    async zrevrangebyscore(key, max, min, opts) {
      const entry = await assertType(key, "zset");
      if (!entry) return [];
      const sorted = sortedMembers(entry.value as Map<string, number>).reverse();
      const minVal = parseScoreBound(min, true);
      const maxVal = parseScoreBound(max, false);
      const filtered = sorted.filter(([, s]) => s >= minVal && s <= maxVal);
      let result = filtered;
      if (opts?.limit) {
        result = filtered.slice(opts.limit.offset, opts.limit.offset + opts.limit.count);
      }
      if (opts?.withScores) {
        return result.flat().map(String);
      }
      return result.map(([m]) => m);
    },

    async zcard(key) {
      const entry = await assertType(key, "zset");
      if (!entry) return 0;
      return (entry.value as Map<string, number>).size;
    },

    async zcount(key, min, max) {
      const entry = await assertType(key, "zset");
      if (!entry) return 0;
      const sorted = sortedMembers(entry.value as Map<string, number>);
      const minVal = parseScoreBound(min, true);
      const maxVal = parseScoreBound(max, false);
      return sorted.filter(([, s]) => s >= minVal && s <= maxVal).length;
    },

    async zincrby(key, increment, member) {
      const { zset, entry } = await getOrCreateZset(key);
      const current = zset.get(member) ?? 0;
      const result = current + increment;
      zset.set(member, result);
      const newEntry: RedisEntry = {
        type: "zset",
        value: zset,
        expiresAt: entry?.expiresAt ?? null,
      };
      await setEntry(key, newEntry);
      return String(result);
    },

    async zpopmin(key, count) {
      const entry = await assertType(key, "zset");
      if (!entry) return [];
      const sorted = sortedMembers(entry.value as Map<string, number>);
      const n = count ?? 1;
      const popped = sorted.slice(0, n);
      const zset = entry.value as Map<string, number>;
      for (const [m] of popped) {
        zset.delete(m);
      }
      await setEntry(key, entry);
      await cleanupEmpty(key, entry);
      return popped.flat().map(String);
    },

    async zpopmax(key, count) {
      const entry = await assertType(key, "zset");
      if (!entry) return [];
      const sorted = sortedMembers(entry.value as Map<string, number>).reverse();
      const n = count ?? 1;
      const popped = sorted.slice(0, n);
      const zset = entry.value as Map<string, number>;
      for (const [m] of popped) {
        zset.delete(m);
      }
      await setEntry(key, entry);
      await cleanupEmpty(key, entry);
      return popped.flat().map(String);
    },

    async zunionstore(dest, keys, weights) {
      const result = new Map<string, number>();
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]!;
        const w = weights?.[i] ?? 1;
        const entry = await assertType(k, "zset");
        if (entry) {
          for (const [m, s] of entry.value as Map<string, number>) {
            result.set(m, (result.get(m) ?? 0) + s * w);
          }
        }
      }
      const newEntry: RedisEntry = { type: "zset", value: result, expiresAt: null };
      await setEntry(dest, newEntry);
      return result.size;
    },

    async zinterstore(dest, keys, weights) {
      if (keys.length === 0) {
        await deleteEntry(dest);
        return 0;
      }
      const counts = new Map<string, number>();
      const scores = new Map<string, number>();
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i]!;
        const w = weights?.[i] ?? 1;
        const entry = await assertType(k, "zset");
        if (entry) {
          for (const [m, s] of entry.value as Map<string, number>) {
            counts.set(m, (counts.get(m) ?? 0) + 1);
            scores.set(m, (scores.get(m) ?? 0) + s * w);
          }
        }
      }
      const result = new Map<string, number>();
      for (const [m, c] of counts) {
        if (c === keys.length) {
          result.set(m, scores.get(m)!);
        }
      }
      const newEntry: RedisEntry = { type: "zset", value: result, expiresAt: null };
      await setEntry(dest, newEntry);
      return result.size;
    },

    async zscan(key, cursor, opts) {
      const entry = await assertType(key, "zset");
      if (!entry) return [0, []];
      const items = sortedMembers(entry.value as Map<string, number>)
        .flat()
        .map(String);
      return await scanIterable(items, cursor, opts);
    },

    ping(message) {
      return message ?? "PONG";
    },

    echo(message) {
      return message;
    },

    time() {
      const now = Date.now();
      const seconds = Math.floor(now / 1000);
      const microseconds = (now % 1000) * 1000;
      return [String(seconds), String(microseconds)];
    },
  };

  return store;
}
