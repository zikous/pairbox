<script lang="ts">
  import { fade } from "svelte/transition";
  import { RUNTIMES, normalizeDisplayName, type Room } from "@pairbox/shared";
  import RuntimeDot from "$lib/components/shared/RuntimeDot.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Field from "$lib/components/ui/field";
  import { Input } from "$lib/components/ui/input";
  import { prefs } from "$lib/prefs.svelte";

  /**
   * Asks who you are before entering. Guests use it to ask the owner to let them in; the
   * owner just picks the name others will see.
   */
  interface Props {
    room: Room;
    action: string;
    hint: string;
    onsubmit: () => void;
  }

  let { room, action, hint, onsubmit }: Props = $props();

  let name = $state(prefs.name);
  const validName = $derived(normalizeDisplayName(name));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!validName) return;
    prefs.name = validName;
    onsubmit();
  }
</script>

<div class="dot-grid grid h-full place-items-center p-4" in:fade={{ duration: 150 }}>
  <form class="bg-card w-full max-w-sm rounded-lg border shadow-sm" onsubmit={submit}>
    <div class="space-y-1.5 border-b p-5">
      <p class="label-mono">Joining</p>
      <h2 class="text-lg font-semibold tracking-tight">{room.name}</h2>
      <p class="text-muted-foreground flex items-center gap-2 font-mono text-xs">
        <RuntimeDot runtime={room.runtime} />{RUNTIMES[room.runtime].file}
        <span>·</span>{room.id}
      </p>
    </div>
    <div class="space-y-5 p-5">
      <Field.Field>
        <Field.Label for="your-name">Your name</Field.Label>
        <Input id="your-name" bind:value={name} placeholder="Ada Lovelace" maxlength={32} />
        <Field.Description>{hint}</Field.Description>
      </Field.Field>
      <Button type="submit" class="w-full" disabled={!validName}>{action}</Button>
    </div>
  </form>
</div>
