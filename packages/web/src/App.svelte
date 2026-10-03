<script lang="ts">
  import { ModeWatcher } from "mode-watcher";
  import { auth } from "$lib/auth.svelte";
  import Landing from "$lib/components/home/Landing.svelte";
  import AppShell from "$lib/components/layout/AppShell.svelte";
  import { Toaster } from "$lib/components/ui/sonner";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { router } from "$lib/router.svelte";
  import Auth from "./pages/Auth.svelte";
  import Join from "./pages/Join.svelte";
  import NotFound from "./pages/NotFound.svelte";
  import Recordings from "./pages/Recordings.svelte";
  import Replay from "./pages/Replay.svelte";
  import Room from "./pages/Room.svelte";
  import Sessions from "./pages/Sessions.svelte";

  const route = $derived(router.route);
</script>

<ModeWatcher />
<Toaster position="bottom-right" />

<Tooltip.Provider delayDuration={300}>
  {#if route.name === "room"}
    <!-- A room takes the whole screen, for guests and owners alike. -->
    {#key route.id}<Room id={route.id} />{/key}
  {:else if route.name === "sign-in" || route.name === "sign-up"}
    <Auth mode={route.name} />
  {:else if route.name === "not-found"}
    <NotFound />
  {:else if auth.user}
    <AppShell>
      {#if route.name === "home"}
        <Sessions />
      {:else if route.name === "recordings"}
        <Recordings />
      {:else if route.name === "join"}
        <Join />
      {:else}
        {#key route.roomId}<Replay roomId={route.roomId} />{/key}
      {/if}
    </AppShell>
  {:else if auth.user === null}
    <!-- Signed out: joining someone's session is all there is, besides signing in. -->
    <Landing />
  {/if}
</Tooltip.Provider>
