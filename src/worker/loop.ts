import type { Db, InsertMessage } from "../db.ts";
import { newMessageId } from "../ids.ts";
import type { Logger } from "../logger.ts";
import { deliverMessage } from "./deliver.ts";
import { parseCronExpression } from "../cron.ts";

export interface WorkerOptions {
  db: Db;
  logger: Logger;
  defaultSigningKey: string;
  tickMs: number;
  batchSize?: number;
  fetchImpl?: typeof fetch;
}

export interface Worker {
  start: () => void;
  stop: () => Promise<void>;
  tick: () => Promise<void>;
}

export function createWorker(opts: WorkerOptions): Worker {
  const batchSize = opts.batchSize ?? 32;
  let timer: Timer | null = null;
  let stopping = false;
  const inFlight = new Set<Promise<void>>();

  async function processSchedules(now: number): Promise<void> {
    const dueSchedules = await opts.db.claimDueSchedules(now);
    for (const schedule of dueSchedules) {
      const msgId = newMessageId();
      const insertMsg: InsertMessage = {
        id: msgId,
        destination: schedule.destination,
        method: schedule.method,
        body: schedule.body,
        forwardHeaders: schedule.forwardHeaders,
        retries: schedule.retries,
        notBeforeMs: now,
        timeoutMs: schedule.timeoutMs,
        callbackUrl: schedule.callbackUrl,
        failureCallbackUrl: schedule.failureCallbackUrl,
      };
      await opts.db.insertMessage(insertMsg);

      const nextRun = computeNextCronRun(schedule.cron, now);
      await opts.db.updateScheduleNextRun(schedule.id, now, nextRun);

      opts.logger.info("scheduled message triggered", {
        scheduleId: schedule.id,
        messageId: msgId,
        destination: schedule.destination,
      });
    }
  }

  async function tick(): Promise<void> {
    const now = Date.now();

    await processSchedules(now);

    const due = await opts.db.claimDue(batchSize, now);
    for (const msg of due) {
      const p = deliverMessage(msg, {
        db: opts.db,
        logger: opts.logger,
        defaultSigningKey: opts.defaultSigningKey,
        fetchImpl: opts.fetchImpl,
      })
        .catch((err) =>
          opts.logger.error("worker delivery threw", {
            messageId: msg.id,
            error: String(err),
          }),
        )
        .finally(() => {
          inFlight.delete(p);
        });
      inFlight.add(p);
    }
  }

  function computeNextCronRun(cron: string, now: number): number {
    try {
      return parseCronExpression(cron);
    } catch (error) {
      opts.logger.error("failed to parse cron expression", {
        cron,
        error: String(error),
      });
      return now + 60 * 1000;
    }
  }

  function scheduleNext(): void {
    if (stopping) return;
    timer = setTimeout(async () => {
      try {
        await tick();
      } catch (err) {
        opts.logger.error("worker tick failed", { error: String(err) });
      }
      scheduleNext();
    }, opts.tickMs);
  }

  return {
    start() {
      stopping = false;
      scheduleNext();
    },
    async stop() {
      stopping = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await Promise.allSettled(inFlight);
    },
    tick,
  };
}
