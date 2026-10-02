<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { Check } from "@lucide/svelte";
  import { copyText } from "$lib/clipboard";

  /**
   * A button that copies `text` and shows "Copied" in place for a moment.
   * Pass the idle content as children; style it with `class`.
   */
  interface Props extends Omit<HTMLButtonAttributes, "onclick"> {
    text: string;
    children: Snippet;
  }

  let { text, children, ...rest }: Props = $props();

  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    if (!(await copyText(text))) return;
    copied = true;
    clearTimeout(timer);
    timer = setTimeout(() => (copied = false), 2000);
  }
</script>

<button type="button" {...rest} onclick={copy} aria-live="polite">
  {#if copied}
    <Check class="text-success" /> Copied
  {:else}
    {@render children()}
  {/if}
</button>
