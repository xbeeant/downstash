import { SignJWT, jwtVerify } from "jose";

export interface JwtClaims {
  iss: string;
  sub: string;
  iat: number;
  nbf: number;
  exp: number;
  jti: string;
  body: string;
}

export interface SignArgs {
  destination: string;
  messageId: string;
  body: Uint8Array;
  /**
   * Current signing key used to sign the JWT.
   * This is the primary key used for signing.
   */
  currentSigningKey: string;
  /**
   * Optional next signing key.
   * When provided, allows signing with the next key for key rotation testing.
   * @see https://upstash.com/docs/qstash/howto/roll-signing-keys
   */
  nextSigningKey?: string;
  /**
   * Which key to use for signing.
   * - "current": Use currentSigningKey (default)
   * - "next": Use nextSigningKey (for key rotation testing)
   */
  useKey?: "current" | "next";
  now?: number;
  ttlSeconds?: number;
  logger?: Logger;
}

export interface Logger {
  debug: (msg: string, fields?: Record<string, unknown>) => void;
  info: (msg: string, fields?: Record<string, unknown>) => void;
  warn: (msg: string, fields?: Record<string, unknown>) => void;
  error: (msg: string, fields?: Record<string, unknown>) => void;
}

/**
 * Signs a request according to the Upstash QStash signature specification.
 *
 * The JWT is signed using HMAC SHA256 algorithm with the following claims:
 * - iss: Always "Upstash"
 * - sub: The destination URL
 * - iat: Unix timestamp in seconds when the JWT was created
 * - nbf: Unix timestamp in seconds before which the JWT should not be accepted
 * - exp: Unix timestamp in seconds after which the JWT expires (default: 5 minutes)
 * - jti: A unique identifier for the token (message ID)
 * - body: Base64 URL encoded SHA-256 hash of the request body
 *
 * Supports key rotation by allowing signing with either currentSigningKey or nextSigningKey.
 * The QStash Receiver.verify() will try both keys when verifying.
 *
 * @see https://upstash.com/docs/qstash/howto/signature
 * @see https://upstash.com/docs/qstash/features/security#claims
 * @see https://upstash.com/docs/qstash/howto/roll-signing-keys
 */
export async function signRequest(args: SignArgs): Promise<string> {
  const {
    logger,
    destination,
    messageId,
    body,
    currentSigningKey,
    nextSigningKey,
    useKey,
    now,
    ttlSeconds,
  } = args;

  const keyToUse = useKey ?? "current";
  const signingKey =
    keyToUse === "next" ? (nextSigningKey ?? currentSigningKey) : currentSigningKey;

  if (keyToUse === "next" && !nextSigningKey) {
    logger?.warn(
      "signRequest: useKey is 'next' but nextSigningKey is not provided, falling back to currentSigningKey",
    );
  }

  logger?.debug("signRequest called with raw data", {
    destination,
    messageId,
    bodyLength: body.length,
    bodyPreview:
      body.length > 100
        ? new TextDecoder().decode(body.slice(0, 100)) + "..."
        : new TextDecoder().decode(body),
    currentSigningKey: currentSigningKey.slice(0, 8) + "..." + currentSigningKey.slice(-8),
    nextSigningKey: nextSigningKey
      ? nextSigningKey.slice(0, 8) + "..." + nextSigningKey.slice(-8)
      : undefined,
    keyUsed: keyToUse,
    now: now ?? Date.now(),
    ttlSeconds: ttlSeconds ?? 5 * 60,
  });

  const nowSec = Math.floor((now ?? Date.now()) / 1000);
  const ttl = ttlSeconds ?? 5 * 60;

  const bodyHash = await sha256Base64Url(body);

  // Create a secret key for jose
  const secretKey = new TextEncoder().encode(signingKey);

  // Build and sign the JWT using jose
  const jwt = await new SignJWT({
    iss: "Upstash",
    sub: destination,
    iat: nowSec,
    nbf: nowSec,
    exp: nowSec + ttl,
    jti: messageId,
    body: bodyHash,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(nowSec)
    .setNotBefore(nowSec)
    .setExpirationTime(nowSec + ttl)
    .sign(secretKey);

  return jwt;
}

/**
 * Verifies a JWT token using the provided signing key.
 *
 * @param token - The JWT token to verify
 * @param signingKey - The key used to verify the signature
 * @returns The verified claims if successful
 */
export async function verifyRequest(token: string, signingKey: string): Promise<JwtClaims> {
  const secretKey = new TextEncoder().encode(signingKey);
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: ["HS256"],
  });

  return payload as JwtClaims;
}

/**
 * Computes SHA-256 hash of the input and encodes it using Base64 URL encoding.
 *
 * Per RFC 4648 Section 5, the URL-safe base64 encoding replaces:
 * - '+' with '-'
 * - '/' with '_'
 * - Removes trailing '=' padding characters
 */
async function sha256Base64Url(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Base64 URL encoding as specified in RFC 4648 Section 5.
 *
 * Converts bytes to URL-safe base64 string:
 * 1. Converts Uint8Array to binary string
 * 2. Encodes using standard base64
 * 3. Replaces '+' with '-', '/' with '_'
 * 4. Removes trailing '=' padding
 */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 =
    typeof btoa === "function" ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return b64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
