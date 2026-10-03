import { config } from "./config";
import { PoolCapacity } from "./adapters/pool-capacity";
import { connectDatabase, PostgresBookings } from "./adapters/postgres-bookings";
import { createServer } from "./server";

const database = await connectDatabase(config.databaseUrl);

const app = await createServer({
  internalSecret: config.internalSecret,
  bookings: new PostgresBookings(database.db),
  capacity: new PoolCapacity(config.poolUrl, config.internalSecret),
  logger: config.logger,
});
app.addHook("onClose", () => database.close());

await app.listen({ host: config.host, port: config.port });
