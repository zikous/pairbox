<script lang="ts">
  import { untrack } from "svelte";
  import { CalendarCheck, Clock, SearchX, UserX, WifiOff } from "@lucide/svelte";
  import { roomPhase, type RoomView } from "@pairbox/shared";
  import { api, type RoomSession } from "$lib/api";
  import JoinPrompt from "$lib/components/room/JoinPrompt.svelte";
  import RoomFrame from "$lib/components/room/RoomFrame.svelte";
  import RoomLoading from "$lib/components/room/RoomLoading.svelte";
  import StateMessage from "$lib/components/shared/StateMessage.svelte";
  import { Button } from "$lib/components/ui/button";
  import { errorMessage, slot, span } from "$lib/format";
  import { clock } from "$lib/now.svelte";
  import { prefs } from "$lib/prefs.svelte";
  import { replayPath } from "$lib/router.svelte";

  /**
   * A booked session, from the link. Before its slot: a countdown. During it: the owner goes
   * straight in; guests ask to join and wait to be let in. After it: it's over.
   */
  let { id }: { id: string } = $props();

  // The editor and terminal are heavy, so fetch them in parallel with the room itself.
  const workspace = import("$lib/components/room/Workspace.svelte");

  let room = $state<RoomView | null>();
  let error = $state<string>();
  let session = $state.raw<RoomSession>();
  let ended = $state<"time" | "deleted">();
  // Guests: their request to join, and the ticket they get once let in.
  let requestId = $state<string>();
  let ticket = $state<string>();
  let denied = $state(false);
  let ready = $state(false); // the owner confirmed their name

  const phase = $derived(room && roomPhase(room, { owner: room.owner, now: clock.now }));
  const canConnect = $derived(phase === "open" && !ended && (room?.owner ? ready : !!ticket));

  function load() {
    room = undefined;
    error = undefined;
    api.rooms.get(id).then(
      (found) => (room = found),
      (failure) => (error = errorMessage(failure)),
    );
  }
  load();

  async function askToJoin() {
    if (!room) return;
    try {
      requestId = await api.lobby.ask(room.id, { name: prefs.name, color: prefs.color });
    } catch (failure) {
      error = errorMessage(failure);
    }
  }

  // Waiting guests check every moment whether the owner has decided.
  $effect(() => {
    if (!room || !requestId || ticket || denied) return;
    const { id: roomId } = room;
    const pending = requestId;
    const timer = setInterval(async () => {
      const status = await api.lobby.status(roomId, pending).catch(() => undefined);
      if (status?.status === "admitted") ticket = status.ticket;
      if (status?.status === "denied") denied = true;
    }, 1_500);
    return () => clearInterval(timer);
  });

  // Connect once allowed in. Leave when the page goes away or the session ends.
  $effect(() => {
    if (!canConnect || !room) return;
    const target = room;
    let cancelled = false;
    let joined: RoomSession | undefined;

    untrack(() => api.join(target, { name: prefs.name, color: prefs.color }, ticket)).then(
      (s) => {
        if (cancelled) return s.leave();
        joined = session = s;
        s.onEnded((why) => (ended = why));
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

{#if error}
  <RoomFrame {room}>
    <StateMessage icon={WifiOff} title="Couldn't reach the room" message={error}>
      {#snippet actions()}
        <Button variant="outline" size="sm" onclick={load}>Try again</Button>
      {/snippet}
    </StateMessage>
  </RoomFrame>
{:else if room === null}
  <RoomFrame {room}>
    <StateMessage
      icon={SearchX}
      title="Room not found"
      message="The link may be wrong, or the room was deleted."
    >
      {#snippet actions()}<Button href="/" variant="outline" size="sm">Home</Button>{/snippet}
    </StateMessage>
  </RoomFrame>
{:else if room === undefined}
  <RoomFrame {room}><RoomLoading label="Loading room…" /></RoomFrame>
{:else if ended || phase === "ended"}
  <RoomFrame {room}>
    <StateMessage
      icon={CalendarCheck}
      title={ended === "deleted" ? "This room was deleted" : "This session has ended"}
      message={slot(room.startsAt, room.endsAt)}
    >
      {#snippet actions()}
        {#if room?.owner}
          <Button href={replayPath(room.id)} size="sm">Watch the recording</Button>
        {/if}
        <Button href="/" variant="outline" size="sm">Home</Button>
      {/snippet}
    </StateMessage>
  </RoomFrame>
{:else if phase === "upcoming"}
  <RoomFrame {room}>
    <StateMessage
      icon={Clock}
      title="Starts in {span(Date.parse(room.startsAt) - clock.now)}"
      message={room.owner
        ? `${slot(room.startsAt, room.endsAt)}. You can open it 10 minutes before it starts.`
        : slot(room.startsAt, room.endsAt)}
    />
  </RoomFrame>
{:else if session}
  {#await workspace}
    <RoomFrame {room}><RoomLoading label="Loading editor…" /></RoomFrame>
  {:then { default: Workspace }}
    <Workspace {room} {session} />
  {:catch}
    <RoomFrame {room}>
      <StateMessage icon={WifiOff} title="Couldn't load the editor" message="Reload to try again.">
        {#snippet actions()}
          <Button variant="outline" size="sm" onclick={() => location.reload()}>Reload</Button>
        {/snippet}
      </StateMessage>
    </RoomFrame>
  {/await}
{:else}
  <RoomFrame {room}>
    {#if room.owner && !ready}
      <JoinPrompt
        {room}
        action="Open room"
        hint="Shown to guests next to your cursor."
        onsubmit={() => (ready = true)}
      />
    {:else if room.owner || ticket}
      <RoomLoading label="Connecting…" />
    {:else if denied}
      <StateMessage
        icon={UserX}
        title="The host didn't let you in"
        message="Ask them for a new invite if this is a mistake."
      />
    {:else if requestId}
      <RoomLoading label="Waiting for the host to let you in…" />
    {:else}
      <JoinPrompt
        {room}
        action="Ask to join"
        hint="The host sees this name when you ask to join."
        onsubmit={askToJoin}
      />
    {/if}
  </RoomFrame>
{/if}
