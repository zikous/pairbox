<script lang="ts">
  import { toast } from "svelte-sonner";
  import { roomPhase, type Room } from "@pairbox/shared";
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
  // A finished session is deleted with what it left behind; one still to come is cancelled.
  const over = $derived(!!room && roomPhase(room) === "ended");

  async function confirm(event: MouseEvent) {
    event.preventDefault(); // keep the dialog open until the delete finishes
    if (!room) return;
    const deleted = room;
    deleting = true;
    try {
      await api.rooms.remove(deleted.id);
      open = false;
      ondeleted(deleted);
      toast.success(`${over ? "Deleted" : "Cancelled"} “${deleted.name}”`);
    } catch (error) {
      toast.error(`Couldn't ${over ? "delete" : "cancel"} the session`, {
        description: errorMessage(error),
      });
    } finally {
      deleting = false;
    }
  }
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{over ? "Delete" : "Cancel"} “{room?.name}”?</AlertDialog.Title>
      <AlertDialog.Description>
        {#if over}
          The session is deleted with its code, its recording and your notes. This can't be undone.
        {:else}
          Its time slot is freed and the invite link stops working. This can't be undone.
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={deleting}>Keep it</AlertDialog.Cancel>
      <AlertDialog.Action
        class={buttonVariants({ variant: "destructive" })}
        disabled={deleting}
        onclick={confirm}
      >
        {#if deleting}<Spinner />{over ? "Deleting…" : "Cancelling…"}{:else}
          {over ? "Delete session" : "Cancel session"}
        {/if}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
