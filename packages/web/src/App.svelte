<script lang="ts">
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "$lib/components/ui/sonner";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import RoomSkeleton from "$lib/components/room/RoomSkeleton.svelte";
  import { router } from "$lib/router.svelte";
  import Home from "./pages/Home.svelte";
  import NotFound from "./pages/NotFound.svelte";

  // The room page carries the editor and terminal, so load it only when needed.
  const loadRoom = () => import("./pages/Room.svelte");
</script>

<ModeWatcher />
<Toaster position="bottom-right" />

<Tooltip.Provider delayDuration={300}>
  {#if router.route.name === "home"}
    <Home />
  {:else if router.route.name === "room"}
    {#await loadRoom()}
      <RoomSkeleton label="Loading room…" />
    {:then { default: Room }}
      {#key router.route.id}<Room id={router.route.id} />{/key}
    {/await}
  {:else}
    <NotFound />
  {/if}
</Tooltip.Provider>
