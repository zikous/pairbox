<script lang="ts">
  import { fade } from "svelte/transition";
  import { RotateCcw } from "@lucide/svelte";
  import type { SandboxState } from "@pairbox/shared";
  import { Button } from "$lib/components/ui/button";
  import { Spinner } from "$lib/components/ui/spinner";

  /** Covers the terminal while the room has no machine: starting, waiting in line, or lost. */
  interface Props {
    sandbox: SandboxState;
    onreset: () => void;
  }

  let { sandbox, onreset }: Props = $props();
</script>

{#if sandbox.state !== "ready"}
  <div
    class="bg-background/85 absolute inset-0 z-10 grid place-items-center p-4 backdrop-blur-[1px]"
    transition:fade={{ duration: 150 }}
  >
    <div class="flex max-w-xs flex-col items-center gap-3 text-center">
      {#if sandbox.state === "lost"}
        <p class="text-sm font-medium">The sandbox stopped</p>
        <p class="text-muted-foreground text-xs">Its machine went away. Start a fresh one.</p>
        <Button size="sm" variant="outline" onclick={onreset}><RotateCcw /> Reset</Button>
      {:else}
        <Spinner class="text-primary size-5" />
        {#if sandbox.state === "waiting"}
          <p class="text-sm font-medium">Waiting for a free sandbox</p>
          <p class="text-muted-foreground font-mono text-xs">
            {sandbox.position === 1 ? "You're next" : `#${sandbox.position} in line`}
          </p>
        {:else}
          <p class="text-sm font-medium">Starting a sandbox…</p>
        {/if}
      {/if}
    </div>
  </div>
{/if}
