<script lang="ts">
  import Logo from "$lib/components/brand/Logo.svelte";
  import ThemeMenu from "./ThemeMenu.svelte";
  import UserMenu from "./UserMenu.svelte";
</script>

<header class="relative mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
  <Logo />
  <div class="flex items-center gap-1">
    <UserMenu />
    <ThemeMenu />
  </div>
</header>
