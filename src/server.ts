import { Hono } from "hono";
import type { Db } from "./db.ts";
import type { Logger } from "./logger.ts";
import type { RedisStore } from "./redis/store.ts";
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
  redisStore?: RedisStore;
  redisToken?: string;
}

export function createServer({ db, logger, redisStore, redisToken }: ServerDeps): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    logger.error("unhandled server error", { error: String(err) });
    return c.json({ error: "internal_error" }, 500);
  });

  app.route("/", healthRoute());
  app.route("/", publishRoute({ db, logger }));
  app.route("/", messagesRoute({ db }));
  app.route("/", schedulesRoute({ db, logger }));
  app.route("/", queuesRoute({ db, logger }));
  app.route("/", urlGroupsRoute({ db, logger }));
  app.route("/", eventsRoute({ db }));
  app.route("/", dlqRoute({ db }));

  if (redisStore) {
    app.route("/", redisRoute({ store: redisStore, logger, redisToken: redisToken ?? "dev" }));
  }

  return app;
}
