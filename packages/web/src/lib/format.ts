const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export const initials = (name: string): string =>
  name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** A duration in milliseconds as `m:ss` (or `h:mm:ss`). */
export function timecode(ms: number): string {
  const total = Math.floor(ms / 1000);
  const [h, m, s] = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60];
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export const dateTime = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const time = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

/** "Today, 14:00–15:00", "Tomorrow, 9:30–10:00" or "Tue 7 Oct, 14:00–15:00". */
export function slot(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const day = sameDay(start, today)
    ? "Today"
    : sameDay(start, tomorrow)
      ? "Tomorrow"
      : start.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${time(start)}–${time(new Date(endsAt))}`;
}

/** A wait or a remaining time: "2h 05m", "12m", "45s". */
export function span(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes >= 60)
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  if (minutes >= 1) return `${minutes}m`;
  return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}

/** "Today", "Yesterday", "Tomorrow" or "Mon 6 Oct", for headings of sessions by day. */
export function dayLabel(iso: string): string {
  const day = new Date(iso);
  const today = new Date();
  const offset = (days: number) => new Date(today.getTime() + days * 86_400_000);
  if (sameDay(day, today)) return "Today";
  if (sameDay(day, offset(-1))) return "Yesterday";
  if (sameDay(day, offset(1))) return "Tomorrow";
  return day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** Groups items by the day they start on, keeping their order. */
export function byDay<T extends { startsAt: string }>(items: T[]): { day: string; items: T[] }[] {
  const groups: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const day = dayLabel(item.startsAt);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

/** "14:00–15:00". */
export const hours = (startsAt: string, endsAt: string): string =>
  `${time(new Date(startsAt))}–${time(new Date(endsAt))}`;
