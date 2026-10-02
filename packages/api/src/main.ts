import { config } from "./config";
import { WorkerSandboxes } from "./adapters/sandbox/worker-sandboxes";
import { connectDatabase } from "./adapters/storage/database";
import { createServer } from "./server";

const database = await connectDatabase(config.databaseUrl);

const app = await createServer({
  hostSecret: config.hostSecret,
  db: database.db,
  sandboxes: new WorkerSandboxes(config.poolUrl, config.internalSecret),
  publicUrl: config.publicUrl,
  tunnelStatusUrl: config.tunnelStatusUrl,
  logger: config.production ? true : { transport: { target: "pino-pretty" } },
});
app.addHook("onClose", () => database.close());

await app.listen({ host: config.host, port: config.port });
if (!config.production) {
  app.log.info(
    `API docs: http://localhost:${config.port}/docs (host secret: "${config.hostSecret}")`,
  );
}
