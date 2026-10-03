<script lang="ts">
  import { CalendarPlus } from "@lucide/svelte";
  import { RUNTIMES, type Room, type RoomSummary } from "@pairbox/shared";
  import RuntimeDot from "$lib/components/shared/RuntimeDot.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty";
  import { byDay, hours, span } from "$lib/format";
  import { clock } from "$lib/now.svelte";
  import SessionMenu from "./SessionMenu.svelte";

  /** Booked sessions that haven't started, by day. */
  interface Props {
    rooms: RoomSummary[];
    onschedule: () => void;
    ondelete: (room: Room) => void;
  }

  let { rooms, onschedule, ondelete }: Props = $props();
</script>

{#if rooms.length === 0}
  <Empty.Root class="bg-card border border-dashed">
    <Empty.Header>
      <Empty.Media variant="icon"><CalendarPlus /></Empty.Media>
      <Empty.Title>Nothing scheduled</Empty.Title>
      <Empty.Description>Book a slot, then send the invite to your candidate.</Empty.Description>
    </Empty.Header>
    <Empty.Content
      ><Button size="sm" onclick={onschedule}><CalendarPlus /> Schedule a session</Button
      ></Empty.Content
    >
  </Empty.Root>
{:else}
  <div class="space-y-6">
    {#each byDay(rooms) as group (group.day)}
      <section>
        <h3 class="label-mono mb-2">{group.day}</h3>
        <ul class="bg-card divide-y rounded-lg border">
          {#each group.items as room (room.id)}
            <li class="flex items-center gap-4 px-4 py-3">
              <span class="w-24 shrink-0 font-mono text-xs"
                >{hours(room.startsAt, room.endsAt)}</span
              >
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{room.name}</p>
                <p class="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                  <RuntimeDot runtime={room.runtime} />{RUNTIMES[room.runtime].label}
                </p>
              </div>
              <span class="text-muted-foreground hidden font-mono text-xs sm:block">
                in {span(Date.parse(room.startsAt) - clock.now)}
              </span>
              <SessionMenu {room} past={false} {ondelete} />
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}
