import { createFakeApi } from "./fake";
import type { Api } from "./types";

export type * from "./types";

/** Swap this for the real server adapter once it exists. */
export const api: Api = createFakeApi();
