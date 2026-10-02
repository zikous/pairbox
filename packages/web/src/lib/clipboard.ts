import { toast } from "svelte-sonner";

/** Copies text, showing an error toast if the browser refuses. Returns whether it worked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    toast.error("Couldn't copy to the clipboard");
    return false;
  }
}

/** For places with no room for inline feedback, like menus: confirms with a toast. */
export async function copyLink(url: string): Promise<void> {
  if (await copyText(url)) toast.success("Link copied", { description: url });
}
