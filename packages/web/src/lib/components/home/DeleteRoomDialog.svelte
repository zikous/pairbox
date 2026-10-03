<script lang="ts">
  import { toast } from "svelte-sonner";
  import type { Room } from "@pairbox/shared";
  import { api } from "$lib/api";
  import { errorMessage } from "$lib/format";
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
    try {
      await api.rooms.remove(deleted.id);
      open = false;
      ondeleted(deleted);
      toast.success(`Deleted “${deleted.name}”`);
    } catch (error) {
      toast.error("Couldn't delete the room", { description: errorMessage(error) });
    } finally {
      deleting = false;
    }
  }
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete “{room?.name}”?</AlertDialog.Title>
      <AlertDialog.Description>
        The session, its code and its recordings are deleted. Its time slot is freed. This can't be
        undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={deleting}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action
        class={buttonVariants({ variant: "destructive" })}
        disabled={deleting}
        onclick={confirm}
      >
        {#if deleting}<Spinner /> Deleting…{:else}Delete session{/if}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
