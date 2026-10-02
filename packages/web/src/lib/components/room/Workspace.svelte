<script lang="ts">
  import { onMount } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { Link, Play, RotateCcw, Settings, Square } from "@lucide/svelte";
  import type { Pane } from "paneforge";
  import { mode } from "mode-watcher";
  import { toast } from "svelte-sonner";
  import { LANGUAGES, isLanguage, type Language, type Room, type RunStatus } from "@pairbox/shared";
  import type { RoomSession } from "$lib/api";
  import IconButton from "$lib/components/shared/IconButton.svelte";
  import LanguageDot from "$lib/components/shared/LanguageDot.svelte";
  import CopyButton from "$lib/components/shared/CopyButton.svelte";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import * as Resizable from "$lib/components/ui/resizable";
  import * as Select from "$lib/components/ui/select";
  import { modKey } from "$lib/platform";
  import { prefs } from "$lib/prefs.svelte";
  import { roomUrl, router } from "$lib/router.svelte";
  import Editor from "./Editor.svelte";
  import PaneDivider from "./PaneDivider.svelte";
  import PaneHeader from "./PaneHeader.svelte";
  import Participants, { type Person } from "./Participants.svelte";
  import PreferencesDialog from "./PreferencesDialog.svelte";
  import RoomFrame from "./RoomFrame.svelte";
  import StatusBar from "./StatusBar.svelte";
  import Terminal from "./Terminal.svelte";

  /** The live room: editor and terminal side by side, inside the room frame. */
  let { room, session }: { room: Room; session: RoomSession } = $props();

  let language = $state<Language>("python");
  let status = $state<RunStatus>({ state: "idle" });
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

    language = session.language();
    const stopLanguage = session.onLanguage((next) => (language = next));
    const stopStatus = session.terminal.onStatus((next) => (status = next));
    const stopDeleted = session.onDeleted(() => {
      toast.error("The host deleted this room");
      router.navigate("/");
    });

    return () => {
      session.awareness.off("change", refreshPeople);
      stopLanguage();
      stopStatus();
      stopDeleted();
    };
  });

  // Keep our name and color in sync with what others see.
  $effect(() => {
    session.awareness.setLocalStateField("user", {
      name: prefs.name,
      color: prefs.color,
      colorLight: `${prefs.color}33`,
    });
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

  function changeLanguage(value: string) {
    if (isLanguage(value)) session.setLanguage(value);
  }
</script>

<svelte:head><title>{room.name} · pairbox</title></svelte:head>
<svelte:window onkeydowncapture={onKeydown} />

<RoomFrame {room}>
  {#snippet actions()}
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
          <LanguageDot {language} />{LANGUAGES[language].file}
        {/snippet}
        {#snippet actions()}
          <Select.Root type="single" value={language} onValueChange={changeLanguage}>
            <Select.Trigger
              size="sm"
              class="h-7 border-0 bg-transparent font-mono text-xs shadow-none dark:bg-transparent"
              aria-label="Language"
            >
              {LANGUAGES[language].label}
            </Select.Trigger>
            <Select.Content align="end">
              {#each Object.entries(LANGUAGES) as [id, { label }] (id)}
                <Select.Item value={id} {label} />
              {/each}
            </Select.Content>
          </Select.Root>
        {/snippet}
      </PaneHeader>
      <div class="min-h-0 flex-1">
        <Editor
          doc={session.doc}
          awareness={session.awareness}
          {language}
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
            <Button size="sm" onclick={run}>
              <Play class="fill-current" /> Run
              <span class="font-mono text-[10px] opacity-60">{modKey}↵</span>
            </Button>
          {/if}
        {/snippet}
      </PaneHeader>
      <div class="min-h-0 flex-1">
        <Terminal bind:this={terminal} session={session.terminal} {dark} />
      </div>
    </Resizable.Pane>
  </Resizable.PaneGroup>

  {#snippet footer()}
    <StatusBar online={people.length} {cursor} keymap={prefs.keymap} {status} />
  {/snippet}
</RoomFrame>

<PreferencesDialog bind:open={preferencesOpen} />
