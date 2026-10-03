<script lang="ts">
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";

  /** "21–40 of 134", with the way to the pages around. */
  interface Props {
    page: number;
    pageSize: number;
    total: number;
    onpage: (page: number) => void;
  }

  let { page, pageSize, total, onpage }: Props = $props();

  const pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
  const first = $derived(Math.min(total, (page - 1) * pageSize + 1));
  const last = $derived(Math.min(total, page * pageSize));
</script>

<div class="flex items-center justify-between gap-4 text-sm">
  <p class="text-muted-foreground tabular-nums">
    {#if total}{first}–{last} of {total}{:else}No sessions{/if}
  </p>
  {#if pages > 1}
    <div class="flex items-center gap-2">
      <span class="text-muted-foreground tabular-nums">Page {page} of {pages}</span>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Previous page"
        disabled={page <= 1}
        onclick={() => onpage(page - 1)}><ChevronLeft /></Button
      >
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Next page"
        disabled={page >= pages}
        onclick={() => onpage(page + 1)}><ChevronRight /></Button
      >
    </div>
  {/if}
</div>
