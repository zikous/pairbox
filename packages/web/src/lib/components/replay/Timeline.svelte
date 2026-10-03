<script lang="ts">
  import { Pause, Play } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { timecode } from "$lib/format";

  /** Play/pause, the time scrubber (with a mark for each run), and playback speed. */
  interface Props {
    time: number;
    duration: number;
    runs: number[];
    playing: boolean;
    speed: number;
    onseek: (time: number) => void;
    ontoggle: () => void;
    onspeed: (speed: number) => void;
  }

  let { time, duration, runs, playing, speed, onseek, ontoggle, onspeed }: Props = $props();
  const SPEEDS = [1, 2, 4, 8];
  const percent = (t: number) => `${(t / Math.max(duration, 1)) * 100}%`;
</script>

<footer class="bg-muted/40 flex h-12 shrink-0 items-center gap-3 border-t px-3">
  <Button size="icon-sm" onclick={ontoggle} aria-label={playing ? "Pause" : "Play"}>
    {#if playing}<Pause class="fill-current" />{:else}<Play class="fill-current" />{/if}
  </Button>
  <span class="text-muted-foreground w-24 shrink-0 font-mono text-xs">
    {timecode(time)} / {timecode(duration)}
  </span>

  <div class="relative flex flex-1 items-center">
    <input
      type="range"
      min="0"
      max={duration}
      value={time}
      oninput={(e) => onseek(Number(e.currentTarget.value))}
      class="accent-primary w-full cursor-pointer"
      aria-label="Position in the session"
    />
    {#each runs as run, i (i)}
      <span
        class="bg-primary pointer-events-none absolute top-0 h-1.5 w-0.5 -translate-x-1/2 rounded"
        style:left={percent(run)}
        title="Run"
      ></span>
    {/each}
  </div>

  <div class="flex gap-0.5">
    {#each SPEEDS as option (option)}
      <Button
        size="xs"
        variant={speed === option ? "secondary" : "ghost"}
        class="font-mono"
        onclick={() => onspeed(option)}
      >
        {option}×
      </Button>
    {/each}
  </div>
</footer>
