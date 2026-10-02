<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Room } from "@pairbox/shared";
  import { copyLink } from "$lib/clipboard";
  import LogoMark from "$lib/components/brand/LogoMark.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { roomUrl } from "$lib/router.svelte";

  /**
   * The room page's fixed layout: header, body and status bar. Every state of the page
   * (loading, not found, name prompt, connecting, workspace) renders inside it, so switching
   * between states only changes the body.
   */
  interface Props {
    /** `undefined` while loading, `null` when the room doesn't exist. */
    room: Room | null | undefined;
    actions?: Snippet;
    footer?: Snippet;
    children: Snippet;
  }

  let { room, actions, footer, children }: Props = $props();
</script>

<div class="flex h-full flex-col">
  <header class="flex h-11 shrink-0 items-center gap-2.5 border-b px-3">
    <a href="/" aria-label="All rooms" class="hover:opacity-80"><LogoMark /></a>
    <span class="text-muted-foreground/60">/</span>
    {#if room}
      <h1 class="truncate text-sm font-medium">{room.name}</h1>
      <Tooltip.Root>
        <Tooltip.Trigger
          class="text-muted-foreground hover:text-foreground hover:border-ring hidden rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors md:block"
          onclick={() => copyLink(roomUrl(room.id))}
        >
          {room.id}
        </Tooltip.Trigger>
        <Tooltip.Content>Copy invite link</Tooltip.Content>
      </Tooltip.Root>
    {:else if room === null}
      <h1 class="text-muted-foreground text-sm">Unknown room</h1>
    {:else}
      <Skeleton class="h-4 w-36" />
    {/if}
    <div class="ml-auto flex items-center gap-2">{@render actions?.()}</div>
  </header>

  <main class="min-h-0 flex-1">{@render children()}</main>

  {#if footer}
    {@render footer()}
  {:else}
    <div class="bg-muted/40 h-6 shrink-0 border-t"></div>
  {/if}
</div>
