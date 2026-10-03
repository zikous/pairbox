<script lang="ts">
  import { onMount } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { Link, Play, RotateCcw, Settings, Square } from "@lucide/svelte";
  import type { Pane } from "paneforge";
  import { mode } from "mode-watcher";
  import { toast } from "svelte-sonner";
  import {
    RUNTIMES,
    type JoinRequest,
    type RoomView,
    type RunStatus,
    type SandboxState,
  } from "@pairbox/shared";
  import type { RoomSession } from "$lib/api";
  import IconButton from "$lib/components/shared/IconButton.svelte";
  import RuntimeDot from "$lib/components/shared/RuntimeDot.svelte";
  import CopyButton from "$lib/components/shared/CopyButton.svelte";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import * as Resizable from "$lib/components/ui/resizable";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { modKey } from "$lib/platform";
  import { prefs } from "$lib/prefs.svelte";
  import { roomUrl } from "$lib/router.svelte";
  import Editor from "./Editor.svelte";
  import EndSessionButton from "./EndSessionButton.svelte";
  import JoinRequests from "./JoinRequests.svelte";
  import PaneDivider from "./PaneDivider.svelte";
  import PaneHeader from "./PaneHeader.svelte";
  import Participants, { type Person } from "./Participants.svelte";
  import PreferencesDialog from "./PreferencesDialog.svelte";
  import RoomFrame from "./RoomFrame.svelte";
  import SandboxOverlay from "./SandboxOverlay.svelte";
  import StatusBar from "./StatusBar.svelte";
  import Terminal from "./Terminal.svelte";
  import TimeLeft from "./TimeLeft.svelte";

  /** The live room: editor and terminal side by side, inside the room frame. */
  let { room, session }: { room: RoomView; session: RoomSession } = $props();
  const runtime = $derived(room.runtime);

  let requests = $state<JoinRequest[]>([]);
  let status = $state<RunStatus>({ state: "idle" });
  let sandbox = $state<SandboxState>({ state: "starting" });
  let people = $state<Person[]>([]);
  let cursor = $state({ line: 1, column: 1 });
  let preferencesOpen = $state(false);
  let terminal: Terminal;
  let terminalPane: Pane;
  let terminalOpen = $state(true);

  const narrow = new MediaQuery("max-width: 768px");
  const running = $derived(status.state === "running");
  const dark = $derived(mode.current === "dark");
  const inviteUrl = $derived(roomUrl(room.id));

  onMount(() => {
    const refreshPeople = () => {
      people = [...session.awareness.getStates()]
        .filter(([, state]) => state["user"])
        .map(([id, state]) => ({
          id,
          ...state["user"],
          me: id === session.awareness.clientID,
        }));
    };
    session.awareness.on("change", refreshPeople);
    refreshPeople();

    const unsubscribe = [
      session.onJoinRequests((next) => {
        const known = new Set(requests.map((r) => r.id));
        for (const request of next) {
          if (!known.has(request.id)) toast(`${request.participant.name} wants to join`);
        }
        requests = next;
      }),
      session.terminal.onStatus((next) => (status = next)),
      session.terminal.onSandbox((next) => (sandbox = next)),
    ];

    return () => {
      session.awareness.off("change", refreshPeople);
      unsubscribe.forEach((stop) => stop());
    };
  });

  // Keep our name and color in sync with what others see (and what recordings attribute).
  $effect(() => {
    session.awareness.setLocalStateField("user", {
      name: prefs.name,
      color: prefs.color,
      colorLight: `${prefs.color}33`,
    });
    session.introduce({ name: prefs.name, color: prefs.color });
  });

  function run() {
    if (running) return;
    terminalPane.expand();
    session.terminal.run();
    terminal.focus();
  }

  function toggleTerminal() {
    if (terminalPane.isCollapsed()) terminalPane.expand();
    else terminalPane.collapse();
  }

  // Mod+J toggles the terminal, like VS Code. Captured before the editor or terminal sees it.
  function onKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
      event.preventDefault();
      event.stopPropagation();
      toggleTerminal();
    }
  }
</script>

<svelte:head><title>{room.name} · pairbox</title></svelte:head>
<svelte:window onkeydowncapture={onKeydown} />

<RoomFrame {room}>
  {#snippet actions()}
    <TimeLeft endsAt={room.endsAt} />
    {#if room.owner}
      <JoinRequests roomId={room.id} {requests} />
      <EndSessionButton roomId={room.id} />
    {/if}
    <Tooltip.Root>
      <Tooltip.Trigger
        class="text-destructive flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
      >
        <span class="size-1.5 animate-pulse rounded-full bg-current"></span>Recording
      </Tooltip.Trigger>
      <Tooltip.Content class="max-w-60">
        This session is recorded (code, cursors and terminal) so the room's owner can replay it.
      </Tooltip.Content>
    </Tooltip.Root>
    <Participants {people} />
    <CopyButton text={inviteUrl} class={buttonVariants({ variant: "outline", size: "sm" })}>
      <Link /> Invite
    </CopyButton>
    <IconButton label="Preferences" onclick={() => (preferencesOpen = true)}>
      <Settings />
    </IconButton>
  {/snippet}

  <Resizable.PaneGroup
    direction={narrow.current ? "vertical" : "horizontal"}
    autoSaveId={narrow.current ? "pairbox-layout-vertical" : "pairbox-layout-horizontal"}
  >
    <Resizable.Pane defaultSize={58} minSize={25} class="flex flex-col">
      <PaneHeader>
        {#snippet tab()}
          <RuntimeDot {runtime} />{RUNTIMES[runtime].file}
        {/snippet}
        {#snippet actions()}
          <span class="text-muted-foreground px-2 font-mono text-xs">{RUNTIMES[runtime].label}</span
          >
        {/snippet}
      </PaneHeader>
      <div class="min-h-0 flex-1">
        <Editor
          doc={session.doc}
          awareness={session.awareness}
          {runtime}
          keymap={prefs.keymap}
          {dark}
          onrun={run}
          oncursor={(position) => (cursor = position)}
        />
      </div>
    </Resizable.Pane>

    <PaneDivider
      direction={narrow.current ? "vertical" : "horizontal"}
      collapsed={!terminalOpen}
      label={`${terminalOpen ? "Hide" : "Show"} terminal (${modKey}J)`}
      ontoggle={toggleTerminal}
    />

    <Resizable.Pane
      bind:this={terminalPane}
      defaultSize={42}
      minSize={20}
      collapsible
      collapsedSize={0}
      onResize={(size) => (terminalOpen = size > 0)}
      class="flex flex-col"
    >
      <PaneHeader>
        {#snippet tab()}
          <span class="text-primary">❯</span>terminal
        {/snippet}
        {#snippet actions()}
          <IconButton label="Reset sandbox" onclick={() => session.terminal.reset()}>
            <RotateCcw />
          </IconButton>
          {#if running}
            <Button variant="outline" size="sm" onclick={() => session.terminal.stop()}>
              <Square class="fill-current" /> Stop
            </Button>
          {:else}
            <Button size="sm" onclick={run} disabled={sandbox.state !== "ready"}>
              <Play class="fill-current" /> Run
              <span class="font-mono text-[10px] opacity-60">{modKey}↵</span>
            </Button>
          {/if}
        {/snippet}
      </PaneHeader>
      <div class="relative min-h-0 flex-1">
        <Terminal bind:this={terminal} session={session.terminal} {dark} />
        <SandboxOverlay {sandbox} {runtime} onreset={() => session.terminal.reset()} />
      </div>
    </Resizable.Pane>
  </Resizable.PaneGroup>

  {#snippet footer()}
    <StatusBar online={people.length} {cursor} keymap={prefs.keymap} {status} {sandbox} />
  {/snippet}
</RoomFrame>

<PreferencesDialog bind:open={preferencesOpen} />
