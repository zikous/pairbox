<script lang="ts">
  import { fade } from "svelte/transition";
  import Delayed from "$lib/components/shared/Delayed.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Spinner } from "$lib/components/ui/spinner";

  /** Placeholder for the room body: the editor and terminal panes, plus what we're waiting on. */
  let { label }: { label: string } = $props();
</script>

<Delayed>
  <div class="relative flex h-full" aria-busy="true" in:fade={{ duration: 150 }}>
    <div class="flex-[58] space-y-3 border-r p-4 pt-14">
      {#each [60, 82, 45, 70, 30] as width, i (i)}
        <Skeleton class="h-3.5" style="width: {width}%" />
      {/each}
    </div>
    <div class="flex-[42] p-4 pt-14">
      <Skeleton class="h-3.5 w-1/2" />
    </div>
    <div class="absolute inset-0 grid place-items-center">
      <div
        class="bg-popover flex items-center gap-2.5 rounded-md border px-4 py-2.5 font-mono text-xs shadow-lg"
      >
        <Spinner class="text-primary" />
        {label}
      </div>
    </div>
  </div>
</Delayed>
