<script lang="ts">
  import { untrack } from "svelte";
  import { fade } from "svelte/transition";
  import { SearchX, WifiOff } from "@lucide/svelte";
  import type { Room } from "@pairbox/shared";
  import { api, type RoomSession } from "$lib/api";
  import JoinPrompt from "$lib/components/room/JoinPrompt.svelte";
  import RoomFrame from "$lib/components/room/RoomFrame.svelte";
  import RoomLoading from "$lib/components/room/RoomLoading.svelte";
  import StateMessage from "$lib/components/shared/StateMessage.svelte";
  import { Button } from "$lib/components/ui/button";
  import { errorMessage } from "$lib/format";
  import { prefs } from "$lib/prefs.svelte";

  /**
   * A room goes through these steps, all inside the same frame:
   * load the room → ask for a name (first visit only) → connect → show the workspace.
   */
  let { id }: { id: string } = $props();

  // The editor and terminal are heavy, so fetch them in parallel with the room itself.
  const workspace = import("$lib/components/room/Workspace.svelte");

  let room = $state<Room | null>();
  let session = $state.raw<RoomSession>();
  let error = $state<string>();
  const hasName = $derived(!!prefs.name);

  // The page is recreated for each room id, so loading once is enough. "Try again" reloads.
  function load() {
    room = undefined;
    error = undefined;
    api.rooms.get(id).then(
      (found) => (room = found),
      (failure) => (error = errorMessage(failure)),
    );
  }
  load();

  // Connect once the room is loaded and we have a name. Leave when the page goes away.
  $effect(() => {
    if (!room || !hasName) return;
    const target = room;
    let cancelled = false;
    let joined: RoomSession | undefined;

    untrack(() => api.join(target, { name: prefs.name, color: prefs.color })).then(
      (s) => {
        if (cancelled) return s.leave();
        joined = session = s;
      },
      (failure) => (error = errorMessage(failure)),
    );

    return () => {
      cancelled = true;
      joined?.leave();
      session = undefined;
    };
  });
</script>

{#if room && session}
  {#await workspace}
    <RoomFrame {room}><RoomLoading label="Loading editor…" /></RoomFrame>
  {:then { default: Workspace }}
    <Workspace {room} {session} />
  {/await}
{:else}
  <RoomFrame {room}>
    {#if error}
      <div class="h-full" in:fade={{ duration: 150 }}>
        <StateMessage icon={WifiOff} title="Couldn't reach the room" message={error}>
          {#snippet actions()}
            <Button variant="outline" size="sm" onclick={load}>Try again</Button>
          {/snippet}
        </StateMessage>
      </div>
    {:else if room === null}
      <div class="h-full" in:fade={{ duration: 150 }}>
        <StateMessage
          icon={SearchX}
          title="Room not found"
          message="The link may be wrong, or the host deleted this room."
        >
          {#snippet actions()}
            <Button href="/" variant="outline" size="sm">Back to rooms</Button>
          {/snippet}
        </StateMessage>
      </div>
    {:else if room && !hasName}
      <JoinPrompt {room} />
    {:else}
      <RoomLoading label={room ? `Connecting to ${room.name}…` : "Loading room…"} />
    {/if}
  </RoomFrame>
{/if}
