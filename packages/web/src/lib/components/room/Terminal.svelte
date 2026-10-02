<script lang="ts">
  import { onMount } from "svelte";
  import { Terminal, type ITheme } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import "@xterm/xterm/css/xterm.css";
  import type { TerminalSession } from "$lib/api";

  let { session, dark }: { session: TerminalSession; dark: boolean } = $props();

  const LIGHT: ITheme = {
    background: "#ffffff",
    foreground: "#0a0a0a",
    cursor: "#0a0a0a",
    cursorAccent: "#ffffff",
    selectionBackground: "#0a0a0a22",
    black: "#0a0a0a",
    red: "#dc2626",
    green: "#16a34a",
    yellow: "#ca8a04",
    blue: "#2563eb",
    magenta: "#9333ea",
    cyan: "#0891b2",
    white: "#737373",
  };
  const DARK: ITheme = {
    background: "#0a0a0a",
    foreground: "#fafafa",
    cursor: "#fafafa",
    cursorAccent: "#0a0a0a",
    selectionBackground: "#fafafa33",
    black: "#262626",
    red: "#f87171",
    green: "#4ade80",
    yellow: "#facc15",
    blue: "#60a5fa",
    magenta: "#c084fc",
    cyan: "#22d3ee",
    white: "#fafafa",
  };

  let host: HTMLDivElement;
  let terminal = $state.raw<Terminal>();

  onMount(() => {
    const term = new Terminal({
      fontFamily: '"Geist Mono Variable", ui-monospace, Menlo, monospace',
      fontSize: 13,
      lineHeight: 1.35,
      cursorBlink: true,
      theme: dark ? DARK : LIGHT,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();
    // Re-measure once the web font has loaded, so cells line up.
    void document.fonts.ready.then(() => fit.fit());

    const stopOutput = session.onOutput((data) => term.write(data));
    const input = term.onData((data) => session.input(data));
    const resize = new ResizeObserver(() => fit.fit());
    resize.observe(host);
    terminal = term;

    return () => {
      stopOutput();
      input.dispose();
      resize.disconnect();
      term.dispose();
    };
  });

  $effect(() => {
    if (terminal) terminal.options.theme = dark ? DARK : LIGHT;
  });

  export const focus = () => terminal?.focus();
</script>

<div class="bg-background h-full pt-2 pl-3" bind:this={host}></div>
