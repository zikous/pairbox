<script lang="ts">
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import { Button } from "$lib/components/ui/button";
  import JoinForm from "./JoinForm.svelte";

  /** The front page for visitors: join a session, or sign up to run your own. */
</script>

<svelte:head><title>pairbox</title></svelte:head>
<div class="relative min-h-full">
  <div
    class="dot-grid pointer-events-none absolute inset-x-0 top-0 h-80 [mask-image:linear-gradient(to_bottom,black,transparent)]"
  ></div>
  <PageHeader />

  <main class="relative mx-auto max-w-3xl px-4 pt-14 pb-20">
    <section>
      <h1 class="text-3xl font-semibold tracking-tight text-balance">
        Pair on code, <span class="text-primary">in one box.</span>
      </h1>
      <p class="text-muted-foreground mt-2 mb-6 max-w-lg">
        A shared editor and a live terminal. Paste an invite to jump in.
      </p>
      <JoinForm />
    </section>

    <section
      class="bg-card mt-16 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-5"
    >
      <div>
        <p class="font-medium">Run your own interviews</p>
        <p class="text-muted-foreground text-sm">
          Schedule sessions, let candidates in, and replay every keystroke afterwards.
        </p>
      </div>
      <div class="flex gap-2">
        <Button href="/signin" variant="outline" size="sm">Sign in</Button>
        <Button href="/signup" size="sm">Create account</Button>
      </div>
    </section>
  </main>
</div>
