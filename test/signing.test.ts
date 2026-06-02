import { describe, expect, test } from "bun:test";
import { Receiver } from "@upstash/qstash";
import { signRequest } from "../src/signing.ts";

describe("signing", () => {
  test("@upstash/qstash Receiver verifies our JWT", async () => {
    const currentSigningKey = "sig_test_current";
    const nextSigningKey = "sig_test_next";
    const destination = "http://localhost:3000/api/echo";
    const body = new TextEncoder().encode(JSON.stringify({ hello: "world" }));

    const jwt = await signRequest({
      destination,
      messageId: "msg_abc",
      body,
      currentSigningKey,
    });

    const receiver = new Receiver({ currentSigningKey, nextSigningKey });
    const ok = await receiver.verify({
      signature: jwt,
      body: new TextDecoder().decode(body),
      url: destination,
    });
    expect(ok).toBe(true);
  });

  test("Receiver verifies when signing with next key explicitly", async () => {
    const currentSigningKey = "sig_test_current";
    const nextSigningKey = "sig_test_next";
    const destination = "http://localhost:3000/api/echo";
    const body = new TextEncoder().encode("");

    const jwt = await signRequest({
      destination,
      messageId: "msg_xyz",
      body,
      currentSigningKey,
      nextSigningKey,
      useKey: "next",
    });

    const receiver = new Receiver({ currentSigningKey, nextSigningKey });
    const ok = await receiver.verify({
      signature: jwt,
      body: "",
      url: destination,
    });
    expect(ok).toBe(true);
  });

  test("Receiver verifies when signing with current key explicitly", async () => {
    const currentSigningKey = "sig_test_current";
    const nextSigningKey = "sig_test_next";
    const destination = "http://localhost:3000/api/echo";
    const body = new TextEncoder().encode(JSON.stringify({ test: "data" }));

    const jwt = await signRequest({
      destination,
      messageId: "msg_key_rotation",
      body,
      currentSigningKey,
      nextSigningKey,
      useKey: "current",
    });

    const receiver = new Receiver({ currentSigningKey, nextSigningKey });
    const ok = await receiver.verify({
      signature: jwt,
      body: new TextDecoder().decode(body),
      url: destination,
    });
    expect(ok).toBe(true);
  });

  test("Defaults to current key when useKey is not specified", async () => {
    const currentSigningKey = "sig_test_current";
    const nextSigningKey = "sig_test_next";
    const destination = "http://localhost:3000/api/echo";
    const body = new TextEncoder().encode(JSON.stringify({ default: "key" }));

    const jwt = await signRequest({
      destination,
      messageId: "msg_default",
      body,
      currentSigningKey,
      nextSigningKey,
    });

    const receiver = new Receiver({ currentSigningKey, nextSigningKey });
    const ok = await receiver.verify({
      signature: jwt,
      body: new TextDecoder().decode(body),
      url: destination,
    });
    expect(ok).toBe(true);
  });
});