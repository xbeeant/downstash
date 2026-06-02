import type { Db, MessageRow, TokenRow } from "../db.ts";
import { newMessageId } from "../ids.ts";
import type { Logger } from "../logger.ts";
import { signRequest } from "../signing.ts";
import { backoffMs } from "./backoff.ts";

export interface DeliverDeps {
  db: Db;
  logger: Logger;
  defaultSigningKey: string;
  fetchImpl?: typeof fetch;
}

const signingKeyCache = new Map<number, TokenRow>();

async function getSigningKey(
  db: Db,
  tokenId: number | null,
  defaultSigningKey: string,
): Promise<string> {
  if (tokenId === null) {
    return defaultSigningKey;
  }

  const cached = signingKeyCache.get(tokenId);
  if (cached) {
    return cached.currentSigningKey;
  }

  const tokenRow = await db.verifyTokenByUserId(tokenId);
  if (tokenRow) {
    signingKeyCache.set(tokenId, tokenRow);
    return tokenRow.currentSigningKey;
  }

  return defaultSigningKey;
}

export async function deliverMessage(message: MessageRow, deps: DeliverDeps): Promise<void> {
  const { db, logger } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;

  const signingKey = await getSigningKey(db, message.tokenId, deps.defaultSigningKey);
  const jwt = await signRequest({
    destination: message.destination,
    messageId: message.id,
    body: message.body,
    signingKey,
  });

  const headers = new Headers();
  for (const [k, v] of Object.entries(message.forwardHeaders)) {
    headers.set(k, v);
  }
  headers.set("Upstash-Signature", jwt);
  headers.set("Upstash-Message-Id", message.id);
  headers.set("Upstash-Retried", String(message.attempt));

  const init: RequestInit = {
    method: message.method,
    headers,
    signal: AbortSignal.timeout(message.timeoutMs),
  };
  if (!isBodyless(message.method)) {
    init.body = message.body;
  }

  let response: Response | null = null;
  let errorText: string | null = null;
  try {
    response = await fetchImpl(message.destination, init);
  } catch (err) {
    errorText = String(err);
  }

  const now = Date.now();
  if (response?.ok) {
    await db.markDelivered(message.id, now);
    logger.info("delivered", {
      messageId: message.id,
      destination: message.destination,
      status: response.status,
      attempt: message.attempt,
    });
    if (message.callbackUrl) {
      await enqueueCallback(message, response, "callback", deps);
    }
    return;
  }

  const failureMessage = errorText ?? `non-2xx status ${response?.status ?? "unknown"}`;
  const nextAttempt = message.attempt + 1;
  if (nextAttempt > message.retries) {
    await db.moveToDlq(message.id, failureMessage, now);
    logger.warn("failed (retries exhausted, moved to dlq)", {
      messageId: message.id,
      destination: message.destination,
      attempts: nextAttempt,
      lastError: failureMessage,
    });
    if (message.failureCallbackUrl) {
      await enqueueFailureCallback(message, response, failureMessage, deps);
    }
    return;
  }

  const wait = backoffMs(nextAttempt);
  await db.rescheduleRetry(message.id, nextAttempt, now + wait, failureMessage, now);
  logger.info("retry scheduled", {
    messageId: message.id,
    destination: message.destination,
    attempt: nextAttempt,
    waitMs: wait,
    lastError: failureMessage,
  });
}

async function enqueueCallback(
  message: MessageRow,
  response: Response,
  kind: "callback",
  deps: DeliverDeps,
): Promise<void> {
  const responseBody = await safeReadBytes(response);
  const envelope = {
    status: response.status,
    header: headersToObject(response.headers),
    body: bytesToBase64(responseBody),
    sourceMessageId: message.id,
    retried: message.attempt,
  };
  await enqueueDerivedMessage(message.callbackUrl!, envelope, deps, kind);
}

async function enqueueFailureCallback(
  message: MessageRow,
  response: Response | null,
  errorText: string,
  deps: DeliverDeps,
): Promise<void> {
  const responseBody = response ? await safeReadBytes(response) : new Uint8Array();
  const envelope = {
    status: response?.status ?? 0,
    header: response ? headersToObject(response.headers) : {},
    body: bytesToBase64(responseBody),
    sourceMessageId: message.id,
    retried: message.attempt,
    error: errorText,
  };
  await enqueueDerivedMessage(message.failureCallbackUrl!, envelope, deps, "failureCallback");
}

async function enqueueDerivedMessage(
  url: string,
  envelope: Record<string, unknown>,
  deps: DeliverDeps,
  kind: "callback" | "failureCallback",
): Promise<void> {
  const body = new TextEncoder().encode(JSON.stringify(envelope));
  const id = newMessageId();
  await deps.db.insertMessage({
    id,
    destination: url,
    method: "POST",
    body,
    forwardHeaders: { "Content-Type": "application/json" },
    retries: 3,
    notBeforeMs: Date.now(),
    timeoutMs: 30_000,
    callbackUrl: null,
    failureCallbackUrl: null,
  });
  deps.logger.debug("enqueued derived message", { kind, url, id });
}

function isBodyless(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

function headersToObject(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

async function safeReadBytes(response: Response): Promise<Uint8Array> {
  try {
    const buf = await response.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return new Uint8Array();
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return typeof btoa === "function"
    ? btoa(binary)
    : Buffer.from(binary, "binary").toString("base64");
}
