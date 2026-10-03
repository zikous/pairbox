import { z } from "zod";
import { readEnv } from "@pairbox/shared";

export const config = readEnv(
  z
    .object({
      POOL_HOST: z.string(),
      POOL_PORT: z.coerce.number().int(),
      INTERNAL_SECRET: z.string(),
      NODE_ENV: z.string().optional(),
    })
    .transform((env) => ({
      host: env.POOL_HOST,
      port: env.POOL_PORT,
      internalSecret: env.INTERNAL_SECRET,
      logger: env.NODE_ENV === "production" ? true : { transport: { target: "pino-pretty" } },
    })),
  process.env,
);
