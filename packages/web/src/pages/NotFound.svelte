<script lang="ts">
  import { SearchX } from "@lucide/svelte";
  import Logo from "$lib/components/brand/Logo.svelte";
  import StateMessage from "$lib/components/shared/StateMessage.svelte";
  import { Button } from "$lib/components/ui/button";
</script>

<div class="flex h-full flex-col">
  <header class="mx-auto flex h-14 w-full max-w-3xl shrink-0 items-center px-4"><Logo /></header>
  <StateMessage icon={SearchX} title="Page not found" message="This page doesn't exist.">
    {#snippet actions()}
      <Button href="/" variant="outline" size="sm">Back to rooms</Button>
    {/snippet}
  </StateMessage>
</div>
