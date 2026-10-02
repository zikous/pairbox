<script lang="ts">
  import { Monitor, Moon, Sun } from "@lucide/svelte";
  import { setMode, userPrefersMode } from "mode-watcher";
  import { buttonVariants } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger class={buttonVariants({ variant: "ghost", size: "icon-sm" })}>
    <Sun class="size-4 dark:hidden" />
    <Moon class="hidden size-4 dark:block" />
    <span class="sr-only">Theme</span>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end" class="w-36">
    <DropdownMenu.RadioGroup
      value={userPrefersMode.current}
      onValueChange={(value) => setMode(value as "light" | "dark" | "system")}
    >
      <DropdownMenu.RadioItem value="light"><Sun /> Light</DropdownMenu.RadioItem>
      <DropdownMenu.RadioItem value="dark"><Moon /> Dark</DropdownMenu.RadioItem>
      <DropdownMenu.RadioItem value="system"><Monitor /> System</DropdownMenu.RadioItem>
    </DropdownMenu.RadioGroup>
  </DropdownMenu.Content>
</DropdownMenu.Root>
