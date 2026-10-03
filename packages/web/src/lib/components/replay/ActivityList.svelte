<script lang="ts">
  import { clock } from "$lib/format";
  import type { Activity } from "$lib/replay.svelte";

  /** What happened in the session, in order. Click a line to jump there. */
  interface Props {
    activity: Activity[];
    time: number;
    onseek: (time: number) => void;
  }

  let { activity, time, onseek }: Props = $props();
</script>

<ol class="space-y-0.5 p-2">
  {#each activity as item, i (i)}
    <li>
      <button
        class={[
          "hover:bg-muted flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
          item.t > time && "opacity-45",
        ]}
        onclick={() => onseek(item.t)}
      >
        <span class="text-muted-foreground w-10 shrink-0 font-mono">{clock(item.t)}</span>
        <span class="min-w-0">
          {#if item.by}<span class="font-medium" style:color={item.by.color}>{item.by.name}</span
            >{/if}
          <span class={{ "font-mono": item.text.startsWith("typed") }}>{item.text}</span>
        </span>
      </button>
    </li>
  {:else}
    <li class="text-muted-foreground p-2 text-xs">Nothing happened in this session.</li>
  {/each}
</ol>
