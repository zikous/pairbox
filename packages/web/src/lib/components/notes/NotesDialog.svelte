<script lang="ts">
  import type { Room } from "@pairbox/shared";
  import * as Dialog from "$lib/components/ui/dialog";
  import { slot } from "$lib/format";
  import NotesEditor from "./NotesEditor.svelte";

  /** Your notes on a finished session, on their own: the replay is the row's other action. */
  let { room, open = $bindable(false) }: { room: Room | undefined; open?: boolean } = $props();
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="flex h-[min(36rem,85vh)] flex-col gap-0 p-0 sm:max-w-lg">
    {#if room}
      <Dialog.Header class="border-b p-4 pr-12">
        <Dialog.Title class="truncate">{room.name}</Dialog.Title>
        <Dialog.Description>{slot(room.startsAt, room.endsAt)}</Dialog.Description>
      </Dialog.Header>
      <div class="min-h-0 flex-1">
        {#if open}<NotesEditor roomId={room.id} title={room.name} />{/if}
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
