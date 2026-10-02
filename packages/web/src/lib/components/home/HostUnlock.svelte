<script lang="ts">
  import { api } from "$lib/api";
  import * as Field from "$lib/components/ui/field";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Spinner } from "$lib/components/ui/spinner";
  import { prefs } from "$lib/prefs.svelte";

  /** Asks for the host secret, which is needed to create and delete rooms. */
  const dev = import.meta.env.DEV;
  let secret = $state("");
  let unlocking = $state(false);
  let error = $state("");

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    unlocking = true;
    error = "";
    if (await api.rooms.unlock(secret)) prefs.hostSecret = secret;
    else error = "That secret doesn't match this server.";
    unlocking = false;
  }
</script>

<form class="bg-card rounded-lg border p-5" onsubmit={submit}>
  <Field.Field>
    <Field.Label for="host-secret">Host secret</Field.Label>
    <div class="flex max-w-md gap-2">
      <Input
        id="host-secret"
        type="password"
        bind:value={secret}
        placeholder="••••••••"
        aria-invalid={!!error}
      />
      <Button type="submit" variant="secondary" disabled={!secret.trim() || unlocking}>
        {#if unlocking}<Spinner />{/if} Unlock
      </Button>
    </div>
    {#if error}
      <Field.Error>{error}</Field.Error>
    {:else}
      <Field.Description>
        Needed to create and delete rooms. It's the server's <code>HOST_SECRET</code>{#if dev},
          which is <code>dev</code> in development{/if}.
      </Field.Description>
    {/if}
  </Field.Field>
</form>
