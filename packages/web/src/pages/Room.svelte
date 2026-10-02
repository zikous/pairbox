<script lang="ts">
  import { untrack } from "svelte";
  import type { Room } from "@pairbox/domain";
  import { api, type RoomSession } from "$lib/api";
  import JoinPrompt from "$lib/components/room/JoinPrompt.svelte";
  import RoomSkeleton from "$lib/components/room/RoomSkeleton.svelte";
  import Workspace from "$lib/components/room/Workspace.svelte";
  import { prefs } from "$lib/prefs.svelte";
  import NotFound from "./NotFound.svelte";

  /**
   * A room goes through these steps:
   * load the room → ask for a name (first visit only) → connect → show the workspace.
   */
  let { id }: { id: string } = $props();

  let room = $state<Room | null>();
  let session = $state.raw<RoomSession>();
  const hasName = $derived(!!prefs.name);

  $effect(() => {
    room = undefined;
    api.rooms.get(id).then((found) => (room = found));
  });

  // Connect once the room is loaded and we have a name. Leave when the page goes away.
  $effect(() => {
    if (!room || !hasName) return;
    const target = room;
    let cancelled = false;
    let joined: RoomSession | undefined;

    untrack(() => api.join(target, { name: prefs.name, color: prefs.color })).then((s) => {
      if (cancelled) return s.leave();
      joined = session = s;
    });

    return () => {
      cancelled = true;
      joined?.leave();
      session = undefined;
    };
  });
</script>

{#if room === null}
  <NotFound
    title="Room not found"
    message="The link may be wrong, or the host deleted this room."
  />
{:else if room === undefined}
  <RoomSkeleton label="Loading room…" />
{:else if !hasName}
  <JoinPrompt {room} />
{:else if !session}
  <RoomSkeleton label="Connecting to {room.name}…" />
{:else}
  <Workspace {room} {session} />
{/if}
