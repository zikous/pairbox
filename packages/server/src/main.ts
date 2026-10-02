import { config } from "./config";
import { createServer } from "./server";

const app = await createServer({
  hostSecret: config.hostSecret,
  logger: config.production ? true : { transport: { target: "pino-pretty" } },
});

await app.listen({ host: config.host, port: config.port });
if (!config.production) {
  app.log.info(
    `API docs: http://${config.host}:${config.port}/docs (host secret: "${config.hostSecret}")`,
  );
}
