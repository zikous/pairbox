<script lang="ts">
  import { SearchX } from "@lucide/svelte";
  import Logo from "$lib/components/brand/Logo.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty";

  let { title = "Page not found", message = "This page doesn't exist." } = $props();
</script>

<div class="flex h-full flex-col">
  <header class="border-b">
    <div class="mx-auto flex h-14 max-w-4xl items-center px-4"><Logo /></div>
  </header>
  <Empty.Root class="flex-1">
    <Empty.Header>
      <Empty.Media variant="icon"><SearchX /></Empty.Media>
      <Empty.Title>{title}</Empty.Title>
      <Empty.Description>{message}</Empty.Description>
    </Empty.Header>
    <Empty.Content>
      <Button href="/" variant="outline" size="sm">Back to rooms</Button>
    </Empty.Content>
  </Empty.Root>
</div>
