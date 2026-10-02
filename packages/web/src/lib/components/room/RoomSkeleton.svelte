<script lang="ts">
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Spinner } from "$lib/components/ui/spinner";
  import LogoMark from "$lib/components/brand/LogoMark.svelte";

  let { label }: { label: string } = $props();
</script>

<div class="flex h-full flex-col" aria-busy="true">
  <header class="flex h-11 shrink-0 items-center gap-3 border-b px-3">
    <LogoMark />
    <Skeleton class="h-4 w-40" />
    <div class="ml-auto flex gap-2">
      <Skeleton class="size-6 rounded-full" />
      <Skeleton class="h-7 w-20" />
    </div>
  </header>
  <div class="relative flex min-h-0 flex-1">
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
  <div class="h-6 shrink-0 border-t"></div>
</div>
