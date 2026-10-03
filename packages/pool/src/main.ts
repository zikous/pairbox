import { config } from "./config";
import { createServer } from "./server";

const app = await createServer({
  internalSecret: config.internalSecret,
  logger: config.logger,
});

await app.listen({ host: config.host, port: config.port });
