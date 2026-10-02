<script lang="ts">
  import { Check } from "@lucide/svelte";
  import { setMode, userPrefersMode } from "mode-watcher";
  import { normalizeDisplayName } from "@pairbox/domain";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Field from "$lib/components/ui/field";
  import { Input } from "$lib/components/ui/input";
  import * as ToggleGroup from "$lib/components/ui/toggle-group";
  import { PARTICIPANT_COLORS, prefs, type Keymap } from "$lib/prefs.svelte";

  let { open = $bindable() }: { open: boolean } = $props();

  let name = $state("");
  const validName = $derived(normalizeDisplayName(name));

  $effect(() => {
    if (open) name = prefs.name;
  });

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!validName) return;
    prefs.name = validName;
    open = false;
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Preferences</Dialog.Title>
      <Dialog.Description>Your name and color are visible to others in the room.</Dialog.Description
      >
    </Dialog.Header>

    <form onsubmit={save}>
      <Field.Group>
        <Field.Field>
          <Field.Label for="display-name">Display name</Field.Label>
          <Input id="display-name" bind:value={name} maxlength={32} aria-invalid={!validName} />
        </Field.Field>

        <Field.Field>
          <Field.Label>Cursor color</Field.Label>
          <div class="flex gap-2">
            {#each PARTICIPANT_COLORS as color (color)}
              <button
                type="button"
                class="ring-offset-background grid size-7 place-items-center rounded-full text-white transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                style:background={color}
                aria-label="Color {color}"
                aria-pressed={prefs.color === color}
                onclick={() => (prefs.color = color)}
              >
                {#if prefs.color === color}<Check class="size-3.5" strokeWidth={3} />{/if}
              </button>
            {/each}
          </div>
        </Field.Field>

        <Field.Field>
          <Field.Label>Theme</Field.Label>
          <ToggleGroup.Root
            type="single"
            variant="outline"
            class="w-full"
            value={userPrefersMode.current}
            onValueChange={(value) => value && setMode(value as "light" | "dark" | "system")}
          >
            <ToggleGroup.Item value="light" class="flex-1">Light</ToggleGroup.Item>
            <ToggleGroup.Item value="dark" class="flex-1">Dark</ToggleGroup.Item>
            <ToggleGroup.Item value="system" class="flex-1">System</ToggleGroup.Item>
          </ToggleGroup.Root>
        </Field.Field>

        <Field.Field>
          <Field.Label>Editor keymap</Field.Label>
          <ToggleGroup.Root
            type="single"
            variant="outline"
            class="w-full"
            value={prefs.keymap}
            onValueChange={(value) => value && (prefs.keymap = value as Keymap)}
          >
            <ToggleGroup.Item value="default" class="flex-1">Default</ToggleGroup.Item>
            <ToggleGroup.Item value="vim" class="flex-1">Vim</ToggleGroup.Item>
            <ToggleGroup.Item value="emacs" class="flex-1">Emacs</ToggleGroup.Item>
          </ToggleGroup.Root>
        </Field.Field>
      </Field.Group>

      <Dialog.Footer class="mt-6">
        <Button type="submit" disabled={!validName}>Save</Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
