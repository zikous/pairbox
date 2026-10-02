<script lang="ts" module>
  export interface Person {
    id: number;
    name: string;
    color: string;
    me: boolean;
  }
</script>

<script lang="ts">
  import * as Avatar from "$lib/components/ui/avatar";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { initials } from "$lib/format";

  let { people }: { people: Person[] } = $props();
  const MAX = 4;
</script>

<div class="flex -space-x-1.5">
  {#each people.slice(0, MAX) as person (person.id)}
    <Tooltip.Root>
      <Tooltip.Trigger>
        <Avatar.Root size="sm" class="ring-background ring-2">
          <Avatar.Fallback
            class="text-[10px] font-medium text-white"
            style="background: {person.color}"
          >
            {initials(person.name)}
          </Avatar.Fallback>
        </Avatar.Root>
      </Tooltip.Trigger>
      <Tooltip.Content>{person.name}{person.me ? " (you)" : ""}</Tooltip.Content>
    </Tooltip.Root>
  {/each}
  {#if people.length > MAX}
    <Tooltip.Root>
      <Tooltip.Trigger>
        <Avatar.Root size="sm" class="ring-background ring-2">
          <Avatar.Fallback class="text-[10px]">+{people.length - MAX}</Avatar.Fallback>
        </Avatar.Root>
      </Tooltip.Trigger>
      <Tooltip.Content
        >{people
          .slice(MAX)
          .map((p) => p.name)
          .join(", ")}</Tooltip.Content
      >
    </Tooltip.Root>
  {/if}
</div>
