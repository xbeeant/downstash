import { Hono } from "hono";
import type { Db } from "./db.ts";
import type { Logger } from "./logger.ts";
import type { MysqlRedisStore } from "./redis/mysql-store.ts";
import { dlqRoute } from "./routes/dlq.ts";
import { eventsRoute } from "./routes/events.ts";
import { healthRoute } from "./routes/health.ts";
import { messagesRoute } from "./routes/messages.ts";
import { publishRoute } from "./routes/publish.ts";
import { queuesRoute } from "./routes/queues.ts";
import { redisRoute } from "./routes/redis.ts";
import { schedulesRoute } from "./routes/schedules.ts";
import { urlGroupsRoute } from "./routes/url-groups.ts";

export interface ServerDeps {
  db: Db;
  logger: Logger;
  redisStore?: MysqlRedisStore;
  redisToken?: string;
}

export function createServer({ db, logger, redisStore, redisToken }: ServerDeps): Hono {
  const app = new Hono();

  app.use("*", async (c, next) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;
    const requestId = crypto.randomUUID();

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    logger.info("request completed", {
      requestId,
      method,
      path,
      status,
      durationMs: duration,
    });
  });

  app.onError((err, c) => {
    logger.error("unhandled server error", { error: String(err) });
    return c.json({ error: "internal_error" }, 500);
  });

  app.get("/health", (c) => c.json({ status: "ok" }));

  const downstashApp = new Hono();
  downstashApp.route("/", healthRoute());
  downstashApp.route("/", publishRoute({ db, logger }));
  downstashApp.route("/", messagesRoute({ db }));
  downstashApp.route("/", schedulesRoute({ db, logger }));
  downstashApp.route("/", queuesRoute({ db, logger }));
  downstashApp.route("/", urlGroupsRoute({ db, logger }));
  downstashApp.route("/", eventsRoute({ db }));
  downstashApp.route("/", dlqRoute({ db }));

  if (redisStore) {
    downstashApp.route("/", redisRoute({ store: redisStore, logger, redisToken: redisToken ?? "dev" }));
  }

  app.route("/downstash", downstashApp);

  return app;
}
