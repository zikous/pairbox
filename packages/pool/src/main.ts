import { config } from "./config";
import { createServer } from "./server";

const app = await createServer({
  internalSecret: config.internalSecret,
  logger: config.production ? true : { transport: { target: "pino-pretty" } },
});

await app.listen({ host: config.host, port: config.port });
