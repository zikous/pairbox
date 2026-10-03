<script lang="ts">
  import { toast } from "svelte-sonner";
  import {
    RUNTIMES,
    SESSION_DURATIONS,
    isRuntime,
    normalizeRoomName,
    type Availability,
    type Room,
    type Runtime,
  } from "@pairbox/shared";
  import { api, HttpError } from "$lib/api";
  import RuntimeDot from "$lib/components/shared/RuntimeDot.svelte";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Field from "$lib/components/ui/field";
  import { Input } from "$lib/components/ui/input";
  import { Spinner } from "$lib/components/ui/spinner";
  import * as ToggleGroup from "$lib/components/ui/toggle-group";
  import { errorMessage } from "$lib/format";

  /** Books a session: a name, a runtime, a length, and a free half hour to start in. */
  let { open = $bindable(), onbooked }: { open: boolean; onbooked: (room: Room) => void } =
    $props();

  const SLOT_MS = 30 * 60_000;
  const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local time

  let name = $state("");
  let runtime = $state<Runtime>("python");
  let duration = $state<number>(60);
  let date = $state(today());
  /** "now", or the ISO start of a half-hour slot. */
  let start = $state<string>();
  let availability = $state<Availability>();
  /** Bumped to fetch the free times again. */
  let refresh = $state(0);
  let booking = $state(false);
  const validName = $derived(normalizeRoomName(name));

  // A fresh form every time it opens.
  $effect(() => {
    if (!open) return;
    name = "";
    runtime = "python";
    duration = 60;
    date = today();
    start = undefined;
  });

  // Free slots for the chosen runtime, day and length.
  $effect(() => {
    if (!open) return;
    void refresh;
    const from = new Date(`${date}T00:00`);
    const query = [runtime, from, duration] as const;
    availability = undefined;
    api.rooms.availability(...query).then(
      (result) => (availability = result),
      (error) => toast.error("Couldn't load free times", { description: errorMessage(error) }),
    );
  });

  const slots = $derived.by(() => {
    const now = Date.now();
    const all = availability?.slots ?? [];
    // The half hour already under way is offered as "Now".
    const current = all.find(
      (s) => Date.parse(s.startsAt) <= now && now < Date.parse(s.startsAt) + SLOT_MS,
    );
    return {
      now: current?.free ?? false,
      later: all.filter((s) => Date.parse(s.startsAt) > now),
    };
  });

  const timeOf = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!validName || !start) return;
    booking = true;
    try {
      const startsAt = start === "now" ? new Date().toISOString() : start;
      const room = await api.rooms.create({
        name: validName,
        runtime,
        startsAt,
        durationMinutes: duration as (typeof SESSION_DURATIONS)[number],
      });
      open = false;
      onbooked(room);
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        toast.error("That time was just taken", { description: "Pick another one." });
        start = undefined;
        refresh++;
      } else {
        toast.error("Couldn't book the session", { description: errorMessage(error) });
      }
    } finally {
      booking = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-lg">
    <Dialog.Header>
      <Dialog.Title>Schedule a session</Dialog.Title>
      <Dialog.Description>
        A sandbox is reserved for the whole slot. Guests ask to join and you let them in.
      </Dialog.Description>
    </Dialog.Header>

    <form onsubmit={submit}>
      <Field.Group>
        <Field.Field>
          <Field.Label for="session-name">Name</Field.Label>
          <Input
            id="session-name"
            bind:value={name}
            placeholder="Frontend interview · Ada"
            maxlength={60}
          />
        </Field.Field>

        <Field.Field>
          <Field.Label>Runtime</Field.Label>
          <ToggleGroup.Root
            type="single"
            variant="outline"
            class="w-full"
            value={runtime}
            onValueChange={(value) => {
              if (value && isRuntime(value)) runtime = value;
            }}
          >
            {#each Object.entries(RUNTIMES) as [id, { label }] (id)}
              <ToggleGroup.Item value={id} class="flex-1 gap-2">
                {#if isRuntime(id)}<RuntimeDot runtime={id} />{/if}{label}
              </ToggleGroup.Item>
            {/each}
          </ToggleGroup.Root>
        </Field.Field>

        <div class="grid grid-cols-[1fr_auto] gap-4">
          <Field.Field>
            <Field.Label for="session-date">Day</Field.Label>
            <Input id="session-date" type="date" min={today()} bind:value={date} />
          </Field.Field>
          <Field.Field>
            <Field.Label>Length</Field.Label>
            <ToggleGroup.Root
              type="single"
              variant="outline"
              value={String(duration)}
              onValueChange={(value) => value && (duration = Number(value))}
            >
              {#each SESSION_DURATIONS as minutes (minutes)}
                <ToggleGroup.Item value={String(minutes)} class="px-2.5 font-mono text-xs">
                  {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                </ToggleGroup.Item>
              {/each}
            </ToggleGroup.Root>
          </Field.Field>
        </div>

        <Field.Field>
          <Field.Label>Start</Field.Label>
          {#if !availability}
            <div class="text-muted-foreground flex items-center gap-2 py-6 text-sm">
              <Spinner /> Finding free times…
            </div>
          {:else}
            <div class="grid max-h-44 grid-cols-4 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-6">
              {#if date === today()}
                <button
                  type="button"
                  class={buttonVariants({
                    variant: start === "now" ? "default" : "outline",
                    size: "sm",
                  })}
                  disabled={!slots.now}
                  onclick={() => (start = "now")}
                >
                  Now
                </button>
              {/if}
              {#each slots.later as slot (slot.startsAt)}
                <button
                  type="button"
                  class={[
                    buttonVariants({
                      variant: start === slot.startsAt ? "default" : "outline",
                      size: "sm",
                    }),
                    "font-mono",
                  ]}
                  disabled={!slot.free}
                  title={slot.free ? undefined : "No sandbox free for this slot"}
                  onclick={() => (start = slot.startsAt)}
                >
                  {timeOf(slot.startsAt)}
                </button>
              {/each}
            </div>
            <Field.Description
              >Greyed-out times have no sandbox free for the whole length.</Field.Description
            >
          {/if}
        </Field.Field>
      </Field.Group>

      <Dialog.Footer class="mt-6">
        <Dialog.Close class={buttonVariants({ variant: "outline" })} disabled={booking}
          >Cancel</Dialog.Close
        >
        <Button type="submit" disabled={!validName || !start || booking}>
          {#if booking}<Spinner /> Booking…{:else}Book session{/if}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
