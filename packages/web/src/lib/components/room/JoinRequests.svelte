<script lang="ts">
  import { Check, UserPlus, X } from "@lucide/svelte";
  import { toast } from "svelte-sonner";
  import type { JoinRequest } from "@pairbox/shared";
  import { api } from "$lib/api";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import * as Popover from "$lib/components/ui/popover";
  import { errorMessage } from "$lib/format";

  /** For the room's owner: who is waiting to come in, with Admit and Deny. */
  let { roomId, requests }: { roomId: string; requests: JoinRequest[] } = $props();

  let open = $state(false);

  async function decide(request: JoinRequest, admit: boolean) {
    try {
      await api.lobby.decide(roomId, request.id, admit);
    } catch (error) {
      toast.error("Couldn't answer the request", { description: errorMessage(error) });
    }
  }
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    class={buttonVariants({ variant: requests.length ? "default" : "ghost", size: "sm" })}
  >
    <UserPlus />
    {requests.length ? `${requests.length} waiting` : "Lobby"}
  </Popover.Trigger>
  <Popover.Content align="end" class="w-72 p-2">
    <p class="label-mono px-2 py-1.5">Waiting to join</p>
    {#each requests as request (request.id)}
      <div class="flex items-center gap-2 rounded-md px-2 py-1.5">
        <span class="size-2 shrink-0 rounded-full" style:background={request.participant.color}
        ></span>
        <span class="min-w-0 flex-1 truncate text-sm">{request.participant.name}</span>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Deny"
          onclick={() => decide(request, false)}
        >
          <X />
        </Button>
        <Button size="icon-xs" aria-label="Admit" onclick={() => decide(request, true)}>
          <Check />
        </Button>
      </div>
    {:else}
      <p class="text-muted-foreground px-2 py-3 text-sm">
        Nobody is waiting. Share the invite link.
      </p>
    {/each}
  </Popover.Content>
</Popover.Root>
