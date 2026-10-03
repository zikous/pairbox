<script lang="ts">
  import { Ellipsis, Link, Trash2 } from "@lucide/svelte";
  import type { Room } from "@pairbox/shared";
  import { copyLink } from "$lib/clipboard";
  import { buttonVariants } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { roomUrl } from "$lib/router.svelte";

  /** The ⋯ menu of a session: copy its invite (unless it's over), cancel or delete it. */
  interface Props {
    room: Room;
    past: boolean;
    ondelete: (room: Room) => void;
  }

  let { room, past, ondelete }: Props = $props();
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger
    class={buttonVariants({ variant: "ghost", size: "icon-sm" })}
    aria-label="Actions for {room.name}"
  >
    <Ellipsis />
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" class="w-44">
    {#if !past}
      <DropdownMenu.Item onSelect={() => copyLink(roomUrl(room.id))}
        ><Link /> Copy invite link</DropdownMenu.Item
      >
      <DropdownMenu.Separator />
    {/if}
    <DropdownMenu.Item variant="destructive" onSelect={() => ondelete(room)}>
      <Trash2 />
      {past ? "Delete" : "Cancel session"}
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
