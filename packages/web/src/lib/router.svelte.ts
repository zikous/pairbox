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
export const roomUrl = (id: string) => `${location.origin}${roomPath(id)}`;
