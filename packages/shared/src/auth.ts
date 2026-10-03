import { z } from "zod";

export const PASSWORD_MIN = 8;

/** Body of `POST /api/auth/signup` and `POST /api/auth/login`. */
export const CredentialsSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().min(PASSWORD_MIN).max(128),
  })
  .meta({ id: "Credentials" });
export type Credentials = z.infer<typeof CredentialsSchema>;

export const UserSchema = z.object({ id: z.uuid(), email: z.email() }).meta({ id: "User" });
export type User = z.infer<typeof UserSchema>;
