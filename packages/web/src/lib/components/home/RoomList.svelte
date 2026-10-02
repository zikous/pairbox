<script lang="ts">
  import { ArrowRight, Ellipsis, ExternalLink, Link, Plus, Trash2 } from "@lucide/svelte";
  import { LANGUAGES, type Room } from "@pairbox/domain";
  import { copyLink } from "$lib/clipboard";
  import LogoMark from "$lib/components/brand/LogoMark.svelte";
  import LanguageDot from "$lib/components/shared/LanguageDot.svelte";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { timeAgo } from "$lib/format";
  import { roomPath, roomUrl, router } from "$lib/router.svelte";

  interface Props {
    /** `undefined` while loading. */
    rooms: Room[] | undefined;
    oncreate: () => void;
    ondelete: (room: Room) => void;
  }

  let { rooms, oncreate, ondelete }: Props = $props();

  const COLUMNS = "sm:grid-cols-[1fr_7rem_7rem_8rem_2rem]";
</script>

{#if !rooms}
  <div class="bg-card divide-y rounded-lg border" aria-busy="true">
    {#each [0, 1, 2] as i (i)}
      <div class="flex items-center gap-4 px-4 py-3.5">
        <Skeleton class="h-4 w-48" />
        <Skeleton class="ml-auto h-3 w-16" />
        <Skeleton class="h-3 w-20" />
      </div>
    {/each}
  </div>
{:else if rooms.length === 0}
  <div
    class="bg-card flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center"
  >
    <LogoMark class="text-muted-foreground size-8" />
    <div>
      <p class="font-medium">No rooms yet</p>
      <p class="text-muted-foreground mt-1 text-sm">
        Create one, then send the link to whoever you're pairing with.
      </p>
    </div>
    <Button size="sm" class="mt-2" onclick={oncreate}><Plus /> New room</Button>
  </div>
{:else}
  <div class="bg-card overflow-hidden rounded-lg border">
    <div
      class="label-mono bg-muted/40 hidden items-center gap-4 border-b px-4 py-2 sm:grid {COLUMNS}"
    >
      <span>Name</span><span>File</span><span>Code</span><span>Created</span><span></span>
    </div>
    <ul class="divide-y">
      {#each rooms as room (room.id)}
        <li
          class="group hover:bg-muted/40 relative grid grid-cols-[1fr_2rem] items-center gap-4 px-4 py-3 transition-colors {COLUMNS}"
        >
          <!-- An overlay inside the link makes the whole row clickable. -->
          <a href={roomPath(room.id)} class="flex min-w-0 items-center gap-2 text-sm font-medium">
            <span class="absolute inset-0" aria-hidden="true"></span>
            <span class="truncate">{room.name}</span>
            <ArrowRight
              class="text-muted-foreground size-3.5 shrink-0 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100"
            />
          </a>
          <span class="text-muted-foreground hidden items-center gap-2 font-mono text-xs sm:flex">
            <LanguageDot language={room.language} />{LANGUAGES[room.language].file}
          </span>
          <span class="text-muted-foreground hidden font-mono text-xs sm:block">{room.id}</span>
          <span class="text-muted-foreground hidden text-xs sm:block"
            >{timeAgo(room.createdAt)}</span
          >

          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              class={buttonVariants({
                variant: "ghost",
                size: "icon-sm",
                class: "relative",
              })}
              aria-label="Actions for {room.name}"
            >
              <Ellipsis />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-40">
              <DropdownMenu.Item onSelect={() => router.navigate(roomPath(room.id))}>
                <ExternalLink /> Open
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => copyLink(roomUrl(room.id))}>
                <Link /> Copy link
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item variant="destructive" onSelect={() => ondelete(room)}>
                <Trash2 /> Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </li>
      {/each}
    </ul>
  </div>
{/if}
