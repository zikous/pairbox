<script lang="ts">
  let { class: className = "size-5" }: { class?: string } = $props();
</script>

<!-- Two overlapping boxes: a pair, sharing one box. -->
<svg viewBox="0 0 24 24" class={className} aria-hidden="true">
  <rect
    x="2.5"
    y="2.5"
    width="12"
    height="12"
    rx="2.5"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
  />
  <rect x="9.5" y="9.5" width="12" height="12" rx="2.5" class="fill-primary" />
</svg>
