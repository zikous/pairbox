<script lang="ts">
  import { toast } from "svelte-sonner";
  import { RUNTIMES, isRuntime, normalizeRoomName, type Runtime } from "@pairbox/shared";
  import { api } from "$lib/api";
  import { errorMessage } from "$lib/format";
  import RuntimeDot from "$lib/components/shared/RuntimeDot.svelte";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Field from "$lib/components/ui/field";
  import { Input } from "$lib/components/ui/input";
  import { Spinner } from "$lib/components/ui/spinner";
  import { roomPath, router } from "$lib/router.svelte";

  /** Creates a room, then opens it. */
  let { open = $bindable() }: { open: boolean } = $props();

  let name = $state("");
  let runtime = $state<Runtime>("python");
  let creating = $state(false);
  const validName = $derived(normalizeRoomName(name));

  // Start from a blank form every time the dialog opens.
  $effect(() => {
    if (!open) return;
    name = "";
    runtime = "python";
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!validName) return;
    creating = true;
    try {
      const room = await api.rooms.create({ name: validName, runtime });
      open = false;
      router.navigate(roomPath(room.id));
    } catch (error) {
      toast.error("Couldn't create the room", { description: errorMessage(error) });
    } finally {
      creating = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>New room</Dialog.Title>
      <Dialog.Description>Anyone with the link can join and edit.</Dialog.Description>
    </Dialog.Header>

    <form onsubmit={submit}>
      <Field.Group>
        <Field.Field>
          <Field.Label for="room-name">Name</Field.Label>
          <Input id="room-name" bind:value={name} placeholder="Frontend interview" maxlength={60} />
        </Field.Field>

        <Field.Field>
          <Field.Label>Starting language</Field.Label>
          <div class="grid grid-cols-2 gap-2" role="radiogroup">
            {#each Object.entries(RUNTIMES) as [id, { label, file }] (id)}
              <button
                type="button"
                role="radio"
                aria-checked={runtime === id}
                class="hover:bg-muted/50 aria-checked:border-primary aria-checked:bg-primary/5 focus-visible:ring-ring/50 flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors outline-none focus-visible:ring-3"
                onclick={() => isRuntime(id) && (runtime = id)}
              >
                <span class="flex items-center gap-2 text-sm font-medium">
                  {#if isRuntime(id)}<RuntimeDot runtime={id} />{/if}{label}
                </span>
                <span class="text-muted-foreground font-mono text-xs">{file}</span>
              </button>
            {/each}
          </div>
        </Field.Field>
      </Field.Group>

      <Dialog.Footer class="mt-6">
        <Dialog.Close class={buttonVariants({ variant: "outline" })} disabled={creating}>
          Cancel
        </Dialog.Close>
        <Button type="submit" disabled={!validName || creating}>
          {#if creating}<Spinner /> Creating…{:else}Create room{/if}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
