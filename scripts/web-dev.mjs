import "dotenv/config";
import express from "express";
import http from "node:http";
import { attachFrontend } from "../server/frontend.mjs";

const app = express();
app.use("/api", (req, res) => {
  const proxy = http.request(
    {
      hostname: "127.0.0.1",
      port: 3001,
      path: req.originalUrl,
      method: req.method,
      headers: req.headers,
    },
    (upstream) => {
      res.writeHead(upstream.statusCode, upstream.headers);
      upstream.pipe(res);
    },
  );
  proxy.on("error", () => {
    if (!res.headersSent) res.status(502).json({ error: "API unavailable" });
    else res.end();
  });
  req.on("aborted", () => proxy.destroy());
  res.on("close", () => proxy.destroy());
  req.pipe(proxy);
});
const frontend = await attachFrontend(app, { dev: true });
const server = app.listen(5173, "0.0.0.0", () =>
  console.log("Vue 3 preview: http://localhost:5173"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    server.closeAllConnections();
    server.close();
    await frontend.close();
    process.exit(0);
  });
