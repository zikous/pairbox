<script lang="ts">
  import { LANGUAGES, normalizeDisplayName, type Room } from "@pairbox/domain";
  import Logo from "$lib/components/brand/Logo.svelte";
  import LanguageDot from "$lib/components/shared/LanguageDot.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Field from "$lib/components/ui/field";
  import { Input } from "$lib/components/ui/input";
  import { prefs } from "$lib/prefs.svelte";

  /** Asks for a display name before someone enters a room for the first time. */
  let { room }: { room: Room } = $props();

  let name = $state(prefs.name);
  const validName = $derived(normalizeDisplayName(name));

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (validName) prefs.name = validName;
  }
</script>

<div class="dot-grid flex h-full flex-col items-center justify-center gap-8 p-4">
  <Logo />
  <form class="bg-card w-full max-w-sm rounded-lg border shadow-sm" onsubmit={submit}>
    <div class="space-y-1.5 border-b p-5">
      <p class="label-mono">Joining</p>
      <h1 class="text-lg font-semibold tracking-tight">{room.name}</h1>
      <p class="text-muted-foreground flex items-center gap-2 font-mono text-xs">
        <LanguageDot language={room.language} />{LANGUAGES[room.language].file}
        <span>·</span>{room.id}
      </p>
    </div>
    <div class="space-y-5 p-5">
      <Field.Field>
        <Field.Label for="your-name">Your name</Field.Label>
        <Input id="your-name" bind:value={name} placeholder="Ada Lovelace" maxlength={32} />
        <Field.Description>Shown next to your cursor.</Field.Description>
      </Field.Field>
      <Button type="submit" class="w-full" disabled={!validName}>Join room</Button>
    </div>
  </form>
</div>
