import { and, eq, gt } from "drizzle-orm";
import type { User } from "@pairbox/shared";
import type { SessionRepository, UserRepository } from "../../application/ports";
import type { Database } from "./database";
import { sessions, users } from "./schema";

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async create(email: string, passwordHash: string): Promise<User | undefined> {
    const [user] = await this.db
      .insert(users)
      .values({ email, passwordHash })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id, email: users.email });
    return user;
  }

  async findByEmail(email: string) {
    const [user] = await this.db
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email));
    return user;
  }
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async create(session: { tokenHash: string; userId: string; expiresAt: Date }): Promise<void> {
    await this.db.insert(sessions).values(session);
  }

  async findUser(tokenHash: string): Promise<User | undefined> {
    const [user] = await this.db
      .select({ id: users.id, email: users.email })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())));
    return user;
  }

  async delete(tokenHash: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }
}
