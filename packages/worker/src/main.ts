import { config } from "./config";
import { stayRegistered } from "./registration";
import { createServer } from "./server";

const app = await createServer({
  internalSecret: config.internalSecret,
  runtime: config.runtime,
  sandboxUser: config.sandboxUser,
  workspace: config.workspace,
  writableDirs: config.writableDirs,
  logger: config.production ? true : { transport: { target: "pino-pretty" } },
});

// Hooks must be added before the server starts listening.
let stopRegistration = () => {};
app.addHook("onClose", async () => stopRegistration());

await app.listen({ host: config.host, port: config.port });

// Only announce ourselves to the pool once we can actually take requests.
stopRegistration = stayRegistered({
  poolUrl: config.poolUrl,
  internalSecret: config.internalSecret,
  worker: { id: config.id, url: config.url, runtime: config.runtime },
  log: (message) => app.log.info(message),
});
