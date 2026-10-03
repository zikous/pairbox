<script lang="ts">
  import type { Snippet } from "svelte";

  /** A page's heading, with its one main action on the right. */
  interface Props {
    title: string;
    description: string;
    action?: Snippet;
  }

  let { title, description, action }: Props = $props();
</script>

<svelte:head><title>{title} · pairbox</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-4">
  <div>
    <h1 class="text-2xl font-semibold tracking-tight">{title}</h1>
    <p class="text-muted-foreground mt-1 text-sm">{description}</p>
  </div>
  {@render action?.()}
</div>
