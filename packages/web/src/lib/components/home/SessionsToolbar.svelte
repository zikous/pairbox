<script lang="ts">
  import { LoaderCircle, Search, X } from "@lucide/svelte";
  import { RUNTIMES, isRuntime } from "@pairbox/shared";
  import RuntimeDot from "$lib/components/shared/RuntimeDot.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import { PERIODS, type SessionList } from "$lib/sessions.svelte";

  /** Search and filters above the sessions table. */
  let { list }: { list: SessionList } = $props();

  const periods = $derived(PERIODS[list.tab]);
  const period = $derived(periods.find((p) => p.id === list.period));
</script>

<div class="flex flex-wrap items-center gap-2">
  <div class="relative w-full sm:w-72">
    <Search class="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
    <Input
      bind:value={list.search}
      placeholder="Search sessions or people"
      aria-label="Search sessions or people"
      class="h-8 pr-8 pl-8"
    />
    {#if list.loading && list.search}
      <LoaderCircle
        class="text-muted-foreground absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin"
      />
    {/if}
  </div>

  <Select.Root type="single" value={list.period} onValueChange={(v) => list.setPeriod(v)}>
    <Select.Trigger class="w-40" aria-label="Period">{period?.label}</Select.Trigger>
    <Select.Content>
      {#each periods as option (option.id)}
        <Select.Item value={option.id}>{option.label}</Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>

  <Select.Root
    type="single"
    value={list.runtime}
    onValueChange={(v) => list.setRuntime(isRuntime(v) ? v : "all")}
  >
    <Select.Trigger class="w-40" aria-label="Runtime">
      <span class="flex items-center gap-1.5">
        {#if list.runtime === "all"}All runtimes{:else}
          <RuntimeDot runtime={list.runtime} />{RUNTIMES[list.runtime].label}
        {/if}
      </span>
    </Select.Trigger>
    <Select.Content>
      <Select.Item value="all">All runtimes</Select.Item>
      {#each Object.entries(RUNTIMES) as [id, { label }] (id)}
        <Select.Item value={id}>
          {#if isRuntime(id)}<RuntimeDot runtime={id} />{/if}{label}
        </Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>

  {#if list.filtered}
    <Button variant="ghost" size="sm" onclick={() => list.clearFilters()}>
      Reset <X />
    </Button>
  {/if}
</div>
