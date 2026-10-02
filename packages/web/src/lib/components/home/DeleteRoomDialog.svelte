<script lang="ts">
  import { toast } from "svelte-sonner";
  import type { Room } from "@pairbox/domain";
  import { api } from "$lib/api";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { buttonVariants } from "$lib/components/ui/button";
  import { Spinner } from "$lib/components/ui/spinner";

  interface Props {
    open: boolean;
    room: Room | undefined;
    ondeleted: (room: Room) => void;
  }

  let { open = $bindable(), room, ondeleted }: Props = $props();
  let deleting = $state(false);

  async function confirm(event: MouseEvent) {
    event.preventDefault(); // keep the dialog open until the delete finishes
    if (!room) return;
    const deleted = room;
    deleting = true;
    await api.rooms.remove(deleted.id);
    deleting = false;
    open = false;
    ondeleted(deleted);
    toast.success(`Deleted “${deleted.name}”`);
  }
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete “{room?.name}”?</AlertDialog.Title>
      <AlertDialog.Description>
        The room and its code are deleted for everyone. This can't be undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={deleting}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        class={buttonVariants({ variant: "destructive" })}
        disabled={deleting}
        onclick={confirm}
      >
        {#if deleting}<Spinner /> Deleting…{:else}Delete room{/if}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
