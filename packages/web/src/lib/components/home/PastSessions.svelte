<script lang="ts">
  import { History, Search } from "@lucide/svelte";
  import { RUNTIMES, type Room, type RoomSummary } from "@pairbox/shared";
  import RuntimeDot from "$lib/components/shared/RuntimeDot.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty";
  import { Input } from "$lib/components/ui/input";
  import * as ToggleGroup from "$lib/components/ui/toggle-group";
  import { byDay, hours, timecode } from "$lib/format";
  import { clock } from "$lib/now.svelte";
  import { replayPath } from "$lib/router.svelte";
  import ParticipantChips from "./ParticipantChips.svelte";
  import SessionMenu from "./SessionMenu.svelte";

  /** Your interview history: finished sessions by day, to filter and replay. */
  let { rooms, ondelete }: { rooms: RoomSummary[]; ondelete: (room: Room) => void } = $props();

  const RANGES = [
    { id: "7", label: "7 days", days: 7 },
    { id: "30", label: "30 days", days: 30 },
    { id: "90", label: "3 months", days: 90 },
    { id: "all", label: "All", days: Infinity },
  ];

  let search = $state("");
  let range = $state("30");

  const shown = $derived.by(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? Infinity;
    const since = clock.now - days * 86_400_000;
    const query = search.trim().toLowerCase();
    return rooms
      .filter((room) => Date.parse(room.startsAt) >= since)
      .filter(
        (room) =>
          !query ||
          room.name.toLowerCase().includes(query) ||
          room.participants.some((p) => p.name.toLowerCase().includes(query)),
      )
      .toSorted((a, b) => b.startsAt.localeCompare(a.startsAt));
  });
</script>

<div class="mb-4 flex flex-wrap items-center gap-2">
  <div class="relative min-w-48 flex-1">
    <Search class="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
    <Input bind:value={search} placeholder="Search by session or participant" class="pl-8" />
  </div>
  <ToggleGroup.Root
    type="single"
    variant="outline"
    value={range}
    onValueChange={(v) => v && (range = v)}
  >
    {#each RANGES as option (option.id)}
      <ToggleGroup.Item value={option.id} class="px-3 text-xs">{option.label}</ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
</div>

{#if shown.length === 0}
  <Empty.Root class="bg-card border border-dashed">
    <Empty.Header>
      <Empty.Media variant="icon"><History /></Empty.Media>
      <Empty.Title>{rooms.length ? "No sessions match" : "No past sessions yet"}</Empty.Title>
      <Empty.Description>
        {rooms.length
          ? "Try another search or a longer period."
          : "Finished sessions show up here, ready to replay."}
      </Empty.Description>
    </Empty.Header>
  </Empty.Root>
{:else}
  <div class="space-y-6">
    {#each byDay(shown) as group (group.day)}
      <section>
        <h3 class="label-mono mb-2">{group.day}</h3>
        <ul class="bg-card divide-y rounded-lg border">
          {#each group.items as room (room.id)}
            <li class="flex items-center gap-4 px-4 py-3">
              <div class="w-24 shrink-0">
                <p class="font-mono text-xs">{hours(room.startsAt, room.endsAt)}</p>
                <p class="text-muted-foreground font-mono text-[11px]">
                  {timecode(Date.parse(room.endsAt) - Date.parse(room.startsAt))}
                </p>
              </div>
              <div class="min-w-0 flex-1 space-y-1">
                <p class="flex items-center gap-2 text-sm font-medium">
                  <span class="truncate">{room.name}</span>
                  <span
                    class="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs font-normal"
                  >
                    <RuntimeDot runtime={room.runtime} />{RUNTIMES[room.runtime].label}
                  </span>
                </p>
                <ParticipantChips participants={room.participants} />
              </div>
              <Button
                href={replayPath(room.id)}
                size="sm"
                variant="outline"
                disabled={!room.participants.length}
                class={room.participants.length ? undefined : "opacity-50"}
              >
                <History /> Replay
              </Button>
              <SessionMenu {room} past {ondelete} />
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}
