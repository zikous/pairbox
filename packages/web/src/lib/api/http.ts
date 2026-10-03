import {
  Listeners,
  type ApiError,
  type Recording,
  type RecordingReplay,
  type Room,
  type User,
} from "@pairbox/shared";
import type { AuthApi, RecordingsApi, RoomsApi } from "./types";

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
  list: () => request<Room[]>("GET", "/rooms"),
  get: (id) => orNull(request<Room>("GET", `/rooms/${id}`)),
  create: (input) => request<Room>("POST", "/rooms", input),
  remove: (id) => request<undefined>("DELETE", `/rooms/${id}`),
};

export const httpRecordings: RecordingsApi = {
  list: (roomId) => request<Recording[]>("GET", `/rooms/${roomId}/recordings`),
  get: (id) => request<RecordingReplay>("GET", `/recordings/${id}`),
};
