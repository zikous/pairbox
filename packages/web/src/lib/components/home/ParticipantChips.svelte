<script lang="ts">
  import type { Participant } from "@pairbox/shared";

  /** Who took part in a session, as small colored chips. */
  let { participants, max = 3 }: { participants: Participant[]; max?: number } = $props();
</script>

<span class="flex flex-wrap items-center gap-1">
  {#each participants.slice(0, max) as person (person.name)}
    <span class="bg-muted inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]">
      <span class="size-1.5 rounded-full" style:background={person.color}></span>{person.name}
    </span>
  {:else}
    <span class="text-muted-foreground text-[11px]">Nobody joined</span>
  {/each}
  {#if participants.length > max}
    <span class="text-muted-foreground text-[11px]">+{participants.length - max}</span>
  {/if}
</span>
