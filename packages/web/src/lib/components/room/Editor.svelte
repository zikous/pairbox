<script lang="ts">
  import { onMount } from "svelte";
  import { basicSetup } from "codemirror";
  import { indentLess, insertTab } from "@codemirror/commands";
  import { Compartment, EditorState, Prec, type Extension } from "@codemirror/state";
  import { EditorView, keymap as keymapFacet } from "@codemirror/view";
  import { indentUnit, syntaxHighlighting } from "@codemirror/language";
  import { python } from "@codemirror/lang-python";
  import { javascript } from "@codemirror/lang-javascript";
  import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
  import { vim } from "@replit/codemirror-vim";
  import { emacs } from "@replit/codemirror-emacs";
  import { yCollab } from "y-codemirror.next";
  import type { Awareness } from "y-protocols/awareness";
  import type * as Y from "yjs";
  import type { Language } from "@pairbox/shared";
  import type { Keymap } from "$lib/prefs.svelte";

  interface Props {
    doc: Y.Doc;
    awareness: Awareness;
    language: Language;
    keymap: Keymap;
    dark: boolean;
    onrun: () => void;
    oncursor?: (position: { line: number; column: number }) => void;
  }

  let { doc, awareness, language, keymap, dark, onrun, oncursor }: Props = $props();

  let host: HTMLDivElement;
  let view = $state.raw<EditorView>();
  const languageSlot = new Compartment();
  const themeSlot = new Compartment();
  const keymapSlot = new Compartment();

  const languageExtension = (value: Language): Extension =>
    value === "python" ? python() : javascript();

  const keymapExtension = (value: Keymap): Extension =>
    value === "vim" ? vim() : value === "emacs" ? emacs() : [];

  const themeExtension = (isDark: boolean): Extension => [
    EditorView.theme({}, { dark: isDark }),
    isDark ? syntaxHighlighting(oneDarkHighlightStyle) : [],
  ];

  const baseTheme = EditorView.theme({
    "&": {
      height: "100%",
      fontSize: "13.5px",
      backgroundColor: "var(--background)",
    },
    ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.7" },
    ".cm-content": { padding: "10px 0", caretColor: "var(--foreground)" },
    ".cm-gutters": {
      backgroundColor: "var(--background)",
      color: "var(--muted-foreground)",
      border: "none",
      paddingLeft: "6px",
    },
    ".cm-lineNumbers .cm-gutterElement": { minWidth: "28px", opacity: "0.6" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", opacity: "1" },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in oklch, var(--muted) 60%, transparent)",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor": { borderLeftColor: "var(--foreground)" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground":
      { backgroundColor: "color-mix(in oklch, var(--ring) 35%, transparent)" },
    ".cm-ySelectionInfo": {
      fontFamily: "var(--font-sans)",
      fontSize: "11px",
      fontWeight: "500",
      padding: "1px 4px",
      borderRadius: "3px",
    },
    ".cm-tooltip": {
      border: "1px solid var(--border)",
      borderRadius: "8px",
      backgroundColor: "var(--popover)",
      overflow: "hidden",
    },
  });

  /** Mod-Enter runs the code, even in vim or emacs mode. */
  const runShortcut = Prec.highest(
    keymapFacet.of([
      {
        key: "Mod-Enter",
        run: () => {
          onrun();
          return true;
        },
      },
    ]),
  );

  /** Indent with real tabs, shown 4 columns wide. Esc then Tab still leaves the editor. */
  const tabIndentation: Extension = [
    indentUnit.of("\t"),
    EditorState.tabSize.of(4),
    keymapFacet.of([{ key: "Tab", run: insertTab, shift: indentLess }]),
  ];

  const cursorReporter = EditorView.updateListener.of((update) => {
    if (!update.selectionSet && !update.docChanged) return;
    const head = update.state.selection.main.head;
    const line = update.state.doc.lineAt(head);
    oncursor?.({ line: line.number, column: head - line.from + 1 });
  });

  onMount(() => {
    const text = doc.getText("code");
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: text.toString(),
        extensions: [
          keymapSlot.of(keymapExtension(keymap)),
          runShortcut,
          basicSetup,
          tabIndentation,
          cursorReporter,
          languageSlot.of(languageExtension(language)),
          themeSlot.of(themeExtension(dark)),
          baseTheme,
          yCollab(text, awareness),
        ],
      }),
    });
    return () => view?.destroy();
  });

  // Swap settings in place when props change, without recreating the editor.
  $effect(() => {
    view?.dispatch({
      effects: languageSlot.reconfigure(languageExtension(language)),
    });
  });
  $effect(() => {
    view?.dispatch({ effects: themeSlot.reconfigure(themeExtension(dark)) });
  });
  $effect(() => {
    view?.dispatch({
      effects: keymapSlot.reconfigure(keymapExtension(keymap)),
    });
  });
</script>

<div class="h-full overflow-hidden" bind:this={host}></div>
