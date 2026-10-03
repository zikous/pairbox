<script lang="ts">
  import { onMount } from "svelte";
  import { Terminal, type ITheme } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import "@xterm/xterm/css/xterm.css";

  /** Where output comes from and keystrokes go: a live room, or a replay (no input). */
  interface Source {
    onOutput(listener: (data: string) => void): () => void;
    input?(data: string): void;
    resize?(cols: number, rows: number): void;
  }

  let { session, dark }: { session: Source; dark: boolean } = $props();

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

  const MIN_COLUMNS = 20;

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
    const input = term.onData((data) => session.input?.(data));

    // Text drawn into a very narrow terminal gets wrapped, and resizing back leaves the prompt
    // scrambled. So the terminal never shrinks below MIN_COLUMNS (it keeps its last size while
    // the pane is collapsing or collapsed), and output is only drawn once it has a real size.
    let fontReady = false;
    let disposed = false;
    let stopOutput: (() => void) | undefined;

    const refit = () => {
      if (disposed || !fontReady) return;
      const size = fit.proposeDimensions();
      if (!size || size.cols < MIN_COLUMNS) return;
      if (size.cols !== term.cols || size.rows !== term.rows) term.resize(size.cols, size.rows);
      session.resize?.(term.cols, term.rows); // so the real shell wraps lines at the same width
      stopOutput ??= session.onOutput((data) => term.write(data));
    };
    const resize = new ResizeObserver(refit);
    resize.observe(host);
    void document.fonts.ready.then(() => {
      fontReady = true;
      refit();
    });
    terminal = term;

    return () => {
      disposed = true;
      stopOutput?.();
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
