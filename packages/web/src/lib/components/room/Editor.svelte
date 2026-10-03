<script lang="ts">
  import { onMount } from "svelte";
  import { basicSetup } from "codemirror";
  import { indentLess, insertTab } from "@codemirror/commands";
  import { Compartment, EditorState, Prec, type Extension } from "@codemirror/state";
  import { EditorView, keymap as keymapFacet } from "@codemirror/view";
  import { indentUnit } from "@codemirror/language";
  import { python } from "@codemirror/lang-python";
  import { javascript } from "@codemirror/lang-javascript";
  import { vim } from "@replit/codemirror-vim";
  import { emacs } from "@replit/codemirror-emacs";
  import { yCollab } from "y-codemirror.next";
  import type { Awareness } from "y-protocols/awareness";
  import type * as Y from "yjs";
  import type { Runtime } from "@pairbox/shared";
  import { editorTheme, themeExtension } from "$lib/editor-theme";
  import type { Keymap } from "$lib/prefs.svelte";

  interface Props {
    doc: Y.Doc;
    awareness: Awareness;
    runtime: Runtime;
    keymap: Keymap;
    dark: boolean;
    onrun?: () => void;
    /** For replays: shows the document without letting anyone change it. */
    readonly?: boolean;
    oncursor?: (position: { line: number; column: number }) => void;
  }

  let {
    doc,
    awareness,
    runtime,
    keymap,
    dark,
    onrun,
    oncursor,
    readonly = false,
  }: Props = $props();

  let host: HTMLDivElement;
  let view = $state.raw<EditorView>();
  const languageSlot = new Compartment();
  const themeSlot = new Compartment();
  const keymapSlot = new Compartment();

  const languageExtension = (value: Runtime): Extension =>
    value === "python" ? python() : javascript({ typescript: true });

  const keymapExtension = (value: Keymap): Extension =>
    value === "vim" ? vim() : value === "emacs" ? emacs() : [];

  /** Mod-Enter runs the code, even in vim or emacs mode. */
  const runShortcut = Prec.highest(
    keymapFacet.of([
      {
        key: "Mod-Enter",
        run: () => {
          onrun?.();
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
          readonly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : [],
          tabIndentation,
          cursorReporter,
          languageSlot.of(languageExtension(runtime)),
          themeSlot.of(themeExtension(dark)),
          editorTheme,
          yCollab(text, awareness),
        ],
      }),
    });
    return () => view?.destroy();
  });

  // Swap settings in place when props change, without recreating the editor.
  $effect(() => {
    view?.dispatch({
      effects: languageSlot.reconfigure(languageExtension(runtime)),
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
