<script lang="ts">
  import type { RunStatus } from "@pairbox/domain";
  import type { Keymap } from "$lib/prefs.svelte";

  interface Props {
    online: number;
    cursor: { line: number; column: number };
    keymap: Keymap;
    status: RunStatus;
  }

  let { online, cursor, keymap, status }: Props = $props();

  const KEYMAP_LABEL: Record<Keymap, string> = {
    default: "Default keys",
    vim: "Vim",
    emacs: "Emacs",
  };
</script>

<footer
  class="bg-muted/40 text-muted-foreground flex h-6 shrink-0 items-center gap-4 border-t px-3 font-mono text-[11px]"
>
  <span class="flex items-center gap-1.5"
    ><span class="bg-success size-1.5 rounded-full"></span>Connected</span
  >
  <span>{online} online</span>

  <span class="ml-auto hidden sm:inline">Ln {cursor.line}, Col {cursor.column}</span>
  <span class="hidden sm:inline">Tab size: 4</span>
  <span class="hidden sm:inline">{KEYMAP_LABEL[keymap]}</span>
  <span class="max-sm:ml-auto">
    {#if status.state === "running"}
      <span class="text-success">● Running</span>
    {:else if status.state === "exited"}
      <span class={{ "text-destructive": status.exitCode !== 0 }}>
        Exit {status.exitCode} · {status.durationMs} ms
      </span>
    {:else}
      Sandbox ready
    {/if}
  </span>
</footer>
