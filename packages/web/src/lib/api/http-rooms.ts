import type { ApiError, CreateRoom, Room, RoomId } from "@pairbox/shared";
import type { RoomsApi } from "./types";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface Options {
  /** The host secret currently in use, if any. */
  hostSecret: () => string;
  /** Called when the server rejects the stored host secret. */
  onUnauthorized: () => void;
}

/** Room management over the HTTP API (see /docs on the server). */
export function createHttpRooms({ hostSecret, onUnauthorized }: Options): RoomsApi {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`/api/rooms${path}`, {
      method,
      headers: {
        authorization: `Bearer ${hostSecret()}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : null,
    });
    if (response.status === 401) onUnauthorized();
    if (!response.ok) {
      const { error } = (await response.json().catch(() => ({}))) as Partial<ApiError>;
      throw new HttpError(response.status, error ?? response.statusText);
    }
    return (response.status === 204 ? undefined : await response.json()) as T;
  }

  return {
    async unlock(secret) {
      const response = await fetch("/api/rooms", {
        headers: { authorization: `Bearer ${secret}` },
      });
      return response.ok;
    },

    list: () => request<Room[]>("GET", "/"),

    async get(id: RoomId) {
      try {
        return await request<Room>("GET", `/${id}`);
      } catch (error) {
        // 400 means the id isn't even well-formed, so the room can't exist either.
        if (error instanceof HttpError && [400, 404].includes(error.status)) return null;
        throw error;
      }
    },

    create: (input: CreateRoom) => request<Room>("POST", "/", input),

    remove: (id) => request<undefined>("DELETE", `/${id}`),
  };
}
