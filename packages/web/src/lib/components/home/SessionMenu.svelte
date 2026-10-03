<script lang="ts">
  import { Ellipsis, Trash2 } from "@lucide/svelte";
  import type { Room } from "@pairbox/shared";
  import { buttonVariants } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";

  /** The ⋯ menu of a session, for what's not on the row itself: cancelling or deleting it. */
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
    aria-label="More for {room.name}"
  >
    <Ellipsis />
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" class="w-44">
    <DropdownMenu.Item variant="destructive" onSelect={() => ondelete(room)}>
      <Trash2 />
      {past ? "Delete recording" : "Cancel session"}
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
