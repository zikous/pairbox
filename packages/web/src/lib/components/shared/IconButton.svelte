<script lang="ts">
  import type { Snippet } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Tooltip from "$lib/components/ui/tooltip";

  interface Props {
    /** Used for both the tooltip and the accessible name. */
    label: string;
    href?: string;
    onclick?: () => void;
    children: Snippet;
  }

  let { label, href, onclick, children }: Props = $props();
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <Button {...props} {href} {onclick} variant="ghost" size="icon-sm" aria-label={label}>
        {@render children()}
      </Button>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Content>{label}</Tooltip.Content>
</Tooltip.Root>
