export type Keymap = "default" | "vim" | "emacs";

export const PARTICIPANT_COLORS = [
  "#e5484d",
  "#f76b15",
  "#ffc53d",
  "#30a46c",
  "#12a594",
  "#0090ff",
  "#6e56cf",
  "#d6409f",
];

interface Prefs {
  name: string;
  color: string;
  keymap: Keymap;
  hostSecret: string;
}

const KEY = "pairbox.prefs";

function initial(): Prefs {
  const defaults: Prefs = {
    name: "",
    color: PARTICIPANT_COLORS[Math.floor(Math.random() * PARTICIPANT_COLORS.length)] ?? "#0090ff",
    keymap: "default",
    hostSecret: "",
  };
  try {
    return {
      ...defaults,
      ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>),
    };
  } catch {
    return defaults;
  }
}

/** Personal preferences, kept in this browser. The theme is handled by mode-watcher. */
export const prefs = $state<Prefs>(initial());

$effect.root(() => {
  $effect(() => {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  });
});
