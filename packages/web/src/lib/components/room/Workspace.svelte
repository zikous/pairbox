<script lang="ts">
  import { onMount } from "svelte";
  import { Link, Play, RotateCcw, Settings, Square } from "@lucide/svelte";
  import { mode } from "mode-watcher";
  import { LANGUAGES, isLanguage, type Language, type Room, type RunStatus } from "@pairbox/domain";
  import type { RoomSession } from "$lib/api";
  import { copyLink } from "$lib/clipboard";
  import LogoMark from "$lib/components/brand/LogoMark.svelte";
  import IconButton from "$lib/components/shared/IconButton.svelte";
  import LanguageDot from "$lib/components/shared/LanguageDot.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Resizable from "$lib/components/ui/resizable";
  import * as Select from "$lib/components/ui/select";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { modKey } from "$lib/platform";
  import { prefs } from "$lib/prefs.svelte";
  import { roomUrl } from "$lib/router.svelte";
  import Editor from "./Editor.svelte";
  import PaneHeader from "./PaneHeader.svelte";
  import Participants, { type Person } from "./Participants.svelte";
  import PreferencesDialog from "./PreferencesDialog.svelte";
  import StatusBar from "./StatusBar.svelte";
  import Terminal from "./Terminal.svelte";

  /** The room screen: header, editor and terminal side by side, and a status bar. */
  let { room, session }: { room: Room; session: RoomSession } = $props();

  let language = $state<Language>("python");
  let status = $state<RunStatus>({ state: "idle" });
  let people = $state<Person[]>([]);
  let cursor = $state({ line: 1, column: 1 });
  let preferencesOpen = $state(false);
  let narrow = $state(false);
  let terminal: Terminal;

  const running = $derived(status.state === "running");
  const dark = $derived(mode.current === "dark");
  const inviteUrl = $derived(roomUrl(room.id));

  onMount(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const onMedia = () => (narrow = media.matches);
    onMedia();
    media.addEventListener("change", onMedia);

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

    return () => {
      media.removeEventListener("change", onMedia);
      session.awareness.off("change", refreshPeople);
      stopLanguage();
      stopStatus();
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
    session.terminal.run();
    terminal.focus();
  }

  function changeLanguage(value: string) {
    if (isLanguage(value)) session.setLanguage(value);
  }
</script>

<svelte:head><title>{room.name} · pairbox</title></svelte:head>

<div class="flex h-full flex-col">
  <header class="flex h-11 shrink-0 items-center gap-2.5 border-b px-3">
    <a href="/" aria-label="All rooms" class="hover:opacity-80"><LogoMark /></a>
    <span class="text-muted-foreground/60">/</span>
    <h1 class="truncate text-sm font-medium">{room.name}</h1>
    <Tooltip.Root>
      <Tooltip.Trigger
        class="text-muted-foreground hover:text-foreground hover:border-ring hidden rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors md:block"
        onclick={() => copyLink(inviteUrl)}
      >
        {room.id}
      </Tooltip.Trigger>
      <Tooltip.Content>Copy invite link</Tooltip.Content>
    </Tooltip.Root>

    <div class="ml-auto flex items-center gap-2">
      <Participants {people} />
      <Button variant="outline" size="sm" onclick={() => copyLink(inviteUrl)}>
        <Link /> Invite
      </Button>
      <IconButton label="Preferences" onclick={() => (preferencesOpen = true)}>
        <Settings />
      </IconButton>
    </div>
  </header>

  <main class="min-h-0 flex-1">
    <Resizable.PaneGroup direction={narrow ? "vertical" : "horizontal"}>
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

      <Resizable.Handle />

      <Resizable.Pane defaultSize={42} minSize={20} class="flex flex-col">
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
  </main>

  <StatusBar online={people.length} {cursor} keymap={prefs.keymap} {status} />
</div>

<PreferencesDialog bind:open={preferencesOpen} />
