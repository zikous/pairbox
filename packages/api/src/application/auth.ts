import type { Credentials, User } from "@pairbox/shared";
import { EmailTakenError, InvalidCredentialsError } from "./errors";
import type { PasswordHasher, SessionRepository, UserRepository } from "./ports";

const SESSION_DAYS = 30;

/** Accounts and sessions. A session is a random token; only its hash is stored. */
export class AuthService {
  /** A real hash of a throwaway password, checked when the email doesn't exist. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  async signUp({ email, password }: Credentials) {
    const user = await this.users.create(email, await this.passwords.hash(password));
    if (!user) throw new EmailTakenError();
    return { user, ...(await this.startSession(user)) };
  }

  async signIn({ email, password }: Credentials) {
    const found = await this.users.findByEmail(email);
    // Hash even for unknown emails, so timing doesn't reveal which emails have accounts.
    this.dummyHash ??= this.passwords.hash("not a real password");
    const valid = await this.passwords.verify(
      password,
      found?.passwordHash ?? (await this.dummyHash),
    );
    if (!found || !valid) throw new InvalidCredentialsError();
    const user = { id: found.id, email: found.email };
    return { user, ...(await this.startSession(user)) };
  }

  async signOut(token: string): Promise<void> {
    await this.sessions.delete(await hashToken(token));
  }

  /** The signed-in user behind a session token, if it is still valid. */
  async userFor(token: string): Promise<User | undefined> {
    return this.sessions.findUser(await hashToken(token));
  }

  private async startSession(user: User) {
    const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await this.sessions.create({ tokenHash: await hashToken(token), userId: user.id, expiresAt });
    return { token, expiresAt };
  }
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Buffer.from(digest).toString("hex");
}
