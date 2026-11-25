import { once } from "node:events";
import { createServer } from "node:http";
import next from "next";
import { attachTransport } from "./src/server/transport.mts";

async function start() {
  const dev = process.argv.includes("--dev");
  if (!process.env.NODE_ENV) {
    Object.assign(process.env, { NODE_ENV: dev ? "development" : "production" });
  }
  const hostname = process.env.MELA_HOST ?? "127.0.0.1";
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535");
  }

  const server = createServer();
  const app = next({ dev, hostname, port, httpServer: server });
  await app.prepare();
  const handleRequest = app.getRequestHandler();
  server.on("request", (request, response) => {
    void handleRequest(request, response).catch((error: unknown) => {
      console.error("HTTP request failed", error);
      if (response.headersSent) {
        response.destroy();
      } else {
        response.writeHead(500).end("Internal server error");
      }
    });
  });
  const io = attachTransport(server);

  server.listen(port, hostname);
  await once(server, "listening");
  console.info(`Mela.io listening at http://${hostname}:${port}`);

  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 8000);
    deadline.unref();
    try {
      await io.close();
      await app.close();
      clearTimeout(deadline);
    } catch (error) {
      console.error("Mela.io shutdown failed", error);
      process.exit(1);
    }
  }

  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
}

await start().catch((error: unknown) => {
  console.error("Mela.io startup failed", error);
  process.exit(1);
});
