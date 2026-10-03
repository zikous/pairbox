<script lang="ts">
  import { CircleStop } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import { api } from "$lib/api";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { buttonVariants } from "$lib/components/ui/button";
  import { Spinner } from "$lib/components/ui/spinner";
  import { errorMessage } from "$lib/format";

  /** For the owner: ends the session now for everyone, before its slot does. */
  let { roomId }: { roomId: string } = $props();

  let open = $state(false);
  let ending = $state(false);

  async function end(event: MouseEvent) {
    event.preventDefault(); // keep the dialog open until it's done
    ending = true;
    try {
      await api.rooms.end(roomId);
      open = false;
    } catch (error) {
      toast.error("Couldn't end the session", { description: errorMessage(error) });
    } finally {
      ending = false;
    }
  }
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Trigger class={buttonVariants({ variant: "destructive", size: "sm" })}>
    <CircleStop /> End
  </AlertDialog.Trigger>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>End the session now?</AlertDialog.Title>
      <AlertDialog.Description>
        Everyone is disconnected and the rest of the slot is freed. The code and the recording are
        kept, so you can replay it.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={ending}>Keep going</AlertDialog.Cancel>
      <AlertDialog.Action
        class={buttonVariants({ variant: "destructive" })}
        disabled={ending}
        onclick={end}
      >
        {#if ending}<Spinner /> Ending…{:else}End session{/if}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
