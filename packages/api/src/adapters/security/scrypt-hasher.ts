import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import type { PasswordHasher } from "../../application/ports";

const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_BYTES = 64;

/** Hashes as `scrypt$N$r$p$salt$key` (base64url), so parameters can change later. */
export class ScryptHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt, PARAMS);
    return [
      "scrypt",
      PARAMS.N,
      PARAMS.r,
      PARAMS.p,
      salt.toString("base64url"),
      key.toString("base64url"),
    ].join("$");
  }

  async verify(password: string, hash: string): Promise<boolean> {
    const [scheme, N, r, p, salt, key] = hash.split("$");
    if (scheme !== "scrypt" || !salt || !key) return false;
    const expected = Buffer.from(key, "base64url");
    const actual = await derive(password, Buffer.from(salt, "base64url"), {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_BYTES, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
