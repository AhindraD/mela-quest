import type { Server as HttpServer } from "node:http";
import { performance } from "node:perf_hooks";
import { Server } from "socket.io";
import {
  MAX_SOCKET_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  SOCKET_PATH,
  pingSchema,
  type ClientToServerEvents,
  type PingResult,
  type ServerToClientEvents,
} from "../shared/protocol.mts";

const PINGS_PER_SECOND = 10;

export function attachTransport(httpServer: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: SOCKET_PATH,
    serveClient: false,
    maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,
    destroyUpgrade: false,
    allowRequest: ({ headers }, accept) => {
      accept(null, headers.origin === undefined || headers.origin === `http://${headers.host}`);
    },
  });

  io.on("connection", (socket) => {
    let windowStartedAt = performance.now();
    let requests = 0;

    function handlePing(...args: unknown[]) {
      // Socket.IO appends the acknowledgment after the arguments sent on the wire.
      const acknowledge = args.at(-1);
      if (typeof acknowledge !== "function") return;
      const reply = acknowledge as (result: PingResult) => void;

      const now = performance.now();
      if (now - windowStartedAt >= 1000) {
        windowStartedAt = now;
        requests = 0;
      }
      if (++requests > PINGS_PER_SECOND) {
        reply({ ok: false, code: "RATE_LIMITED" });
        return;
      }

      const ping = pingSchema.safeParse(args[0]);
      if (args.length !== 2 || !ping.success) {
        reply({ ok: false, code: "INVALID_PAYLOAD" });
        return;
      }

      reply({ ok: true, version: PROTOCOL_VERSION, echo: ping.data.echo, serverTime: Date.now() });
    }

    socket.on("transport:ping", handlePing);
    socket.once("disconnect", () => socket.off("transport:ping", handlePing));
  });

  return io;
}
