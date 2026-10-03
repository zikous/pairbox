import { config } from "./config";
import { WorkerSandboxes } from "./adapters/sandbox/worker-sandboxes";
import { connectDatabase } from "./adapters/storage/database";
import { createServer } from "./server";

const database = await connectDatabase(config.databaseUrl);

const app = await createServer({
  db: database.db,
  sandboxes: new WorkerSandboxes(config.poolUrl, config.internalSecret),
  publicUrl: config.publicUrl,
  tunnelStatusUrl: config.tunnelStatusUrl,
  logger: config.logger,
});
app.addHook("onClose", () => database.close());

await app.listen({ host: config.host, port: config.port });
