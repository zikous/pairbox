import { z } from "zod";
import { readEnv } from "@pairbox/shared";

export const config = readEnv(
  z
    .object({
      API_HOST: z.string(),
      API_PORT: z.coerce.number().int(),
      INTERNAL_SECRET: z.string(),
      DATABASE_URL: z.string(),
      POOL_URL: z.url(),
      SCHEDULER_URL: z.url(),
      /** The app's public address for invite links; else the tunnel's, if one runs. */
      PUBLIC_URL: z.url().optional(),
      TUNNEL_STATUS_URL: z.url().optional(),
      /** Object storage (any S3-compatible service) for session recordings. */
      S3_ENDPOINT: z.url(),
      S3_REGION: z.string().default("us-east-1"),
      S3_BUCKET: z.string(),
      S3_ACCESS_KEY: z.string(),
      S3_SECRET_KEY: z.string(),
      NODE_ENV: z.string().optional(),
    })
    .transform((env) => ({
      host: env.API_HOST,
      port: env.API_PORT,
      internalSecret: env.INTERNAL_SECRET,
      databaseUrl: env.DATABASE_URL,
      poolUrl: env.POOL_URL,
      schedulerUrl: env.SCHEDULER_URL,
      publicUrl: env.PUBLIC_URL,
      tunnelStatusUrl: env.TUNNEL_STATUS_URL,
      s3: {
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        bucket: env.S3_BUCKET,
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      production: env.NODE_ENV === "production",
      logger: env.NODE_ENV === "production" ? true : { transport: { target: "pino-pretty" } },
    })),
  process.env,
);
