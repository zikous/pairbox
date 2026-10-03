<script lang="ts">
  import { ArrowLeft, CircleDot, Lock } from "@lucide/svelte";
  import type { Recording, Room } from "@pairbox/shared";
  import { api, HttpError } from "$lib/api";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import StateMessage from "$lib/components/shared/StateMessage.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { clock, dateTime, errorMessage } from "$lib/format";

  /** A room's recorded sessions. Only its owner gets here. */
  let { roomId }: { roomId: string } = $props();

  let room = $state<Room | null>();
  let recordings = $state<Recording[]>();
  let error = $state<string>();

  void (async () => {
    try {
      [room, recordings] = await Promise.all([api.rooms.get(roomId), api.recordings.list(roomId)]);
    } catch (failure) {
      error =
        failure instanceof HttpError && failure.status === 403
          ? "Only the room's owner can see its recordings."
          : errorMessage(failure);
    }
  })();

  const duration = (r: Recording) =>
    r.endedAt ? clock(Date.parse(r.endedAt) - Date.parse(r.startedAt)) : null;
</script>

<svelte:head><title>Recordings · pairbox</title></svelte:head>

<div class="min-h-full">
  <PageHeader />
  <main class="mx-auto max-w-3xl px-4 pt-10 pb-20">
    <Button href="/" variant="ghost" size="sm" class="-ml-2 mb-4"><ArrowLeft /> Your rooms</Button>

    {#if error}
      <StateMessage icon={Lock} title="Can't show recordings" message={error} />
    {:else}
      <h1 class="text-2xl font-semibold tracking-tight">{room?.name ?? "Recordings"}</h1>
      <p class="text-muted-foreground mt-1 mb-6 text-sm">
        Every session in this room, from the first person joining to the last one leaving.
      </p>

      {#if !recordings}
        <div class="bg-card divide-y rounded-lg border">
          {#each [0, 1] as i (i)}<div class="p-4"><Skeleton class="h-4 w-56" /></div>{/each}
        </div>
      {:else if recordings.length === 0}
        <StateMessage
          icon={CircleDot}
          title="No sessions yet"
          message="Sessions are recorded as soon as someone opens the room."
        />
      {:else}
        <ul class="bg-card divide-y rounded-lg border">
          {#each recordings as recording (recording.id)}
            <li>
              <a
                href="/recordings/{recording.id}"
                class="hover:bg-muted/40 flex items-center gap-4 px-4 py-3 transition-colors"
              >
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium">{dateTime(recording.startedAt)}</p>
                  <p class="text-muted-foreground truncate text-xs">
                    {recording.participants.map((p) => p.name).join(", ") ||
                      "Nobody introduced themselves"}
                  </p>
                </div>
                <span class="text-muted-foreground font-mono text-xs">
                  {#if duration(recording)}{duration(recording)}{:else}<span
                      class="text-destructive">● live</span
                    >{/if}
                </span>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </main>
</div>
