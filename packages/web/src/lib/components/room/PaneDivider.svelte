<script lang="ts">
  import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "@lucide/svelte";
  import { PaneResizer } from "paneforge";
  import * as Tooltip from "$lib/components/ui/tooltip";

  /**
   * The line between the editor and the terminal. Drag it to resize; the pill in the middle
   * hides or shows the terminal (the pane after the divider).
   */
  interface Props {
    direction: "horizontal" | "vertical";
    collapsed: boolean;
    label: string;
    ontoggle: () => void;
  }

  let { direction, collapsed, label, ontoggle }: Props = $props();

  // Keep clicks on the button from starting a drag.
  const stop = (event: Event) => event.stopPropagation();
</script>

<PaneResizer
  class="bg-border hover:bg-ring/60 data-[active]:bg-primary relative flex items-center justify-center transition-colors
    data-[direction=horizontal]:w-px data-[direction=vertical]:h-px
    after:absolute data-[direction=horizontal]:after:inset-y-0 data-[direction=horizontal]:after:-inset-x-1
    data-[direction=vertical]:after:inset-x-0 data-[direction=vertical]:after:-inset-y-1"
>
  <Tooltip.Root>
    <Tooltip.Trigger
      class={[
        // A pill on the line, always visible: tall and thin beside the panes, wide when stacked.
        "bg-background text-muted-foreground z-10 grid cursor-pointer place-items-center rounded-full border shadow-sm transition-colors",
        "hover:bg-accent hover:text-foreground hover:border-ring",
        "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
        direction === "horizontal" ? "h-10 w-4" : "h-4 w-10",
        // A collapsed terminal leaves the divider at the window edge: keep the pill inside.
        collapsed && (direction === "horizontal" ? "-translate-x-2" : "-translate-y-2"),
      ]}
      aria-label={label}
      onclick={ontoggle}
      onmousedown={stop}
      ontouchstart={stop}
      onpointerdown={stop}
    >
      {#if direction === "horizontal"}
        {#if collapsed}<ChevronLeft class="size-3.5" />{:else}<ChevronRight class="size-3.5" />{/if}
      {:else if collapsed}<ChevronUp class="size-3.5" />{:else}<ChevronDown class="size-3.5" />{/if}
    </Tooltip.Trigger>
    <Tooltip.Content side={direction === "horizontal" ? "left" : "top"}>{label}</Tooltip.Content>
  </Tooltip.Root>
</PaneResizer>
