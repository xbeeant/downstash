# downstash

一个本地开发服务器，模拟 [Upstash QStash](https://upstash.com/docs/qstash) 和 [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted)，用于快速、离线测试。

`downstash` 在您的笔记本电脑上运行，使用与生产环境 Upstash 相同的 HTTP API，因此官方的 [`@upstash/qstash`](https://www.npmjs.com/package/@upstash/qstash) 和 [`@upstash/redis`](https://www.npmjs.com/package/@upstash/redis) SDK 无需任何代码更改即可继续工作——只需将它们指向 `downstash`，即可在没有互联网连接的情况下完成完整的往返测试。

---

## 特性

### QStash 模拟服务

| 功能 | 状态 | 说明 |
|---|---|---|
| `POST /v2/publish/:dest` | ✅ 已实现 | 原始 body 直接转发 |
| `POST /v2/publishJSON/:dest` | ✅ 已实现 | 默认 `Content-Type: application/json` |
| `Upstash-Method` | ✅ 已实现 | 每条消息的 HTTP 方法 |
| `Upstash-Delay` / `Upstash-Not-Before` | ✅ 已实现 | 调度延迟 |
| `Upstash-Retries` | ✅ 已实现 | 指数退避，上限 1 小时 |
| `Upstash-Timeout` | ✅ 已实现 | 每次尝试的超时时间 |
| `Upstash-Forward-*` | ✅ 已实现 | 转发时自动去除前缀 |
| `Upstash-Callback` | ✅ 已实现 | 成功回调 |
| `Upstash-Failure-Callback` | ✅ 已实现 | 重试耗尽后触发 |
| `Upstash-Signature` JWT 签名 | ✅ 已实现 | HS256，可被 `@upstash/qstash` `Receiver` 验证 |
| `GET /v2/messages/:id` / `DELETE /v2/messages/:id` | ✅ 已实现 | 查询或取消待处理消息 |
| `POST /v2/batch` | ✅ 已实现 | 批量发布 |

---

## 安装

需要 [Bun](https://bun.com/) `>= 1.1.0`。

```bash
git clone https://github.com/xbeeant/downstash
cd downstash
bun install
```
---

## 使用方法

### 配置您的应用

添加 `.env.local` 文件配置 QStash 和 Redis SDK：

```env
# QStash 配置
QSTASH_URL=http://localhost:8080
QSTASH_TOKEN=dev
QSTASH_CURRENT_SIGNING_KEY=sig_downstash_current_dev_key_do_not_use_in_prod
QSTASH_NEXT_SIGNING_KEY=sig_downstash_next_dev_key_do_not_use_in_prod

# Redis 配置
UPSTASH_REDIS_REST_URL=http://localhost:8080
UPSTASH_REDIS_REST_TOKEN=dev

# 可选：MySQL 持久化配置（默认使用 SQLite）
# DOWNSTASH_MYSQL_HOST=localhost
# DOWNSTASH_MYSQL_PORT=3306
# DOWNSTASH_MYSQL_USER=root
# DOWNSTASH_MYSQL_PASSWORD=your_password
# DOWNSTASH_MYSQL_DATABASE=downstash

# 可选：服务器配置
# DOWNSTASH_PORT=8080
# DOWNSTASH_TICK_MS=250
# DOWNSTASH_LOG_LEVEL=info
```

随时打印当前密钥和 Redis 配置：

```bash
downstash keys
```

### 环境变量说明

| 环境变量 | 说明 | 默认值 |
|---|---|---|
| `QSTASH_URL` | QStash API 地址 | http://localhost:8080 |
| `QSTASH_TOKEN` | QStash 认证令牌 | dev |
| `QSTASH_CURRENT_SIGNING_KEY` | 当前签名密钥 | sig_downstash_current_dev_key_do_not_use_in_prod |
| `QSTASH_NEXT_SIGNING_KEY` | 下一个签名密钥 | sig_downstash_next_dev_key_do_not_use_in_prod |
| `UPSTASH_REDIS_REST_URL` | Redis REST API 地址 | http://localhost:8080 |
| `UPSTASH_REDIS_REST_TOKEN` | Redis 认证令牌 | dev |
| `DOWNSTASH_PORT` | 服务器端口 | 8080 |
| `DOWNSTASH_TICK_MS` | 消息投递循环间隔（毫秒） | 250 |
| `DOWNSTASH_LOG_LEVEL` | 日志级别 | info |
| `DOWNSTASH_MYSQL_HOST` | MySQL 主机（启用 MySQL 时） | localhost |
| `DOWNSTASH_MYSQL_PORT` | MySQL 端口 | 3306 |
| `DOWNSTASH_MYSQL_USER` | MySQL 用户 | root |
| `DOWNSTASH_MYSQL_PASSWORD` | MySQL 密码 | 空 |
| `DOWNSTASH_MYSQL_DATABASE` | MySQL 数据库名 | downstash |

### QStash 使用示例

`Client` 和 `Receiver` 构造函数无需修改：

```ts
import { Client, Receiver } from "@upstash/qstash";

const client = new Client({
  baseUrl: process.env.QSTASH_URL!,
  token: process.env.QSTASH_TOKEN!,
});

await client.publishJSON({
  url: "http://localhost:3000/api/echo",
  body: { hello: "world" },
  delay: 5,        // 秒
  retries: 3,
});

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

// 在路由处理器中验证签名：
const ok = await receiver.verify({
  signature: req.headers.get("upstash-signature")!,
  body: await req.text(),
  url: req.url,
});
```

### Redis 使用示例

`@upstash/redis` SDK 无需修改：

```ts
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

await redis.set("user:1", { name: "Alice", role: "admin" });
const user = await redis.get("user:1");
```

### CLI 命令

```
downstash                        启动服务器（默认端口 8080）
downstash serve                  显式启动子命令
downstash reset                  清空消息表
downstash keys                   打印签名密钥和 Redis 配置
downstash help                   显示帮助

选项：
  --port <n>                     HTTP 端口                          (环境变量: DOWNSTASH_PORT, 默认 8080)
  --db <path>                    SQLite 数据库文件                   (环境变量: DOWNSTASH_DB, 默认 .downstash/db.sqlite)
  --tick-ms <n>                  投递循环间隔                        (环境变量: DOWNSTASH_TICK_MS, 默认 250)
  --current-signing-key <s>      覆盖当前签名密钥                    (环境变量: DOWNSTASH_CURRENT_SIGNING_KEY)
  --next-signing-key <s>         覆盖下一个签名密钥                   (环境变量: DOWNSTASH_NEXT_SIGNING_KEY)
  --redis-token <s>              Redis 认证令牌                      (环境变量: DOWNSTASH_REDIS_TOKEN, 默认 "dev")
  --log-level <level>            debug | info | warn | error        (环境变量: DOWNSTASH_LOG_LEVEL)
  --quiet                        等同于 --log-level=warn
```

---

## Docker 镜像使用

### 使用 Docker Compose（推荐）

最简单的方式是使用 `docker-compose`：

```bash
# 启动 MySQL 和 downstash
docker-compose up -d

# 查看日志
docker-compose logs -f downstash
```

### 手动运行 Docker 镜像

```bash
# 拉取镜像（或自行构建）
docker build -t downstash .

# 使用 SQLite（内存存储）运行
docker run -p 8080:8080 downstash

# 使用 MySQL 运行
docker run -p 8080:8080 \
  -e DOWNSTASH_MYSQL_HOST=mysql-host \
  -e DOWNSTASH_MYSQL_PORT=3306 \
  -e DOWNSTASH_MYSQL_USER=root \
  -e DOWNSTASH_MYSQL_PASSWORD=your_password \
  -e DOWNSTASH_MYSQL_DATABASE=downstash \
  downstash
```

### Docker 环境变量

| 环境变量 | 说明 | 默认值 |
|---|---|---|
| `DOWNSTASH_PORT` | HTTP 端口 | 8080 |
| `DOWNSTASH_TICK_MS` | 投递循环间隔 | 250 |
| `DOWNSTASH_REDIS_TOKEN` | Redis 认证令牌 | dev |
| `DOWNSTASH_LOG_LEVEL` | 日志级别 | info |
| `DOWNSTASH_CURRENT_SIGNING_KEY` | 当前签名密钥 | （内置默认值） |
| `DOWNSTASH_NEXT_SIGNING_KEY` | 下一个签名密钥 | （内置默认值） |
| `DOWNSTASH_MYSQL_HOST` | MySQL 主机 | localhost |
| `DOWNSTASH_MYSQL_PORT` | MySQL 端口 | 3306 |
| `DOWNSTASH_MYSQL_USER` | MySQL 用户 | root |
| `DOWNSTASH_MYSQL_PASSWORD` | MySQL 密码 | 空 |
| `DOWNSTASH_MYSQL_DATABASE` | MySQL 数据库名 | downstash |

---

## 关于本项目

本项目基于 [sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash](https://github.com/sskcfC15Xfoxd7X1sVFgipdzMRAkP/downstash) 进行修改和扩展。

### 新增特性总结

1. **定时任务（Schedules）** - 支持 cron 表达式的定时消息发布
2. **队列（Queues）** - 支持队列管理和并行消息处理
3. **死信队列（DLQ）** - 支持失败消息的存储和重试
4. **URL 组（URL Groups）** - 支持主题/扇出发布模式
5. **事件日志（Events Log）** - 支持消息事件的查询和追踪
6. **MySQL 持久化** - 支持将消息和 Redis 数据持久化到 MySQL
7. **Token 认证** - 支持基于 Token 的身份验证机制

---

## 许可证

MIT