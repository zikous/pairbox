import type { Credentials, User } from "@pairbox/shared";
import { api, sessionEnded } from "$lib/api";

/** `undefined` while we don't know yet, `null` when signed out. */
let user = $state<User | null>();

void api.auth.me().then((me) => (user = me));
sessionEnded.add(() => (user = null));

/** Who is signed in, and the actions that change it. */
export const auth = {
  get user() {
    return user;
  },
  async signIn(credentials: Credentials) {
    user = await api.auth.signIn(credentials);
  },
  async signUp(credentials: Credentials) {
    user = await api.auth.signUp(credentials);
  },
  async signOut() {
    await api.auth.signOut();
    user = null;
  },
};
