import type { Db } from "../db.ts";
import type { Logger } from "../logger.ts";
import { deliverMessage } from "./deliver.ts";

export interface WorkerOptions {
  db: Db;
  logger: Logger;
  currentSigningKey: string;
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

  async function tick(): Promise<void> {
    const due = await opts.db.claimDue(batchSize, Date.now());
    for (const msg of due) {
      const p = deliverMessage(msg, {
        db: opts.db,
        logger: opts.logger,
        currentSigningKey: opts.currentSigningKey,
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
