<script lang="ts">
  import { Timer } from "@lucide/svelte";
  import { span } from "$lib/format";
  import { clock } from "$lib/now.svelte";

  /** How long the session has left. Turns red for the last five minutes. */
  let { endsAt }: { endsAt: string } = $props();
  const left = $derived(Date.parse(endsAt) - clock.now);
</script>

<span
  class={[
    "flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px]",
    left < 5 * 60_000 ? "text-destructive border-destructive/40" : "text-muted-foreground",
  ]}
  title="Time left in this session"
>
  <Timer class="size-3" />{span(left)} left
</span>
