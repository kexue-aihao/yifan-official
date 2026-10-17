// Isolated real MySQL schema, created before installation; never uses site data.
import { randomBytes } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { attachFrontend } from "../server/frontend.mjs";
import { createTestDatabase } from "../tests/mysql-fixture.mjs";
import { createRuntime } from "../server/install.mjs";

process.env.SETTINGS_ENCRYPTION_KEY = randomBytes(32).toString("hex");
const fixture = await createTestDatabase({ initialize: false });
const directory = mkdtempSync(join(tmpdir(), "yifan-ui-"));
process.env.YIFAN_DATA_DIR = directory;
const runtime = await createRuntime({
  dataDir: directory,
  origin: "http://127.0.0.1:4174",
  testing: true,
});
const frontend = await attachFrontend(runtime.app);
mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/ui-fixture.json",
  JSON.stringify({
    connection: fixture.config,
    key: readFileSync(join(directory, "install.key"), "utf8"),
    directory,
  }),
  { mode: 0o600 },
);
const server = runtime.app.listen(4174, "127.0.0.1", () =>
  console.log("Isolated Vue 3 SSR + MySQL UI server on 4174"),
);
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    if (closing) return;
    closing = true;
    server.closeAllConnections();
    server.close();
    await runtime.close();
    await fixture.cleanup();
    await frontend.close();
    rmSync(directory, { recursive: true, force: true });
    process.exit(0);
  });
