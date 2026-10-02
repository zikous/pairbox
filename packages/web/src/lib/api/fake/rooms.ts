import * as Y from "yjs";
import type { Language, Room, RoomId } from "@pairbox/domain";
import type { RoomsApi } from "../types";
import { load, remove, save, toBase64 } from "./storage";

const ROOMS_KEY = "pairbox.fake.rooms";
export const docKey = (id: RoomId) => `pairbox.fake.doc.${id}`;

const STARTER_CODE: Record<Language, string> = {
  python: 'name = "pairbox"\nprint(f"Hello from {name}!")\nprint("Edit me, then press Run.")\n',
  javascript:
    'const name = "pairbox";\nconsole.log(`Hello from ${name}!`);\nconsole.log("Edit me, then press Run.");\n',
};

const delay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

function newId(): RoomId {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function seedDocument(id: RoomId, language: Language): void {
  const doc = new Y.Doc();
  doc.getText("code").insert(0, STARTER_CODE[language]);
  doc.getMap("room").set("language", language);
  save(docKey(id), toBase64(Y.encodeStateAsUpdate(doc)));
}

export function updateRoomLanguage(id: RoomId, language: Language): void {
  const rooms = load<Room[]>(ROOMS_KEY, []);
  save(
    ROOMS_KEY,
    rooms.map((room) => (room.id === id ? { ...room, language } : room)),
  );
}

/** Any non-empty secret unlocks the fake. */
export function createFakeRooms(): RoomsApi {
  return {
    async unlock(secret) {
      await delay();
      return secret.trim().length > 0;
    },

    async list() {
      await delay();
      return load<Room[]>(ROOMS_KEY, []).toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async get(id) {
      await delay(50);
      return load<Room[]>(ROOMS_KEY, []).find((room) => room.id === id) ?? null;
    },

    async create({ name, language }) {
      await delay();
      const room: Room = {
        id: newId(),
        name,
        language,
        createdAt: new Date().toISOString(),
      };
      seedDocument(room.id, language);
      save(ROOMS_KEY, [...load<Room[]>(ROOMS_KEY, []), room]);
      return room;
    },

    async remove(id) {
      await delay();
      save(
        ROOMS_KEY,
        load<Room[]>(ROOMS_KEY, []).filter((room) => room.id !== id),
      );
      remove(docKey(id));
    },
  };
}
