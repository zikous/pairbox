<script lang="ts">
  import { History } from "@lucide/svelte";
  import { RUNTIMES, type Room, type RoomSummary } from "@pairbox/shared";
  import CopyButton from "$lib/components/shared/CopyButton.svelte";
  import RuntimeDot from "$lib/components/shared/RuntimeDot.svelte";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import * as Table from "$lib/components/ui/table";
  import { dayLabel, hours, length, span } from "$lib/format";
  import { clock } from "$lib/now.svelte";
  import type { ListTab } from "$lib/sessions.svelte";
  import { replayPath, roomUrl } from "$lib/router.svelte";
  import ParticipantChips from "./ParticipantChips.svelte";
  import SessionMenu from "./SessionMenu.svelte";

  /** A page of sessions. Without `rooms` yet, placeholder rows hold the space. */
  interface Props {
    tab: ListTab;
    rooms: RoomSummary[] | undefined;
    /** A newer page is on its way: dim the one shown. */
    stale?: boolean;
    ondelete: (room: Room) => void;
  }

  let { tab, rooms, stale = false, ondelete }: Props = $props();

  const duration = (room: Room) => Date.parse(room.endsAt) - Date.parse(room.startsAt);
</script>

<div class="bg-card overflow-hidden rounded-lg border">
  <Table.Root>
    <Table.Header class="bg-muted/40">
      <Table.Row class="hover:bg-transparent">
        <Table.Head class="pl-4">Session</Table.Head>
        <Table.Head class="w-48">When</Table.Head>
        <Table.Head class="hidden w-24 lg:table-cell">Length</Table.Head>
        <Table.Head class="hidden w-36 md:table-cell">Runtime</Table.Head>
        <Table.Head class="hidden w-56 sm:table-cell">
          {tab === "past" ? "Participants" : "Starts"}
        </Table.Head>
        <Table.Head class="w-40 pr-4"><span class="sr-only">Actions</span></Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body class={["transition-opacity", stale && "opacity-60"]}>
      {#if !rooms}
        {#each { length: 6 }, row (row)}
          <Table.Row class="hover:bg-transparent">
            <Table.Cell class="pl-4"><Skeleton class="h-4 w-48" /></Table.Cell>
            <Table.Cell><Skeleton class="h-4 w-32" /></Table.Cell>
            <Table.Cell class="hidden lg:table-cell"><Skeleton class="h-4 w-10" /></Table.Cell>
            <Table.Cell class="hidden md:table-cell"><Skeleton class="h-4 w-20" /></Table.Cell>
            <Table.Cell class="hidden sm:table-cell"><Skeleton class="h-4 w-24" /></Table.Cell>
            <Table.Cell class="pr-4"><Skeleton class="ml-auto h-7 w-24" /></Table.Cell>
          </Table.Row>
        {/each}
      {:else}
        {#each rooms as room (room.id)}
          <Table.Row class="h-14">
            <Table.Cell class="max-w-0 pl-4">
              <p class="truncate font-medium">{room.name}</p>
            </Table.Cell>
            <Table.Cell>
              <p>{dayLabel(room.startsAt)}</p>
              <p class="text-muted-foreground font-mono text-xs">
                {hours(room.startsAt, room.endsAt)}
              </p>
            </Table.Cell>
            <Table.Cell class="text-muted-foreground hidden font-mono text-xs lg:table-cell">
              {length(duration(room))}
            </Table.Cell>
            <Table.Cell class="hidden md:table-cell">
              <span class="flex items-center gap-1.5">
                <RuntimeDot runtime={room.runtime} />{RUNTIMES[room.runtime].label}
              </span>
            </Table.Cell>
            <Table.Cell class="hidden sm:table-cell">
              {#if tab === "past"}
                {#if room.participants.length}
                  <ParticipantChips participants={room.participants} />
                {:else}
                  <span class="text-muted-foreground text-xs">Nobody came</span>
                {/if}
              {:else}
                <span class="text-muted-foreground font-mono text-xs">
                  in {span(Date.parse(room.startsAt) - clock.now)}
                </span>
              {/if}
            </Table.Cell>
            <Table.Cell class="pr-4">
              <div class="flex items-center justify-end gap-1">
                {#if tab === "past"}
                  {#if room.participants.length}
                    <Button href={replayPath(room.id)} size="sm" variant="outline">
                      <History /> Replay
                    </Button>
                  {/if}
                {:else}
                  <CopyButton
                    text={roomUrl(room.id)}
                    class={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Copy invite
                  </CopyButton>
                {/if}
                <SessionMenu {room} past={tab === "past"} {ondelete} />
              </div>
            </Table.Cell>
          </Table.Row>
        {/each}
      {/if}
    </Table.Body>
  </Table.Root>
</div>
