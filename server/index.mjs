import "dotenv/config";
import { createRuntime } from "./install.mjs";

const runtime = await createRuntime();
const production = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 3001);
if (production) {
  const { attachFrontend } = await import("./frontend.mjs");
  await attachFrontend(runtime.app);
}
const server = runtime.app.listen(port, "0.0.0.0", () => {
  console.log(
    `YI FAN ${production ? "website" : "API"} ready: http://localhost:${port}`,
  );
  if (!runtime.installed())
    console.log(
      `Open /install to configure MySQL. Installation key file: ${runtime.keyFile}`,
    );
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    server.closeAllConnections();
    server.close();
    await runtime.close();
    process.exit(0);
  });
