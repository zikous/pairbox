import { toast } from "svelte-sonner";

export async function copyLink(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied", { description: url });
  } catch {
    toast.error("Couldn't copy the link");
  }
}
