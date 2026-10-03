<script lang="ts">
  import { PASSWORD_MIN } from "@pairbox/shared";
  import { auth } from "$lib/auth.svelte";
  import Logo from "$lib/components/brand/Logo.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Field from "$lib/components/ui/field";
  import { Input } from "$lib/components/ui/input";
  import { Spinner } from "$lib/components/ui/spinner";
  import { errorMessage } from "$lib/format";
  import { router } from "$lib/router.svelte";

  /** Sign in and sign up share one form. */
  let { mode }: { mode: "sign-in" | "sign-up" } = $props();
  const signingUp = $derived(mode === "sign-up");

  let email = $state("");
  let password = $state("");
  let submitting = $state(false);
  let error = $state("");

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    submitting = true;
    error = "";
    try {
      await (signingUp ? auth.signUp : auth.signIn)({ email, password });
      router.navigate("/");
    } catch (failure) {
      error = errorMessage(failure);
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head><title>{signingUp ? "Create an account" : "Sign in"} · pairbox</title></svelte:head>

<div class="dot-grid flex h-full flex-col items-center justify-center gap-8 p-4">
  <Logo />
  <form class="bg-card w-full max-w-sm space-y-5 rounded-lg border p-6 shadow-sm" onsubmit={submit}>
    <div class="space-y-1">
      <h1 class="text-lg font-semibold tracking-tight">
        {signingUp ? "Create your account" : "Sign in to pairbox"}
      </h1>
      <p class="text-muted-foreground text-sm">
        {signingUp ? "You need one to create rooms." : "To create and manage your rooms."}
      </p>
    </div>

    <Field.Field>
      <Field.Label for="email">Email</Field.Label>
      <Input id="email" type="email" autocomplete="email" bind:value={email} required />
    </Field.Field>
    <Field.Field>
      <Field.Label for="password">Password</Field.Label>
      <Input
        id="password"
        type="password"
        autocomplete={signingUp ? "new-password" : "current-password"}
        minlength={PASSWORD_MIN}
        bind:value={password}
        required
      />
      {#if signingUp}<Field.Description>At least {PASSWORD_MIN} characters.</Field.Description>{/if}
    </Field.Field>

    {#if error}<p class="text-destructive text-sm">{error}</p>{/if}

    <Button type="submit" class="w-full" disabled={submitting}>
      {#if submitting}<Spinner />{/if}
      {signingUp ? "Create account" : "Sign in"}
    </Button>

    <p class="text-muted-foreground text-center text-sm">
      {#if signingUp}
        Already have an account? <a href="/signin" class="text-foreground underline">Sign in</a>
      {:else}
        New here? <a href="/signup" class="text-foreground underline">Create an account</a>
      {/if}
    </p>
  </form>
</div>
