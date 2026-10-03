import { toast } from "svelte-sonner";
import { api } from "$lib/api";
import { errorMessage } from "$lib/format";

const SAVE_DELAY_MS = 800;

/**
 * Where the notes stand. `unavailable` means they couldn't be loaded: nothing is ever saved
 * then, so what's on the server can't be overwritten by an empty page.
 */
export type NotesState = "loading" | "unavailable" | "saved" | "saving" | "unsaved" | "failed";

/**
 * Your private notes on one session, as one Markdown document. Changes are saved shortly after
 * you stop typing, and right away when the notes are closed.
 */
export class SessionNotes {
  body = $state("");
  state = $state<NotesState>("loading");

  private timer?: ReturnType<typeof setTimeout>;
  private saving = Promise.resolve();

  constructor(private readonly roomId: string) {
    api.notes.get(roomId).then(
      (notes) => ([this.body, this.state] = [notes.body, "saved"]),
      (error) => {
        this.state = "unavailable";
        toast.error("Couldn't load your notes", { description: errorMessage(error) });
      },
    );
  }

  /** Whether the notes are loaded and can be written in. */
  get ready(): boolean {
    return this.state !== "loading" && this.state !== "unavailable";
  }

  edit(body: string): void {
    if (!this.ready) return;
    this.body = body;
    this.state = "unsaved";
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), SAVE_DELAY_MS);
  }

  /** Saves now if anything changed. Saves run one after the other, so the last edit wins. */
  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.state !== "unsaved" && this.state !== "failed") return this.saving;
    const body = this.body;
    this.saving = this.saving.then(async () => {
      this.state = "saving";
      try {
        await api.notes.save(this.roomId, body);
        // Typing during the save leaves it unsaved, for the next save.
        if (this.body === body) this.state = "saved";
        else this.state = "unsaved";
      } catch {
        this.state = "failed";
      }
    });
    return this.saving;
  }
}
