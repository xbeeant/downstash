# downstash

A local development server that mocks [Upstash QStash](https://upstash.com/docs/qstash) and [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted) for fast, offline testing.

`downstash` runs on your laptop and speaks the same HTTP APIs as production Upstash, so the official [`@upstash/qstash`](https://www.npmjs.com/package/@upstash/qstash) and [`@upstash/redis`](https://www.npmjs.com/package/@upstash/redis) SDKs keep working with no code changes — point them at `downstash` and get complete round-trips without an internet connection.

## Why

Working with Upstash services locally is painful:

- **QStash** can't reach `localhost` — you'd need ngrok, env var juggling, and remember to undo it all before committing.
- **Upstash Redis** requires internet for every request — slow iteration, no offline dev, and test suites that hit a remote service.

With `downstash`:

- No tunnels. `downstash` is a process on your machine and can call `http://localhost:3000/...` directly.
- No env shuffling per session — signing keys and Redis tokens are stable defaults you put in `.env.local` once.
- Works offline. Plane, train, hotel wifi — fine.
- CI-friendly. Spin it up in a workflow step and run integration tests against both QStash and Redis without external dependencies.

## Install

Requires [Bun](https://bun.com/) `>= 1.1.0`.

```bash
git clone https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash
cd downstash
bun install
bun link            # makes the `downstash` command available globally
```

Or run it without installing globally:

```bash
bun /path/to/downstash/src/cli.ts
```

## Quick start

In one terminal, start downstash:

```bash
downstash
# 2026-04-29T12:00:00.000Z INFO  downstash listening port=8080 db=.downstash/db.sqlite tickMs=250
```

In another terminal, publish a message that round-trips back to your dev server:

```bash
curl -X POST \
  -H 'Authorization: Bearer dev' \
  -H 'Content-Type: application/json' \
  -d '{"hello":"world"}' \
  'http://localhost:8080/v2/publishJSON/http://localhost:3000/api/echo'
# {"messageId":"msg_2j9a...","url":"http://localhost:3000/api/echo"}
```

`downstash` will sign the request and POST it to `http://localhost:3000/api/echo` within a few hundred milliseconds. Your handler can verify it with `@upstash/qstash`'s `Receiver` exactly as it would in production.

## Configure your app

Add this `.env.local` block to wire up both QStash and Redis SDKs:

```env
# QStash
QSTASH_URL=http://localhost:8080
QSTASH_TOKEN=dev
QSTASH_CURRENT_SIGNING_KEY=sig_downstash_current_dev_key_do_not_use_in_prod
QSTASH_NEXT_SIGNING_KEY=sig_downstash_next_dev_key_do_not_use_in_prod

# Redis
UPSTASH_REDIS_REST_URL=http://localhost:8080
UPSTASH_REDIS_REST_TOKEN=dev
```

Print the current keys and Redis config at any time with:

```bash
downstash keys
```

### QStash usage

The `Client` and `Receiver` constructors work unchanged:

```ts
import { Client, Receiver } from "@upstash/qstash";

const client = new Client({
  baseUrl: process.env.QSTASH_URL!,
  token: process.env.QSTASH_TOKEN!,
});

await client.publishJSON({
  url: "http://localhost:3000/api/echo",
  body: { hello: "world" },
  delay: 5,        // seconds
  retries: 3,
});

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

// inside your route handler:
const ok = await receiver.verify({
  signature: req.headers.get("upstash-signature")!,
  body: await req.text(),
  url: req.url,
});
```

### Redis usage

The `@upstash/redis` SDK works unchanged:

```ts
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

await redis.set("user:1", { name: "Alice", role: "admin" });
const user = await redis.get("user:1");

await redis.lpush("queue", "task-1", "task-2");
const task = await redis.rpop("queue");

const pipe = redis.pipeline();
pipe.incr("counter");
pipe.get("counter");
const results = await pipe.exec();
```

The Redis store is in-memory and resets when the server restarts. You can also use curl directly:

```bash
# Single command
curl -X POST -H 'Authorization: Bearer dev' \
  -d '["SET","mykey","myvalue"]' http://localhost:8080/

# URL-path style
curl -H 'Authorization: Bearer dev' http://localhost:8080/get/mykey

# Pipeline
curl -X POST -H 'Authorization: Bearer dev' \
  -d '[["SET","a","1"],["SET","b","2"],["MGET","a","b"]]' \
  http://localhost:8080/pipeline
```

## Supported features

### QStash

| Capability | Status | Notes |
|---|---|---|
| `POST /v2/publish/:dest` | Implemented | Raw body forwarded as-is |
| `POST /v2/publishJSON/:dest` | Implemented | Defaults `Content-Type: application/json` |
| `Upstash-Method` | Implemented | Per-message HTTP verb |
| `Upstash-Delay` / `Upstash-Not-Before` | Implemented | Schedules `not_before` |
| `Upstash-Retries` | Implemented | Exponential backoff capped at 1h |
| `Upstash-Timeout` | Implemented | Per-attempt fetch timeout |
| `Upstash-Forward-*` | Implemented | Prefix stripped on the way out |
| `Upstash-Callback` | Implemented | Success envelope re-enqueued through the same pipeline |
| `Upstash-Failure-Callback` | Implemented | Fired once retries are exhausted |
| Signed `Upstash-Signature` JWT | Implemented | HS256, verified by real `@upstash/qstash` `Receiver` |
| `GET /v2/messages/:id` / `DELETE /v2/messages/:id` | Implemented | Inspect or cancel pending messages |
| `POST /v2/batch` | Implemented | Fan-out: each item becomes an independent pending message |
| Schedules (cron), Queues, DLQ, URL Groups, Events log, Web console | Not yet | Reserved for v2+ |

### Redis

| Category | Commands |
|---|---|
| Strings | SET (EX/PX/NX/XX/EXAT/PXAT), GET, MSET, MGET, SETNX, SETEX, PSETEX, INCR, INCRBY, INCRBYFLOAT, DECR, DECRBY, APPEND, STRLEN, GETRANGE, SETRANGE, GETDEL, GETEX |
| Keys | DEL, EXISTS, EXPIRE, EXPIREAT, PEXPIRE, PEXPIREAT, TTL, PTTL, PERSIST, RENAME, TYPE, KEYS, SCAN, UNLINK, DBSIZE, FLUSHDB, FLUSHALL, RANDOMKEY, COPY |
| Hashes | HSET, HGET, HMSET, HMGET, HGETALL, HDEL, HEXISTS, HLEN, HKEYS, HVALS, HINCRBY, HINCRBYFLOAT, HSETNX, HSCAN |
| Lists | LPUSH, RPUSH, LPOP, RPOP, LRANGE, LLEN, LINDEX, LSET, LINSERT, LREM, LTRIM |
| Sets | SADD, SREM, SMEMBERS, SISMEMBER, SCARD, SPOP, SRANDMEMBER, SUNION, SINTER, SDIFF, SUNIONSTORE, SINTERSTORE, SDIFFSTORE, SSCAN |
| Sorted Sets | ZADD, ZREM, ZSCORE, ZRANK, ZREVRANK, ZRANGE, ZRANGEBYSCORE, ZREVRANGE, ZREVRANGEBYSCORE, ZCARD, ZCOUNT, ZINCRBY, ZPOPMIN, ZPOPMAX, ZUNIONSTORE, ZINTERSTORE, ZSCAN |
| Utility | PING, ECHO, TIME |

| API Endpoint | Description |
|---|---|
| `POST /` | Single command — body: `["SET","k","v"]` → `{"result":"OK"}` |
| `POST /pipeline` | Batch — body: `[["SET","k","v"],["GET","k"]]` → `[{"result":"OK"},{"result":"v"}]` |
| `POST /multi-exec` | Atomic transaction (same format as pipeline) |
| `GET\|POST /:command/:args...` | URL-path style — e.g. `/get/mykey` |
| `Upstash-Encoding: base64` | Base64-encodes all string values in responses |

## Inspecting state

Every accepted publish prints a single info line. Watch them in the downstash terminal, or query the API directly:

```bash
curl http://localhost:8080/v2/messages/msg_2j9a...
# {"messageId":"msg_...","url":"...","method":"POST","state":"delivered",...}
```

Wipe the message store without restarting:

```bash
downstash reset
```

The SQLite database lives at `./.downstash/db.sqlite` by default. Override with `--db` or `DOWNSTASH_DB`.

## CLI reference

```
downstash                        start the server (default port 8080)
downstash serve                  explicit serve subcommand
downstash reset                  truncate the messages table
downstash keys                   print signing keys and Redis config for .env.local
downstash help                   show this help

flags:
  --port <n>                     HTTP port                          (env: DOWNSTASH_PORT,            default 8080)
  --db <path>                    SQLite db file                     (env: DOWNSTASH_DB,              default .downstash/db.sqlite)
  --tick-ms <n>                  delivery loop interval             (env: DOWNSTASH_TICK_MS,         default 250)
  --current-signing-key <s>      override current key               (env: DOWNSTASH_CURRENT_SIGNING_KEY)
  --next-signing-key <s>         override next key                  (env: DOWNSTASH_NEXT_SIGNING_KEY)
  --redis-token <s>              Redis auth token                   (env: DOWNSTASH_REDIS_TOKEN,     default "dev")
  --log-level <level>            debug | info | warn | error       (env: DOWNSTASH_LOG_LEVEL)
  --quiet                        shorthand for --log-level=warn
```

Flags always win over env vars.

## How signing works

`downstash` signs every outbound delivery with a JWT in the `Upstash-Signature` header. The JWT is HMAC-SHA256 over `<base64url(header)>.<base64url(payload)>` with these claims:

| Claim | Value |
|---|---|
| `iss` | `"Upstash"` |
| `sub` | The destination URL |
| `iat` / `nbf` | Now (unix seconds) |
| `exp` | Now + 5 minutes |
| `jti` | The message ID |
| `body` | `base64url(sha256(rawBody))` |

`@upstash/qstash`'s `Receiver` verifies with both the **current** and **next** signing keys. Override them per-environment with `--current-signing-key` / `--next-signing-key` or the matching `DOWNSTASH_*` env vars; otherwise downstash uses the stable defaults shown by `downstash keys` so your `.env.local` doesn't need to change between machines.

## Roadmap

- Schedules (cron) — `POST /v2/schedules/:dest` and friends
- Queues with parallelism — `POST /v2/queues` + `POST /v2/enqueue/:queue/:dest`
- Dead-letter queue — `GET /v2/dlq`, requeue, delete
- URL Groups (topics) — fan-out
- Events log — `GET /v2/events`
- Web console UI

## MySQL Storage

`downstash` supports MySQL as a persistent storage backend for both QStash messages and Redis data.

### Configuration

Configure MySQL connection via environment variables:

| Environment Variable | Description | Default |
|---|---|---|
| `DOWNSTASH_MYSQL_HOST` | MySQL server host | `localhost` |
| `DOWNSTASH_MYSQL_PORT` | MySQL server port | `3306` |
| `DOWNSTASH_MYSQL_USER` | MySQL username | `root` |
| `DOWNSTASH_MYSQL_PASSWORD` | MySQL password | `""` |
| `DOWNSTASH_MYSQL_DATABASE` | Database name | `downstash` |

### Quick Start with Docker Compose

The easiest way to run `downstash` with MySQL is using `docker-compose`:

```bash
# Start MySQL and downstash
docker-compose up -d

# View logs
docker-compose logs -f downstash
```

### Manual MySQL Setup

1. Create the database:
```sql
CREATE DATABASE downstash;
```

2. Configure environment variables:
```bash
export DOWNSTASH_MYSQL_HOST=localhost
export DOWNSTASH_MYSQL_PORT=3306
export DOWNSTASH_MYSQL_USER=root
export DOWNSTASH_MYSQL_PASSWORD=your_password
export DOWNSTASH_MYSQL_DATABASE=downstash
```

3. Run downstash:
```bash
downstash
```

### Features

- **QStash Message Persistence**: All QStash messages (pending, in-flight, delivered, failed) are stored in MySQL
- **Redis Data Persistence**: Redis string, hash, list, set, and sorted set data types are persisted in MySQL
- **Automatic Schema**: Tables are created automatically on first connection
- **Connection Pooling**: Uses MySQL connection pool for better performance

### Schema

`downstash` creates the following tables automatically:

- `messages`: QStash message queue
- `tokens`: Authentication tokens
- `redis_data`: Redis key-value storage

## Limitations

- Single process per developer. Not for shared/staging use.
- The QStash bearer token is not validated against any registry — any non-empty `Authorization: Bearer <anything>` is accepted. The Redis token is validated against the configured `--redis-token` (default `"dev"`).
- The Redis store is in-memory by default. Use MySQL storage for persistence.
- `downstash` mirrors Upstash's wire shape closely but is not a perfect bug-for-bug clone of production. File issues if your code path depends on a corner that we don't yet match.

## License

MIT - Derived from [sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash](https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash).
