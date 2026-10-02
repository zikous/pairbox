<script lang="ts">
  import type { Component, Snippet } from "svelte";
  import * as Empty from "$lib/components/ui/empty";

  /** A centered icon, title and message, for empty, missing or failed states. */
  interface Props {
    icon: Component;
    title: string;
    message: string;
    actions?: Snippet;
  }

  let { icon: Icon, title, message, actions }: Props = $props();
</script>

<Empty.Root class="h-full">
  <Empty.Header>
    <Empty.Media variant="icon"><Icon /></Empty.Media>
    <Empty.Title>{title}</Empty.Title>
    <Empty.Description>{message}</Empty.Description>
  </Empty.Header>
  {#if actions}<Empty.Content>{@render actions()}</Empty.Content>{/if}
</Empty.Root>
