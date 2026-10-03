import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate } from "y-protocols/awareness";
import {
  Listeners,
  RUNTIMES,
  type Participant,
  type RecordingEvent,
  type RecordingReplay,
  type Runtime,
} from "@pairbox/shared";

/** One line of the activity list: something a person (or the program) did, and when. */
export interface Activity {
  t: number;
  text: string;
  by?: Participant;
}

const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/**
 * Plays a recorded session back: the document, everyone's cursors and the terminal, at any
 * moment. Moving forward applies the events in between; moving back rebuilds from the start.
 */
export class Replay {
  readonly duration: number;
  readonly activity: Activity[];
  /** Where the code was run, for marks on the timeline. */
  readonly runs: number[];

  /** Recreated when seeking backwards, so views bound to it must re-bind. */
  doc = $state.raw(new Y.Doc());
  awareness = $state.raw(new Awareness(this.doc));
  time = $state(0);
  runtime = $state<Runtime>("python");

  private readonly snapshot: Uint8Array;
  private readonly events: RecordingEvent[];
  private next = 0;
  private output = "";
  private readonly outputEvents = new Listeners<string>();

  constructor(
    replay: RecordingReplay,
    private readonly initialRuntime: Runtime,
  ) {
    this.snapshot = fromBase64(replay.snapshot);
    this.events = replay.events;
    const { startedAt, endedAt } = replay.recording;
    const end = endedAt ? Date.parse(endedAt) : Date.now();
    this.duration = Math.max(this.events.at(-1)?.t ?? 0, end - Date.parse(startedAt));
    this.activity = describe(this.events);
    this.runs = this.events.filter((e) => e.type === "run").map((e) => e.t);
    this.restart();
  }

  /** The terminal as seen at the current time; called again from scratch after a rewind. */
  onOutput(listener: (data: string) => void): () => void {
    if (this.output) listener(this.output);
    return this.outputEvents.add(listener);
  }

  seek(time: number): void {
    const target = Math.min(Math.max(time, 0), this.duration);
    if (target < this.time) this.restart();
    while (this.next < this.events.length && (this.events[this.next]?.t ?? Infinity) <= target) {
      this.apply(this.events[this.next++] as RecordingEvent);
    }
    this.time = target;
  }

  private restart(): void {
    this.awareness.destroy();
    this.doc.destroy();
    const doc = new Y.Doc();
    Y.applyUpdate(doc, this.snapshot);
    const awareness = new Awareness(doc);
    awareness.setLocalState(null); // the viewer has no cursor of their own
    // Awareness drops cursors not refreshed for 30s of real time; a replay controls time itself.
    clearInterval(
      (awareness as unknown as { _checkInterval: ReturnType<typeof setInterval> })._checkInterval,
    );
    this.doc = doc;
    this.awareness = awareness;
    this.next = 0;
    this.time = 0;
    this.runtime = this.initialRuntime;
    this.output = "";
    this.outputEvents.emit("\x1bc");
  }

  private apply(event: RecordingEvent): void {
    switch (event.type) {
      case "edit":
        return Y.applyUpdate(this.doc, fromBase64(event.update));
      case "presence":
        return applyAwarenessUpdate(this.awareness, fromBase64(event.update), "replay");
      case "output":
        this.output += event.data;
        return this.outputEvents.emit(event.data);
      case "runtime":
        this.runtime = event.runtime;
    }
  }
}

/** Turns raw events into a readable list: commands typed, runs, edits, who came and went. */
function describe(events: RecordingEvent[]): Activity[] {
  const activity: Activity[] = [];
  const typing: Record<string, string> = {}; // what each person has typed on the current line
  let editBurst: { by?: string; until: number } | undefined;

  for (const event of events) {
    switch (event.type) {
      case "join":
        activity.push({ t: event.t, by: event.by, text: "joined" });
        break;
      case "leave":
        activity.push({ t: event.t, by: event.by, text: "left" });
        break;
      case "run":
        activity.push({ t: event.t, by: event.by, text: "ran the code" });
        break;
      case "stop":
        activity.push({ t: event.t, by: event.by, text: "stopped the program" });
        break;
      case "reset":
        activity.push({ t: event.t, by: event.by, text: "reset the sandbox" });
        break;
      case "runtime":
        activity.push({
          t: event.t,
          by: event.by,
          text: `switched to ${RUNTIMES[event.runtime].label}`,
        });
        break;
      case "status":
        if (event.status.state === "exited") {
          activity.push({
            t: event.t,
            text: `Exited ${event.status.exitCode} · ${event.status.durationMs} ms`,
          });
        }
        break;
      case "input": {
        let [done, rest] = splitLine((typing[event.by.name] ?? "") + event.data);
        while (done !== undefined) {
          if (done.trim())
            activity.push({ t: event.t, by: event.by, text: `typed \`${done.trim()}\`` });
          [done, rest] = splitLine(rest);
        }
        typing[event.by.name] = rest;
        break;
      }
      case "edit": {
        // Keystrokes close together by the same person read as one edit, dated at its start.
        const author = event.by?.name;
        if (!editBurst || editBurst.by !== author || event.t - editBurst.until > 3_000) {
          activity.push({ t: event.t, by: event.by, text: "edited the code" });
        }
        editBurst = { by: author, until: event.t };
        break;
      }
    }
    if (event.type !== "edit" && event.type !== "presence") editBurst = undefined;
  }
  return activity.sort((a, b) => a.t - b.t);
}

/** Splits terminal keystrokes at Enter, applying backspaces. Returns the finished line, if any. */
function splitLine(keys: string): [string | undefined, string] {
  let line = "";
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i] as string;
    if (key === "\r") return [line, keys.slice(i + 1)];
    if (key === "\x7f") line = line.slice(0, -1);
    else if (key >= " ") line += key;
  }
  return [undefined, line];
}
