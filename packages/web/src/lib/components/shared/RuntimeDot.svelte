<script lang="ts">
  import type { Runtime } from "@pairbox/shared";

  let { runtime }: { runtime: Runtime } = $props();
  const COLORS: Record<Runtime, string> = {
    python: "#f2c230",
    typescript: "#3178c6",
  };
</script>

<span class="size-2 shrink-0 rounded-full" style:background={COLORS[runtime]}></span>
