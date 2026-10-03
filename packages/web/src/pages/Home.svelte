<script lang="ts">
  import { Plus } from "@lucide/svelte";
  import type { Room } from "@pairbox/shared";
  import { toast } from "svelte-sonner";
  import { api } from "$lib/api";
  import DeleteRoomDialog from "$lib/components/home/DeleteRoomDialog.svelte";
  import JoinForm from "$lib/components/home/JoinForm.svelte";
  import NewRoomDialog from "$lib/components/home/NewRoomDialog.svelte";
  import RoomList from "$lib/components/home/RoomList.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import { Button } from "$lib/components/ui/button";
  import { errorMessage } from "$lib/format";
  import { auth } from "$lib/auth.svelte";

  let rooms = $state<Room[]>();
  let newRoomOpen = $state(false);
  let deleteOpen = $state(false);
  let roomToDelete = $state<Room>();

  // Load your rooms once we know you're signed in.
  $effect(() => {
    rooms = undefined;
    if (!auth.user) return;
    api.rooms.list().then(
      (list) => (rooms = list),
      (error) => toast.error("Couldn't load your rooms", { description: errorMessage(error) }),
    );
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

  <PageHeader />

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
          Your rooms{auth.user && rooms ? ` · ${rooms.length}` : ""}
        </h2>
        {#if auth.user}
          <Button size="sm" variant="outline" onclick={() => (newRoomOpen = true)}>
            <Plus /> New room
          </Button>
        {/if}
      </div>

      {#if auth.user}
        <RoomList {rooms} oncreate={() => (newRoomOpen = true)} ondelete={askDelete} />
      {:else if auth.user === null}
        <div
          class="bg-card flex flex-wrap items-center justify-between gap-4 rounded-lg border p-5"
        >
          <div>
            <p class="font-medium">Host your own rooms</p>
            <p class="text-muted-foreground text-sm">Sign in to create rooms and invite people.</p>
          </div>
          <div class="flex gap-2">
            <Button href="/signin" variant="outline" size="sm">Sign in</Button>
            <Button href="/signup" size="sm">Create account</Button>
          </div>
        </div>
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
