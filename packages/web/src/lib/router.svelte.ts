export type Route = { name: "home" } | { name: "room"; id: string } | { name: "not-found" };

function parse(pathname: string): Route {
  if (pathname === "/") return { name: "home" };
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

/**
 * The address others should use to reach this app, like VS Code's forwarded address:
 * PUBLIC_URL if configured; otherwise the address we were opened on, unless that is
 * localhost, in which case this machine's network address (works on the same network).
 */
function shareableOrigin(): string {
  if (import.meta.env.PUBLIC_URL) return import.meta.env.PUBLIC_URL.replace(/\/$/, "");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  return local && import.meta.env.LAN_URL ? import.meta.env.LAN_URL : location.origin;
}

export const roomUrl = (id: string) => `${shareableOrigin()}${roomPath(id)}`;
