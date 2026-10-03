<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { minimalSetup } from "codemirror";
  import { markdown } from "@codemirror/lang-markdown";
  import { Compartment, EditorState } from "@codemirror/state";
  import { EditorView, placeholder } from "@codemirror/view";
  import { Clock, Download, Lock } from "@lucide/svelte";
  import { mode } from "mode-watcher";
  import IconButton from "$lib/components/shared/IconButton.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { editorTheme, themeExtension } from "$lib/editor-theme";
  import { SessionNotes, type NotesState } from "$lib/notes.svelte";

  /**
   * Your private notes on a session: one Markdown file you write freely. Saved as you type.
   * `stamp` gives "Insert time" its text: the time of day live, the playback time in a replay.
   */
  interface Props {
    roomId: string;
    /** Names the downloaded file. */
    title: string;
    stamp?: () => string;
  }

  let { roomId, title, stamp }: Props = $props();

  const notes = $derived(new SessionNotes(roomId));
  let host = $state<HTMLDivElement>();
  let view: EditorView | undefined;
  const themeSlot = new Compartment();
  const dark = $derived(mode.current === "dark");

  const STATUS: Record<NotesState, string> = {
    loading: "Loading…",
    unavailable: "Couldn't load",
    saved: "Saved",
    saving: "Saving…",
    unsaved: "Editing…",
    failed: "Not saved yet",
  };

  /** Notes read as prose: wrapped lines and the sans-serif font, unlike code. */
  const notesTheme = EditorView.theme({
    ".cm-scroller": { fontFamily: "var(--font-sans)", lineHeight: "1.6" },
    ".cm-content": { padding: "12px 14px" },
    ".cm-placeholder": { color: "var(--muted-foreground)" },
  });

  // The editor starts once the notes are loaded, with their text.
  $effect(() => {
    if (!host || !notes.ready || view) return;
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: untrack(() => notes.body),
        extensions: [
          minimalSetup,
          markdown(),
          EditorView.lineWrapping,
          placeholder("Write anything. Markdown works: # headings, - lists, **bold**."),
          themeSlot.of(themeExtension(dark)),
          editorTheme,
          notesTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) notes.edit(update.state.doc.toString());
          }),
        ],
      }),
    });
  });

  $effect(() => {
    view?.dispatch({ effects: themeSlot.reconfigure(themeExtension(dark)) });
  });

  // Closing the panel saves what's left.
  onMount(() => () => {
    void notes.flush();
    view?.destroy();
  });

  function insertTime() {
    if (!view || !stamp) return;
    view.dispatch(view.state.replaceSelection(`**${stamp()}** `));
    view.focus();
  }

  function download() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([notes.body], { type: "text/markdown" }));
    link.download = `${title.replace(/[^\w-]+/g, "-").toLowerCase() || "session"}-notes.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
</script>

<!-- Closing the tab within a moment of typing: ask first, rather than lose the last words. -->
<svelte:window
  onbeforeunload={(event) => {
    if (notes.state === "unsaved" || notes.state === "saving") event.preventDefault();
  }}
/>

<div class="flex h-full min-h-0 flex-col">
  <div class="flex h-9 shrink-0 items-center gap-2 border-b pr-1 pl-3">
    <span class="font-mono text-xs">notes.md</span>
    <span
      class={[
        "text-[11px]",
        notes.state === "failed" || notes.state === "unavailable"
          ? "text-destructive"
          : "text-muted-foreground",
      ]}
    >
      {STATUS[notes.state]}
    </span>
    <span class="text-muted-foreground ml-auto flex items-center gap-1 text-[11px]">
      <Lock class="size-3" /> Only you
    </span>
    {#if stamp}
      <Button variant="ghost" size="xs" onclick={insertTime} disabled={!notes.ready}>
        <Clock /> Insert time
      </Button>
    {/if}
    <IconButton label="Download notes.md" onclick={download}><Download /></IconButton>
  </div>

  <div class="relative min-h-0 flex-1">
    {#if notes.state === "loading"}
      <div class="space-y-2 p-4">
        <Skeleton class="h-4 w-2/3" />
        <Skeleton class="h-4 w-1/2" />
      </div>
    {/if}
    <div bind:this={host} class="h-full"></div>
  </div>
</div>
