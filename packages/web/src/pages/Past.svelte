<script lang="ts">
  import { onMount } from "svelte";
  import { History } from "@lucide/svelte";
  import type { Room } from "@pairbox/shared";
  import DeleteRoomDialog from "$lib/components/home/DeleteRoomDialog.svelte";
  import SessionsBrowser from "$lib/components/home/SessionsBrowser.svelte";
  import NotesDialog from "$lib/components/notes/NotesDialog.svelte";
  import PageTitle from "$lib/components/shared/PageTitle.svelte";
  import * as Empty from "$lib/components/ui/empty";
  import { sessionCounts } from "$lib/counts.svelte";
  import { SessionList } from "$lib/sessions.svelte";

  /** Finished sessions, each with its replay and your notes. */
  const past = new SessionList("past");
  let deleteOpen = $state(false);
  let notesOpen = $state(false);
  let selected = $state<Room>();

  onMount(() => void sessionCounts.refresh());

  function deleted() {
    past.reload();
    void sessionCounts.refresh();
  }
</script>

<main class="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
  <PageTitle
    title="Past"
    description="Finished sessions: replay them keystroke by keystroke, and keep your notes."
  />

  <section class="mt-8">
    <SessionsBrowser
      list={past}
      ondelete={(room) => ([selected, deleteOpen] = [room, true])}
      onnotes={(room) => ([selected, notesOpen] = [room, true])}
    >
      {#snippet empty()}
        <Empty.Media variant="icon"><History /></Empty.Media>
        <Empty.Title>No past sessions yet</Empty.Title>
        <Empty.Description>Sessions land here once they're over.</Empty.Description>
      {/snippet}
    </SessionsBrowser>
  </section>
</main>

<DeleteRoomDialog bind:open={deleteOpen} room={selected} ondeleted={deleted} />
<NotesDialog bind:open={notesOpen} room={selected} />
