<script lang="ts">
  import { CalendarPlus } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { roomPhase, type Room, type RoomSummary } from "@pairbox/shared";
  import { api } from "$lib/api";
  import { auth } from "$lib/auth.svelte";
  import { copyLink } from "$lib/clipboard";
  import DeleteRoomDialog from "$lib/components/home/DeleteRoomDialog.svelte";
  import JoinForm from "$lib/components/home/JoinForm.svelte";
  import ScheduleDialog from "$lib/components/home/ScheduleDialog.svelte";
  import LiveSessions from "$lib/components/home/LiveSessions.svelte";
  import PastSessions from "$lib/components/home/PastSessions.svelte";
  import UpcomingSessions from "$lib/components/home/UpcomingSessions.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import * as Tabs from "$lib/components/ui/tabs";
  import Delayed from "$lib/components/shared/Delayed.svelte";
  import { clock } from "$lib/now.svelte";
  import { errorMessage, slot } from "$lib/format";
  import { roomPath, roomUrl, router } from "$lib/router.svelte";

  let rooms = $state<RoomSummary[]>();
  let tab = $state<"upcoming" | "past">();
  let scheduleOpen = $state(false);
  let deleteOpen = $state(false);
  let roomToDelete = $state<Room>();

  // Load your sessions once we know you're signed in.
  $effect(() => {
    rooms = undefined;
    if (!auth.user) return;
    api.rooms.list().then(
      (list) => (rooms = list),
      (error) => toast.error("Couldn't load your sessions", { description: errorMessage(error) }),
    );
  });

  // Sessions you can enter now (the owner can open them a few minutes early), coming, and done.
  const sessions = $derived.by(() => {
    const phase = (room: Room) => roomPhase(room, { owner: true, now: clock.now });
    const all = rooms ?? [];
    return {
      live: all.filter((room) => phase(room) === "open"),
      upcoming: all.filter((room) => phase(room) === "upcoming"),
      past: all.filter((room) => phase(room) === "ended"),
    };
  });
  // Open on what matters: upcoming sessions if there are any, else the history.
  $effect(() => {
    if (rooms && !tab) tab = sessions.upcoming.length ? "upcoming" : "past";
  });

  function booked(room: Room) {
    const summary = { ...room, participants: [] };
    rooms = [...(rooms ?? []), summary].toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
    if (roomPhase(room, { owner: true }) === "open") return router.navigate(roomPath(room.id));
    toast.success("Session booked", {
      description: slot(room.startsAt, room.endsAt),
      action: { label: "Copy invite", onClick: () => copyLink(roomUrl(room.id)) },
    });
  }

  function askDelete(room: Room) {
    roomToDelete = room;
    deleteOpen = true;
  }
</script>

<svelte:head><title>pairbox</title></svelte:head>

<div class="relative min-h-full">
  <div
    class="dot-grid pointer-events-none absolute inset-x-0 top-0 h-80 [mask-image:linear-gradient(to_bottom,black,transparent)]"
  ></div>
  <PageHeader />

  <main class="relative mx-auto max-w-3xl px-4 pt-14 pb-20">
    {#if auth.user}
      <section>
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 class="text-2xl font-semibold tracking-tight">Your sessions</h1>
            <p class="text-muted-foreground mt-1 text-sm">
              Book a slot, send the link, let your candidate in, and replay it afterwards.
            </p>
          </div>
          <Button onclick={() => (scheduleOpen = true)}><CalendarPlus /> Schedule a session</Button>
        </div>
        {#if !rooms}
          <Delayed>
            <div class="mt-8 space-y-3">
              <Skeleton class="h-24 w-full" />
              <Skeleton class="h-16 w-full" />
            </div>
          </Delayed>
        {:else}
          {#if sessions.live.length}
            <div class="mt-8"><LiveSessions rooms={sessions.live} /></div>
          {/if}
          <Tabs.Root bind:value={tab} class="mt-8">
            <Tabs.List>
              <Tabs.Trigger value="upcoming">Upcoming · {sessions.upcoming.length}</Tabs.Trigger>
              <Tabs.Trigger value="past">Past · {sessions.past.length}</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="upcoming" class="mt-4">
              <UpcomingSessions
                rooms={sessions.upcoming}
                onschedule={() => (scheduleOpen = true)}
                ondelete={askDelete}
              />
            </Tabs.Content>
            <Tabs.Content value="past" class="mt-4">
              <PastSessions rooms={sessions.past} ondelete={askDelete} />
            </Tabs.Content>
          </Tabs.Root>
        {/if}
      </section>

      <section class="mt-16">
        <h2 class="label-mono mb-3">Join someone else's session</h2>
        <JoinForm />
      </section>
    {:else if auth.user === null}
      <section>
        <h1 class="text-3xl font-semibold tracking-tight text-balance">
          Pair on code, <span class="text-primary">in one box.</span>
        </h1>
        <p class="text-muted-foreground mt-2 mb-6 max-w-lg">
          A shared editor and a live terminal. Paste an invite to jump in.
        </p>
        <JoinForm />
      </section>

      <section
        class="bg-card mt-16 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-5"
      >
        <div>
          <p class="font-medium">Run your own interviews</p>
          <p class="text-muted-foreground text-sm">
            Schedule sessions, let candidates in, and replay every keystroke afterwards.
          </p>
        </div>
        <div class="flex gap-2">
          <Button href="/signin" variant="outline" size="sm">Sign in</Button>
          <Button href="/signup" size="sm">Create account</Button>
        </div>
      </section>
    {/if}
  </main>
</div>

<ScheduleDialog bind:open={scheduleOpen} onbooked={booked} />
<DeleteRoomDialog
  bind:open={deleteOpen}
  room={roomToDelete}
  ondeleted={(deleted) => (rooms = rooms?.filter((room) => room.id !== deleted.id))}
/>
