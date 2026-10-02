import { z } from "zod";

/** Body of every HTTP error response. */
export const ErrorSchema = z.object({ error: z.string() }).meta({ id: "Error" });
export type ApiError = z.infer<typeof ErrorSchema>;
