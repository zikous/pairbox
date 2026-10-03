<script lang="ts">
  import JoinForm from "$lib/components/home/JoinForm.svelte";
  import PageTitle from "$lib/components/shared/PageTitle.svelte";

  /** Someone else's session: paste their invite, then wait for them to let you in. */
</script>

<main class="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
  <PageTitle
    title="Join a session"
    description="Paste the invite link or room code you were sent. Its host lets you in."
  />
  <div class="mt-8"><JoinForm /></div>
</main>
