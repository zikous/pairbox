<script lang="ts">
  import { ModeWatcher } from "mode-watcher";
  import { Toaster } from "$lib/components/ui/sonner";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { router } from "$lib/router.svelte";
  import Auth from "./pages/Auth.svelte";
  import Home from "./pages/Home.svelte";
  import NotFound from "./pages/NotFound.svelte";
  import Room from "./pages/Room.svelte";
</script>

<ModeWatcher />
<Toaster position="bottom-right" />

<Tooltip.Provider delayDuration={300}>
  {#if router.route.name === "home"}
    <Home />
  {:else if router.route.name === "sign-in" || router.route.name === "sign-up"}
    <Auth mode={router.route.name} />
  {:else if router.route.name === "room"}
    {#key router.route.id}<Room id={router.route.id} />{/key}
  {:else}
    <NotFound />
  {/if}
</Tooltip.Provider>
