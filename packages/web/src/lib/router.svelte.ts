import type { ShareInfo } from "@pairbox/shared";

export type Route =
  | { name: "home" }
  | { name: "past" }
  | { name: "join" }
  | { name: "sign-in" }
  | { name: "sign-up" }
  | { name: "room"; id: string }
  | { name: "replay"; roomId: string }
  | { name: "not-found" };

function parse(pathname: string): Route {
  if (pathname === "/") return { name: "home" };
  if (pathname === "/signin") return { name: "sign-in" };
  if (pathname === "/signup") return { name: "sign-up" };
  if (pathname === "/past") return { name: "past" };
  if (pathname === "/join") return { name: "join" };
  const replay = /^\/r\/([a-z0-9]+)\/replay\/?$/.exec(pathname);
  if (replay?.[1]) return { name: "replay", roomId: replay[1] };
  const room = /^\/r\/([a-z0-9]+)\/?$/.exec(pathname);
  return room?.[1] ? { name: "room", id: room[1] } : { name: "not-found" };
}

let route = $state<Route>(parse(location.pathname));

window.addEventListener("popstate", () => {
  route = parse(location.pathname);
});

// Turn same-origin link clicks into client-side navigation.
document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = (event.target as Element).closest("a");
  if (!link || link.target || link.origin !== location.origin) return;
  event.preventDefault();
  router.navigate(link.pathname);
});

export const router = {
  get route() {
    return route;
  },
  navigate(pathname: string) {
    if (pathname === location.pathname) return;
    history.pushState(null, "", pathname);
    route = parse(pathname);
  },
};

export const roomPath = (id: string) => `/r/${id}`;
export const replayPath = (id: string) => `/r/${id}/replay`;

/** The public address from the api (PUBLIC_URL or the tunnel's), once known. */
let publicOrigin = $state<string | null>(null);

async function loadPublicOrigin(attempt = 0): Promise<void> {
  try {
    const response = await fetch("/api/share");
    const info = (await response.json()) as ShareInfo;
    publicOrigin = info.baseUrl;
    // A tunnel takes a few seconds to get its address: ask again for up to a minute.
    if (info.pending && attempt < 12) setTimeout(() => void loadPublicOrigin(attempt + 1), 5_000);
  } catch {
    // No api reachable: invite links fall back to the address we were opened on.
  }
}
void loadPublicOrigin();

/**
 * The address others should use to reach this app, like VS Code's forwarded address: the
 * public address if there is one; otherwise the address we were opened on, unless that is
 * localhost, in which case this machine's network address (works on the same network).
 */
function shareableOrigin(): string {
  if (publicOrigin) return publicOrigin;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  return local && import.meta.env.LAN_URL ? import.meta.env.LAN_URL : location.origin;
}

export const roomUrl = (id: string) => `${shareableOrigin()}${roomPath(id)}`;
