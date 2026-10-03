<script lang="ts">
  import { LogOut } from "@lucide/svelte";
  import { auth } from "$lib/auth.svelte";
  import { buttonVariants } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";

  /** Who is signed in, and the way out. Shows a sign-in link when nobody is. */
</script>

{#if auth.user}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger class={buttonVariants({ variant: "ghost", size: "sm" })}>
      {auth.user.email}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end" class="w-48">
      <DropdownMenu.Item onSelect={() => auth.signOut()}><LogOut /> Sign out</DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{:else if auth.user === null}
  <a href="/signin" class={buttonVariants({ variant: "ghost", size: "sm" })}>Sign in</a>
{/if}
