import { io, type Socket } from "socket.io-client";
import { afterEach, expect, test } from "vitest";
import {
  PROTOCOL_VERSION,
  SOCKET_PATH,
  type ClientToServerEvents,
  type PingResult,
  type ServerToClientEvents,
} from "../../src/shared/protocol.mts";

const baseUrl = new URL(process.env.MELA_TEST_URL ?? "http://127.0.0.1:3000");
const clients: Socket<ServerToClientEvents, ClientToServerEvents>[] = [];

function connect(transport: "polling" | "websocket", origin = baseUrl.origin) {
  const client: Socket<ServerToClientEvents, ClientToServerEvents> = io(baseUrl.origin, {
    path: SOCKET_PATH,
    forceNew: true,
    transports: [transport],
    extraHeaders: { Origin: origin },
    reconnection: false,
  });
  clients.push(client);
  return client;
}

afterEach(() => {
  for (const client of clients.splice(0)) {
    client.disconnect();
    client.removeAllListeners();
  }
});

test("two same-origin clients use independent connections across HTTP and WebSocket", async () => {
  const health = await fetch(new URL("/api/health", baseUrl), { signal: AbortSignal.timeout(2000) });
  expect(health.status).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", service: "mela-io" });
  const page = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) });
  expect(page.status).toBe(200);
  expect(await page.text()).toContain("Welcome to the Festive Carnival");

  const polling = connect("polling");
  const websocket = connect("websocket");
  await expect.poll(() => polling.connected && websocket.connected).toBe(true);
  expect(polling.id).not.toBe(websocket.id);

  const ping = (client: typeof polling, echo: string) =>
    client.timeout(2000).emitWithAck("transport:ping", { version: PROTOCOL_VERSION, echo });
  const [first, second] = await Promise.all([ping(polling, "first"), ping(websocket, "second")]);
  expect(first).toEqual({ ok: true, version: 1, echo: "first", serverTime: expect.any(Number) });
  expect(second).toMatchObject({ ok: true, echo: "second" });

  const previousId = websocket.id;
  websocket.disconnect();
  expect(websocket.connected).toBe(false);
  websocket.connect();
  await expect.poll(() => websocket.connected).toBe(true);
  expect(websocket.id).not.toBe(previousId);
  expect(polling.connected).toBe(true);
  await expect(ping(websocket, "reconnected")).resolves.toMatchObject({ ok: true, echo: "reconnected" });
});

test("rejects malformed payloads and acknowledges the per-connection rate limit", async () => {
  const client = connect("websocket");
  await expect.poll(() => client.connected).toBe(true);

  // Send wire inputs that typed callers cannot produce.
  const untyped = client as Socket<ServerToClientEvents, {
    "transport:ping": (...args: [...unknown[], (result: PingResult) => void]) => void;
  }>;
  const results = await Promise.all([
    untyped.timeout(2000).emitWithAck("transport:ping"),
    untyped.timeout(2000).emitWithAck("transport:ping", { version: 2, echo: "unsupported" }),
    untyped.timeout(2000).emitWithAck("transport:ping", { version: 1, echo: "x".repeat(129) }),
    untyped.timeout(2000).emitWithAck("transport:ping", { version: 1, echo: 42 }),
  ]);
  expect(results).toEqual(Array.from({ length: 4 }, () => ({ ok: false, code: "INVALID_PAYLOAD" })));

  const burst = await Promise.all(Array.from({ length: 11 }, () =>
    client.timeout(2000).emitWithAck("transport:ping", { version: 1, echo: "burst" }),
  ));
  expect(burst).toContainEqual({ ok: false, code: "RATE_LIMITED" });
  expect(client.connected).toBe(true);
});

test("rejects an off-origin Socket.IO handshake", async () => {
  const client = connect("websocket", "http://example.invalid");
  await expect(new Promise((resolve) => client.once("connect_error", resolve)))
    .resolves.toBeInstanceOf(Error);
  expect(client.connected).toBe(false);
});
