import { eq } from "drizzle-orm";
import type { RoomId } from "@pairbox/shared";
import type { WorkspaceRepository } from "../../application/ports";
import type { Database } from "./database";
import { workspaces } from "./schema";

export class PostgresWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db: Database) {}

  async load(roomId: RoomId): Promise<Uint8Array | undefined> {
    const [row] = await this.db
      .select({ state: workspaces.state })
      .from(workspaces)
      .where(eq(workspaces.roomId, roomId));
    return row?.state;
  }

  async save(roomId: RoomId, state: Uint8Array): Promise<void> {
    const updatedAt = new Date();
    await this.db
      .insert(workspaces)
      .values({ roomId, state, updatedAt })
      .onConflictDoUpdate({ target: workspaces.roomId, set: { state, updatedAt } });
  }
}
