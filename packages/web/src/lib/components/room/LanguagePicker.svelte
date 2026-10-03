<script lang="ts">
  import { ChevronDown } from "@lucide/svelte";
  import { RUNTIMES, isRuntime, type Runtime } from "@pairbox/shared";
  import RuntimeDot from "$lib/components/shared/RuntimeDot.svelte";
  import { buttonVariants } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";

  /** The room's language. Switching it switches it for everyone in the room. */
  let { value, onchange }: { value: Runtime; onchange: (runtime: Runtime) => void } = $props();
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger
    class={buttonVariants({ variant: "ghost", size: "sm", class: "font-mono text-xs" })}
    aria-label="Language"
  >
    <RuntimeDot runtime={value} />{RUNTIMES[value].label}<ChevronDown class="opacity-60" />
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" class="w-44">
    <DropdownMenu.Label class="text-muted-foreground text-xs font-normal">
      Switches it for everyone
    </DropdownMenu.Label>
    <DropdownMenu.RadioGroup {value} onValueChange={(next) => isRuntime(next) && onchange(next)}>
      {#each Object.entries(RUNTIMES) as [id, { label }] (id)}
        <DropdownMenu.RadioItem value={id}>
          {#if isRuntime(id)}<RuntimeDot runtime={id} />{/if}{label}
        </DropdownMenu.RadioItem>
      {/each}
    </DropdownMenu.RadioGroup>
  </DropdownMenu.Content>
</DropdownMenu.Root>
