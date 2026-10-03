import { syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";

/** Light or dark, to swap in place when the page's theme changes. */
export const themeExtension = (isDark: boolean): Extension => [
  EditorView.theme({}, { dark: isDark }),
  isDark ? syntaxHighlighting(oneDarkHighlightStyle) : [],
];

/** The look shared by every editor in the app (code, notes), following the page's colors. */
export const editorTheme = EditorView.theme({
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
  // Other people's cursors: a 2px line in their color, with their name on hover.
  // The library's floating dot is hidden: it lags behind the line when the cursor moves.
  ".cm-ySelectionCaret": {
    borderLeftWidth: "2px",
    borderRightWidth: "0",
    marginLeft: "-1px",
    marginRight: "-1px",
  },
  ".cm-ySelectionCaretDot": { display: "none" },
  ".cm-ySelectionInfo": {
    top: "-1.5em",
    left: "-2px",
    padding: "1px 5px",
    borderRadius: "4px 4px 4px 0",
    fontFamily: "var(--font-sans)",
    fontSize: "11px",
    fontWeight: "600",
    lineHeight: "1.4",
    pointerEvents: "none",
  },
  ".cm-tooltip": {
    border: "1px solid var(--border)",
    borderRadius: "8px",
    backgroundColor: "var(--popover)",
    overflow: "hidden",
  },
});
