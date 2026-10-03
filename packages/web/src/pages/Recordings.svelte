<script lang="ts">
  import { History } from "@lucide/svelte";
  import type { Room } from "@pairbox/shared";
  import DeleteRoomDialog from "$lib/components/home/DeleteRoomDialog.svelte";
  import SessionsBrowser from "$lib/components/home/SessionsBrowser.svelte";
  import PageTitle from "$lib/components/shared/PageTitle.svelte";
  import * as Empty from "$lib/components/ui/empty";
  import { sessionCounts } from "$lib/counts.svelte";
  import { SessionList } from "$lib/sessions.svelte";

  /** Finished sessions, to replay keystroke by keystroke. */
  const past = new SessionList("past");
  let deleteOpen = $state(false);
  let roomToDelete = $state<Room>();

  function deleted() {
    past.reload();
    void sessionCounts.refresh();
  }
</script>

<main class="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
  <PageTitle
    title="Recordings"
    description="Every finished session: the code, the terminal and who did what, to replay."
  />

  <section class="mt-8">
    <SessionsBrowser list={past} ondelete={(room) => ([roomToDelete, deleteOpen] = [room, true])}>
      {#snippet empty()}
        <Empty.Media variant="icon"><History /></Empty.Media>
        <Empty.Title>No recordings yet</Empty.Title>
        <Empty.Description>Sessions show up here once they're over.</Empty.Description>
      {/snippet}
    </SessionsBrowser>
  </section>
</main>

<DeleteRoomDialog bind:open={deleteOpen} room={roomToDelete} ondeleted={deleted} />
