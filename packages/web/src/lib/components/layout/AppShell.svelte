<script lang="ts">
  import { onMount, type Component, type Snippet } from "svelte";
  import { CalendarDays, ChevronsUpDown, History, LogIn, LogOut, PanelLeft } from "@lucide/svelte";
  import type { RoomCounts } from "@pairbox/shared";
  import { auth } from "$lib/auth.svelte";
  import Logo from "$lib/components/brand/Logo.svelte";
  import LogoMark from "$lib/components/brand/LogoMark.svelte";
  import ThemeMenu from "$lib/components/shared/ThemeMenu.svelte";
  import UserMenu from "$lib/components/shared/UserMenu.svelte";
  import { buttonVariants } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { sessionCounts } from "$lib/counts.svelte";
  import { initials } from "$lib/format";
  import { router, type Route } from "$lib/router.svelte";
  import { cn } from "$lib/utils";

  /** The signed-in frame: a sidebar on wide screens (collapsible to icons), a top bar on phones. */
  let { children }: { children: Snippet } = $props();

  interface NavItem {
    href: string;
    label: string;
    icon: Component;
    active: (route: Route) => boolean;
    count?: (counts: RoomCounts) => number;
  }

  /** The app's pages. A new page is one more entry here. */
  const NAV: NavItem[] = [
    {
      href: "/",
      label: "Upcoming",
      icon: CalendarDays,
      active: (route) => route.name === "home",
      count: (counts) => counts.live + counts.upcoming,
    },
    {
      href: "/past",
      label: "Past",
      icon: History,
      active: (route) => route.name === "past" || route.name === "replay",
      count: (counts) => counts.past,
    },
    {
      href: "/join",
      label: "Join a session",
      icon: LogIn,
      active: (route) => route.name === "join",
    },
  ];

  const COLLAPSED_KEY = "pairbox:sidebar-collapsed";
  let collapsed = $state(false);

  onMount(() => {
    try {
      collapsed = localStorage.getItem(COLLAPSED_KEY) === "true";
    } catch {
      // No storage (private window): start expanded.
    }
    void sessionCounts.refresh();
  });

  function toggle() {
    collapsed = !collapsed;
    try {
      localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      // Not remembered, that's all.
    }
  }

  const itemClass = (active: boolean) =>
    cn(
      "hover:bg-sidebar-accent flex h-8 w-full items-center gap-2 rounded-md px-2 text-sm [&_svg]:size-4 [&_svg]:shrink-0",
      active ? "bg-sidebar-accent font-medium" : "text-sidebar-foreground/80",
      collapsed && "justify-center px-0",
    );
</script>

<div class="flex h-svh">
  <aside
    class={[
      "bg-sidebar text-sidebar-foreground hidden shrink-0 flex-col border-r transition-[width] md:flex",
      collapsed ? "w-14" : "w-60",
    ]}
  >
    <div class={["flex h-14 items-center", collapsed ? "justify-center" : "justify-between px-4"]}>
      {#if collapsed}
        <button type="button" onclick={toggle} aria-label="Expand the sidebar" class="group">
          <span class="group-hover:hidden"><LogoMark /></span>
          <PanelLeft class="hidden size-4 group-hover:block" />
        </button>
      {:else}
        <Logo />
        <button
          type="button"
          onclick={toggle}
          aria-label="Collapse the sidebar"
          class={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        >
          <PanelLeft />
        </button>
      {/if}
    </div>

    <nav class="flex-1 space-y-0.5 px-2 py-2">
      {#each NAV as item (item.href)}
        {@const active = item.active(router.route)}
        {@const count = sessionCounts.current && item.count?.(sessionCounts.current)}
        <Tooltip.Root disabled={!collapsed}>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <a
                {...props}
                href={item.href}
                aria-current={active ? "page" : undefined}
                class={itemClass(active)}
              >
                <item.icon />
                {#if !collapsed}
                  {item.label}
                  {#if count}
                    <span class="text-muted-foreground ml-auto font-mono text-[11px] tabular-nums">
                      {count}
                    </span>
                  {/if}
                {/if}
              </a>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content side="right">{item.label}</Tooltip.Content>
        </Tooltip.Root>
      {/each}
    </nav>

    <div class={["flex items-center gap-1 border-t p-2", collapsed && "flex-col"]}>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger class={cn(itemClass(false), "h-10 min-w-0 flex-1")}>
          <span
            class="bg-primary/15 text-primary flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold"
          >
            {initials(auth.user?.email ?? "")}
          </span>
          {#if !collapsed}
            <span class="truncate">{auth.user?.email}</span>
            <ChevronsUpDown class="ml-auto opacity-60" />
          {/if}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content side="top" align="start" class="w-52">
          <DropdownMenu.Label class="text-muted-foreground truncate font-normal">
            {auth.user?.email}
          </DropdownMenu.Label>
          <DropdownMenu.Item onSelect={() => auth.signOut()}><LogOut /> Sign out</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <ThemeMenu />
    </div>
  </aside>

  <div class="flex min-w-0 flex-1 flex-col">
    <header class="shrink-0 border-b md:hidden">
      <div class="flex h-14 items-center justify-between px-4">
        <Logo />
        <div class="flex items-center gap-1">
          <UserMenu />
          <ThemeMenu />
        </div>
      </div>
      <nav class="flex gap-1 overflow-x-auto px-2 pb-2">
        {#each NAV as item (item.href)}
          {@const active = item.active(router.route)}
          <a
            href={item.href}
            aria-current={active ? "page" : undefined}
            class={[
              "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm [&_svg]:size-4",
              active ? "bg-accent font-medium" : "text-muted-foreground",
            ]}
          >
            <item.icon />{item.label}
          </a>
        {/each}
      </nav>
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto">{@render children()}</div>
  </div>
</div>
