<script lang="ts">
  import { ChevronRight, Lock } from "@lucide/svelte";
  import { mode } from "mode-watcher";
  import { RUNTIMES, type Recording } from "@pairbox/shared";
  import { api, HttpError } from "$lib/api";
  import ActivityList from "$lib/components/replay/ActivityList.svelte";
  import Timeline from "$lib/components/replay/Timeline.svelte";
  import Editor from "$lib/components/room/Editor.svelte";
  import PaneHeader from "$lib/components/room/PaneHeader.svelte";
  import RoomLoading from "$lib/components/room/RoomLoading.svelte";
  import Terminal from "$lib/components/room/Terminal.svelte";
  import StateMessage from "$lib/components/shared/StateMessage.svelte";
  import RuntimeDot from "$lib/components/shared/RuntimeDot.svelte";
  import { dateTime, errorMessage } from "$lib/format";
  import { prefs } from "$lib/prefs.svelte";
  import { Replay } from "$lib/replay.svelte";

  /** Plays back a recorded session: the code, cursors and terminal, as they were. */
  let { roomId }: { roomId: string } = $props();

  let replay = $state.raw<Replay>();
  let recording = $state<Recording>();
  let roomName = $state("");
  let error = $state<string>();
  let playing = $state(false);
  let speed = $state(1);
  const dark = $derived(mode.current === "dark");

  void (async () => {
    try {
      const [data, room] = await Promise.all([api.recordings.get(roomId), api.rooms.get(roomId)]);
      recording = data.recording;
      roomName = room?.name ?? "";
      replay = new Replay(data, room?.runtime ?? "python");
    } catch (failure) {
      error =
        failure instanceof HttpError && failure.status === 403
          ? "Only the session's owner can replay it."
          : failure instanceof HttpError && failure.status === 404
            ? "This session wasn't recorded: nobody opened it."
            : errorMessage(failure);
    }
  })();

  // While playing, move time forward at the chosen speed.
  $effect(() => {
    if (!playing || !replay) return;
    const player = replay;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      player.seek(player.time + (now - last) * speed);
      last = now;
      if (player.time >= player.duration) playing = false;
      else frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  });

  function toggle() {
    if (!replay) return;
    if (!playing && replay.time >= replay.duration) replay.seek(0);
    playing = !playing;
  }
</script>

<svelte:head><title>{roomName || "Recording"} · pairbox</title></svelte:head>

{#if error}
  <StateMessage icon={Lock} title="Can't replay this session" message={error} />
{:else if !replay || !recording}
  <RoomLoading label="Loading the recording…" />
{:else}
  <div class="flex h-full flex-col">
    <header class="flex h-11 shrink-0 items-center gap-2 border-b px-4 text-sm">
      <a href="/recordings" class="text-muted-foreground hover:text-foreground">Recordings</a>
      <ChevronRight class="text-muted-foreground/60 size-3.5" />
      <h1 class="truncate font-medium">{roomName}</h1>
      <span class="text-muted-foreground ml-auto hidden text-xs md:inline">
        {dateTime(recording.startedAt)}
      </span>
    </header>

    <main class="grid min-h-0 flex-1 grid-cols-[16rem_3fr_2fr] max-md:grid-cols-1">
      <aside class="min-h-0 overflow-y-auto border-r max-md:hidden">
        <p class="label-mono px-4 pt-3">Activity</p>
        <ActivityList
          activity={replay.activity}
          time={replay.time}
          onseek={(t) => replay?.seek(t)}
        />
      </aside>

      <section class="flex min-h-0 flex-col border-r">
        <PaneHeader>
          {#snippet tab()}
            <RuntimeDot runtime={replay?.runtime ?? "python"} />{RUNTIMES[
              replay?.runtime ?? "python"
            ].file}
          {/snippet}
        </PaneHeader>
        <div class="min-h-0 flex-1">
          {#key replay.doc}
            <Editor
              doc={replay.doc}
              awareness={replay.awareness}
              runtime={replay.runtime}
              keymap={prefs.keymap}
              {dark}
              readonly
            />
          {/key}
        </div>
      </section>

      <section class="flex min-h-0 flex-col">
        <PaneHeader>
          {#snippet tab()}<span class="text-primary">❯</span>terminal{/snippet}
        </PaneHeader>
        <div class="min-h-0 flex-1">
          <Terminal
            session={{ onOutput: (listener) => replay?.onOutput(listener) ?? (() => {}) }}
            {dark}
          />
        </div>
      </section>
    </main>

    <Timeline
      time={replay.time}
      duration={replay.duration}
      runs={replay.runs}
      {playing}
      {speed}
      onseek={(t) => replay?.seek(t)}
      ontoggle={toggle}
      onspeed={(s) => (speed = s)}
    />
  </div>
{/if}
