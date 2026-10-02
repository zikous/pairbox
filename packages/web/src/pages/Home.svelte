<script lang="ts">
  import { Lock, Plus } from "@lucide/svelte";
  import type { Room } from "@pairbox/domain";
  import { api } from "$lib/api";
  import Logo from "$lib/components/brand/Logo.svelte";
  import DeleteRoomDialog from "$lib/components/home/DeleteRoomDialog.svelte";
  import HostUnlock from "$lib/components/home/HostUnlock.svelte";
  import JoinForm from "$lib/components/home/JoinForm.svelte";
  import NewRoomDialog from "$lib/components/home/NewRoomDialog.svelte";
  import RoomList from "$lib/components/home/RoomList.svelte";
  import IconButton from "$lib/components/shared/IconButton.svelte";
  import ThemeMenu from "$lib/components/shared/ThemeMenu.svelte";
  import { Button } from "$lib/components/ui/button";
  import { prefs } from "$lib/prefs.svelte";

  let rooms = $state<Room[]>();
  let newRoomOpen = $state(false);
  let deleteOpen = $state(false);
  let roomToDelete = $state<Room>();

  // Load the host's rooms once host access is unlocked.
  $effect(() => {
    if (!prefs.hostSecret) return;
    api.rooms.list().then((list) => (rooms = list));
  });

  function askDelete(room: Room) {
    roomToDelete = room;
    deleteOpen = true;
  }
</script>

<svelte:head><title>pairbox</title></svelte:head>

<div class="relative min-h-full">
  <div
    class="dot-grid pointer-events-none absolute inset-x-0 top-0 h-80 [mask-image:linear-gradient(to_bottom,black,transparent)]"
  ></div>

  <header class="relative mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
    <Logo />
    <ThemeMenu />
  </header>

  <main class="relative mx-auto max-w-3xl px-4 pt-14 pb-20">
    <section>
      <h1 class="text-3xl font-semibold tracking-tight text-balance">
        Pair on code, <span class="text-primary">in one box.</span>
      </h1>
      <p class="text-muted-foreground mt-2 mb-6 max-w-lg">
        A shared editor and a live terminal. Paste an invite to jump in.
      </p>
      <JoinForm />
    </section>

    <section class="mt-16">
      <div class="mb-3 flex items-center justify-between gap-4">
        <h2 class="label-mono">
          Your rooms{prefs.hostSecret && rooms ? ` · ${rooms.length}` : ""}
        </h2>
        {#if prefs.hostSecret}
          <div class="flex items-center gap-1">
            <IconButton label="Lock host access" onclick={() => (prefs.hostSecret = "")}>
              <Lock />
            </IconButton>
            <Button size="sm" variant="outline" onclick={() => (newRoomOpen = true)}>
              <Plus /> New room
            </Button>
          </div>
        {/if}
      </div>

      {#if prefs.hostSecret}
        <RoomList {rooms} oncreate={() => (newRoomOpen = true)} ondelete={askDelete} />
      {:else}
        <HostUnlock />
      {/if}
    </section>
  </main>
</div>

<NewRoomDialog bind:open={newRoomOpen} />
<DeleteRoomDialog
  bind:open={deleteOpen}
  room={roomToDelete}
  ondeleted={(deleted) => (rooms = rooms?.filter((room) => room.id !== deleted.id))}
/>
