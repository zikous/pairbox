import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { isLanguage, type Language, type Participant, type Room } from "@pairbox/domain";
import type { RoomSession } from "../types";
import { docKey, updateRoomLanguage } from "./rooms";
import { fromBase64, load, save, toBase64 } from "./storage";
import { createFakeTerminal } from "./terminal";

type Message =
  | { type: "update"; update: Uint8Array }
  | { type: "sync"; stateVector: Uint8Array }
  | { type: "awareness"; update: Uint8Array };

const remote = Symbol("remote");

/**
 * Plays the server's collaboration channel with a BroadcastChannel, so tabs in
 * the same browser really edit together. The terminal is simulated per tab.
 */
export async function joinFakeRoom(room: Room, me: Participant): Promise<RoomSession> {
  const doc = new Y.Doc();
  const stored = load<string | null>(docKey(room.id), null);
  if (stored) Y.applyUpdate(doc, fromBase64(stored), remote);

  const awareness = new Awareness(doc);
  awareness.setLocalStateField("user", {
    name: me.name,
    color: me.color,
    colorLight: `${me.color}33`,
  });

  const channel = new BroadcastChannel(`pairbox:room:${room.id}`);
  const send = (message: Message) => channel.postMessage(message);

  channel.onmessage = ({ data }: MessageEvent<Message>) => {
    if (data.type === "update") Y.applyUpdate(doc, data.update, remote);
    if (data.type === "awareness") applyAwarenessUpdate(awareness, data.update, remote);
    if (data.type === "sync") {
      send({
        type: "update",
        update: Y.encodeStateAsUpdate(doc, data.stateVector),
      });
      send({
        type: "awareness",
        update: encodeAwarenessUpdate(awareness, [awareness.clientID]),
      });
    }
  };

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin !== remote) send({ type: "update", update });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(docKey(room.id), toBase64(Y.encodeStateAsUpdate(doc))), 300);
  });

  awareness.on(
    "update",
    (
      { added, updated, removed }: Record<"added" | "updated" | "removed", number[]>,
      origin: unknown,
    ) => {
      if (origin === remote) return;
      const changed = [...added, ...updated, ...removed];
      send({
        type: "awareness",
        update: encodeAwarenessUpdate(awareness, changed),
      });
    },
  );

  send({ type: "sync", stateVector: Y.encodeStateVector(doc) });
  // Give other tabs a moment to answer, like waiting for the server's first sync.
  await new Promise((resolve) => setTimeout(resolve, 350));

  const meta = doc.getMap<string>("room");
  const language = (): Language => {
    const value = meta.get("language");
    return value && isLanguage(value) ? value : room.language;
  };

  const terminal = createFakeTerminal({
    code: () => doc.getText("code").toString(),
    language,
  });

  const leave = () => {
    clearTimeout(saveTimer);
    save(docKey(room.id), toBase64(Y.encodeStateAsUpdate(doc)));
    removeAwarenessStates(awareness, [awareness.clientID], "leave");
    channel.close();
    terminal.dispose();
    awareness.destroy();
    doc.destroy();
    window.removeEventListener("pagehide", leave);
  };
  window.addEventListener("pagehide", leave);

  return {
    doc,
    awareness,
    terminal,
    language,
    onLanguage(listener) {
      const observer = () => listener(language());
      meta.observe(observer);
      return () => meta.unobserve(observer);
    },
    setLanguage(next) {
      meta.set("language", next);
      updateRoomLanguage(room.id, next);
    },
    leave,
  };
}
