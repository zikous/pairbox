import {
  Listeners,
  type ApiError,
  type Availability,
  type JoinStatus,
  type RecordingReplay,
  type Room,
  type RoomCounts,
  type RoomPage,
  type RoomView,
  type SessionNotes,
  type User,
} from "@pairbox/shared";
import type { AuthApi, LobbyApi, NotesApi, RecordingsApi, RoomsApi } from "./types";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Fires when the server says the session is gone (expired, or signed out elsewhere). */
export const sessionEnded = new Listeners();

/** Calls the HTTP API (see /docs on the server). The session cookie is sent automatically. */
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : null,
  });
  if (!response.ok) {
    if (response.status === 401) sessionEnded.emit();
    const { error } = (await response.json().catch(() => ({}))) as Partial<ApiError>;
    throw new HttpError(response.status, error ?? response.statusText);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** Turns "not found" (and malformed ids, which can't exist either) into null. */
async function orNull<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof HttpError && [400, 401, 404].includes(error.status)) return null;
    throw error;
  }
}

export const httpAuth: AuthApi = {
  me: () => orNull(request<User>("GET", "/auth/me")),
  signUp: (credentials) => request<User>("POST", "/auth/signup", credentials),
  signIn: (credentials) => request<User>("POST", "/auth/login", credentials),
  signOut: () => request<undefined>("POST", "/auth/logout"),
};

export const httpRooms: RoomsApi = {
  list: (query) => {
    const params = Object.entries(query).flatMap(([key, value]) =>
      value === undefined || value === "" ? [] : [[key, String(value)]],
    );
    return request<RoomPage>("GET", `/rooms?${new URLSearchParams(params)}`);
  },
  counts: () => request<RoomCounts>("GET", "/rooms/counts"),
  get: (id) => orNull(request<RoomView>("GET", `/rooms/${id}`)),
  create: (input) => request<Room>("POST", "/rooms", input),
  remove: (id) => request<undefined>("DELETE", `/rooms/${id}`),
  end: (id) => request<undefined>("POST", `/rooms/${id}/end`),
  availability: (from, durationMinutes) => {
    const query = new URLSearchParams({
      from: from.toISOString(),
      durationMinutes: String(durationMinutes),
    });
    return request<Availability>("GET", `/rooms/availability?${query}`);
  },
};

export const httpLobby: LobbyApi = {
  ask: async (roomId, participant) =>
    (await request<{ id: string }>("POST", `/rooms/${roomId}/join-requests`, { participant })).id,
  status: (roomId, requestId) =>
    request<JoinStatus>("GET", `/rooms/${roomId}/join-requests/${requestId}`),
  decide: (roomId, requestId, admit) =>
    request<undefined>(
      "POST",
      `/rooms/${roomId}/join-requests/${requestId}/${admit ? "admit" : "deny"}`,
    ),
};

export const httpRecordings: RecordingsApi = {
  get: (roomId) => request<RecordingReplay>("GET", `/rooms/${roomId}/recording`),
};

export const httpNotes: NotesApi = {
  get: (roomId) => request<SessionNotes>("GET", `/rooms/${roomId}/notes`),
  save: (roomId, body) => request<SessionNotes>("PUT", `/rooms/${roomId}/notes`, { body }),
};
