<script lang="ts">
  import { LogIn } from "@lucide/svelte";
  import type { RoomSummary } from "@pairbox/shared";
  import CopyButton from "$lib/components/shared/CopyButton.svelte";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import { hours, span } from "$lib/format";
  import { clock } from "$lib/now.svelte";
  import { roomPath, roomUrl } from "$lib/router.svelte";

  /** Sessions you can be in right now, front and center. */
  let { rooms }: { rooms: RoomSummary[] } = $props();
</script>

<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
  {#each rooms as room (room.id)}
    {@const started = Date.parse(room.startsAt) <= clock.now}
    <div class="bg-card border-primary/40 flex flex-col gap-3 rounded-lg border p-4 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-success flex items-center gap-1.5 text-xs font-medium">
            <span class="size-1.5 animate-pulse rounded-full bg-current"></span>
            {started
              ? `Live · ${span(Date.parse(room.endsAt) - clock.now)} left`
              : `Opens to guests in ${span(Date.parse(room.startsAt) - clock.now)}`}
          </p>
          <p class="mt-1 truncate font-medium">{room.name}</p>
          <p class="text-muted-foreground mt-0.5 font-mono text-xs">
            {hours(room.startsAt, room.endsAt)}
          </p>
        </div>
      </div>
      <div class="flex gap-2">
        <Button href={roomPath(room.id)} size="sm" class="flex-1"><LogIn /> Enter</Button>
        <CopyButton
          text={roomUrl(room.id)}
          class={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Copy invite
        </CopyButton>
      </div>
    </div>
  {/each}
</div>
