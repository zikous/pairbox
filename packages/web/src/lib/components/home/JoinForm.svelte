<script lang="ts">
  import { CornerDownLeft } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { roomPath, router } from "$lib/router.svelte";

  /** A prompt-style input that accepts a room code or a full invite link. */
  let value = $state("");
  let error = $state("");

  function submit(event: SubmitEvent) {
    event.preventDefault();
    const id = /(?:\/r\/)?([a-z0-9]{4,})\/?$/.exec(value.trim())?.[1];
    if (id) router.navigate(roomPath(id));
    else error = "That doesn't look like a room link or code.";
  }
</script>

<form
  class="bg-card focus-within:border-ring focus-within:ring-ring/20 flex h-12 max-w-xl items-center gap-2 rounded-lg border pr-1.5 pl-4 shadow-sm transition-shadow focus-within:ring-4"
  onsubmit={submit}
>
  <span class="text-primary font-mono text-sm font-semibold" aria-hidden="true">❯</span>
  <input
    bind:value
    oninput={() => (error = "")}
    placeholder="paste a room link or code"
    aria-label="Room link or code"
    aria-invalid={!!error}
    class="placeholder:text-muted-foreground/70 h-full min-w-0 flex-1 bg-transparent font-mono text-sm outline-none"
  />
  <Button type="submit" size="sm" disabled={!value.trim()}>
    Join <CornerDownLeft class="opacity-70" />
  </Button>
</form>
{#if error}<p class="text-destructive mt-2 font-mono text-xs">{error}</p>{/if}
