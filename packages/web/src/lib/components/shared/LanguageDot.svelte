<script lang="ts">
  import type { Language } from "@pairbox/shared";

  let { language }: { language: Language } = $props();
  const COLORS: Record<Language, string> = {
    python: "#3572a5",
    javascript: "#e6b400",
  };
</script>

<span class="size-2 shrink-0 rounded-full" style:background={COLORS[language]}></span>
