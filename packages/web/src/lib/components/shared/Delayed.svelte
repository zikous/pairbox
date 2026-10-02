<script lang="ts">
  import { onMount, type Snippet } from "svelte";

  /**
   * Renders its content only after `ms`. Wrap loading placeholders in it so fast loads
   * go straight to the result instead of flashing a skeleton for a few milliseconds.
   */
  let { ms = 200, children }: { ms?: number; children: Snippet } = $props();

  let visible = $state(false);
  onMount(() => {
    const timer = setTimeout(() => (visible = true), ms);
    return () => clearTimeout(timer);
  });
</script>

{#if visible}{@render children()}{/if}
