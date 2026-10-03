import { config } from "./config";
import { WorkerSandboxes } from "./adapters/sandbox/worker-sandboxes";
import { HttpScheduler } from "./adapters/scheduling/http-scheduler";
import { connectDatabase } from "./adapters/storage/database";
import { S3RecordingStore } from "./adapters/storage/s3-recording-store";
import { createServer } from "./server";

const database = await connectDatabase(config.databaseUrl);

const app = await createServer({
  db: database.db,
  sandboxes: new WorkerSandboxes(config.poolUrl, config.internalSecret),
  scheduler: new HttpScheduler(config.schedulerUrl, config.internalSecret),
  recordingStore: await S3RecordingStore.connect(config.s3),
  publicUrl: config.publicUrl,
  tunnelStatusUrl: config.tunnelStatusUrl,
  logger: config.logger,
});
app.addHook("onClose", () => database.close());

await app.listen({ host: config.host, port: config.port });
