<script lang="ts">
  import { onMount } from "svelte";
  import { CalendarPlus } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { roomPhase, type Room, type RoomSummary } from "@pairbox/shared";
  import { api } from "$lib/api";
  import { copyLink } from "$lib/clipboard";
  import DeleteRoomDialog from "$lib/components/home/DeleteRoomDialog.svelte";
  import LiveSessions from "$lib/components/home/LiveSessions.svelte";
  import ScheduleDialog from "$lib/components/home/ScheduleDialog.svelte";
  import SessionsBrowser from "$lib/components/home/SessionsBrowser.svelte";
  import PageTitle from "$lib/components/shared/PageTitle.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty";
  import { sessionCounts } from "$lib/counts.svelte";
  import { slot } from "$lib/format";
  import { roomPath, roomUrl, router } from "$lib/router.svelte";
  import { SessionList } from "$lib/sessions.svelte";

  /** What's on now and what's coming. Finished sessions move to Past. */
  const REFRESH_MS = 60_000;

  const upcoming = new SessionList("upcoming");
  let live = $state<RoomSummary[]>([]);
  let scheduleOpen = $state(false);
  let deleteOpen = $state(false);
  let roomToDelete = $state<Room>();

  /** Sessions move from upcoming to live to past with time, so look again every minute. */
  function refresh() {
    api.rooms.list({ tab: "live", page: 1, pageSize: 12 }).then(
      (page) => (live = page.items),
      () => {}, // the table below reports load errors
    );
    upcoming.reload();
    void sessionCounts.refresh();
  }

  onMount(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  });

  function booked(room: Room) {
    if (roomPhase(room, { owner: true }) === "open") return router.navigate(roomPath(room.id));
    refresh();
    toast.success("Session booked", {
      description: slot(room.startsAt, room.endsAt),
      action: { label: "Copy invite", onClick: () => copyLink(roomUrl(room.id)) },
    });
  }
</script>

<main class="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
  <PageTitle
    title="Upcoming"
    description="Book a slot, send the invite, and let your candidate in when it starts."
  >
    {#snippet action()}
      <Button onclick={() => (scheduleOpen = true)}><CalendarPlus /> New session</Button>
    {/snippet}
  </PageTitle>

  {#if live.length}
    <section class="mt-8">
      <h2 class="label-mono text-success mb-3 flex items-center gap-2">
        <span class="size-1.5 animate-pulse rounded-full bg-current"></span>Happening now
      </h2>
      <LiveSessions rooms={live} />
    </section>
  {/if}

  <section class="mt-8">
    {#if live.length}<h2 class="label-mono mb-3">Later</h2>{/if}
    <SessionsBrowser
      list={upcoming}
      ondelete={(room) => ([roomToDelete, deleteOpen] = [room, true])}
    >
      {#snippet empty()}
        <Empty.Media variant="icon"><CalendarPlus /></Empty.Media>
        <Empty.Title>Nothing scheduled</Empty.Title>
        <Empty.Description>
          Book one with New session, then send the invite to your candidate.
        </Empty.Description>
      {/snippet}
    </SessionsBrowser>
  </section>
</main>

<ScheduleDialog bind:open={scheduleOpen} onbooked={booked} />
<DeleteRoomDialog bind:open={deleteOpen} room={roomToDelete} ondeleted={refresh} />
