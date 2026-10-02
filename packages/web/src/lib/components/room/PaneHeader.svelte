<script lang="ts">
  import type { Snippet } from "svelte";

  /** The bar above a pane: an editor-style tab on the left, actions on the right. */
  let { tab, actions }: { tab: Snippet; actions?: Snippet } = $props();
</script>

<div class="bg-muted/40 flex h-9 shrink-0 items-center border-b pr-1.5">
  <div
    class="bg-background before:bg-primary relative flex h-full items-center gap-2 border-r px-3 font-mono text-xs before:absolute before:inset-x-0 before:top-0 before:h-0.5"
  >
    {@render tab()}
  </div>
  <div class="ml-auto flex items-center gap-1">{@render actions?.()}</div>
</div>
