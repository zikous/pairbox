import { z } from "zod";
import { readEnv } from "@pairbox/shared";

export const config = readEnv(
  z
    .object({
      SCHEDULER_HOST: z.string(),
      SCHEDULER_PORT: z.coerce.number().int(),
      INTERNAL_SECRET: z.string(),
      DATABASE_URL: z.string(),
      POOL_URL: z.url(),
      NODE_ENV: z.string().optional(),
    })
    .transform((env) => ({
      host: env.SCHEDULER_HOST,
      port: env.SCHEDULER_PORT,
      internalSecret: env.INTERNAL_SECRET,
      databaseUrl: env.DATABASE_URL,
      poolUrl: env.POOL_URL,
      logger: env.NODE_ENV === "production" ? true : { transport: { target: "pino-pretty" } },
    })),
  process.env,
);
