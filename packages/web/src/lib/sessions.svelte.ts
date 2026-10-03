import { toast } from "svelte-sonner";
import type { RoomPage } from "@pairbox/shared";
import { api } from "$lib/api";
import { daysFromNow, errorMessage } from "$lib/format";

export type ListTab = "upcoming" | "past";

/** Periods to look at in each tab: forward for what's coming, back for what's done. */
export const PERIODS: Record<ListTab, { id: string; label: string; days?: number }[]> = {
  upcoming: [
    { id: "7", label: "Next 7 days", days: 7 },
    { id: "30", label: "Next 30 days", days: 30 },
    { id: "all", label: "Any time" },
  ],
  past: [
    { id: "7", label: "Last 7 days", days: 7 },
    { id: "30", label: "Last 30 days", days: 30 },
    { id: "90", label: "Last 3 months", days: 90 },
    { id: "all", label: "All time" },
  ],
};

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 250;

/**
 * Your upcoming or past sessions, a page at a time. Changing a filter goes back to the first
 * page; typing in the search waits for a pause before asking the server.
 */
export class SessionList {
  readonly tab: ListTab;
  search = $state("");
  period = $state("all");
  page = $state(1);

  /** The page on screen. Kept while the next one loads, so the table doesn't jump. */
  result = $state.raw<RoomPage>();
  loading = $state(false);
  readonly pageSize = PAGE_SIZE;

  private query = $state("");
  private version = $state(0);

  constructor(tab: ListTab) {
    this.tab = tab;
    if (tab === "past") this.period = "30"; // recent history first
    // Search once typing pauses.
    $effect(() => {
      const search = this.search.trim();
      const timer = setTimeout(() => {
        if (search !== this.query) [this.query, this.page] = [search, 1];
      }, SEARCH_DELAY_MS);
      return () => clearTimeout(timer);
    });

    $effect(() => {
      void this.version;
      const request = {
        tab: this.tab,
        q: this.query,
        ...this.bounds(),
        page: this.page,
        pageSize: PAGE_SIZE,
      };
      let current = true;
      this.loading = true;
      api.rooms.list(request).then(
        (result) => current && ((this.result = result), (this.loading = false)),
        (error) => {
          if (!current) return;
          this.loading = false;
          toast.error("Couldn't load your sessions", { description: errorMessage(error) });
        },
      );
      return () => (current = false);
    });
  }

  get filtered(): boolean {
    return !!this.query || this.periodDays !== undefined;
  }

  setPeriod(period: string): void {
    [this.period, this.page] = [period, 1];
  }

  clearFilters(): void {
    [this.search, this.query, this.period, this.page] = ["", "", "all", 1];
  }

  /** Fetches the current page again, after something changed on the server. */
  reload(): void {
    this.version++;
  }

  private get periodDays(): number | undefined {
    return PERIODS[this.tab].find((p) => p.id === this.period)?.days;
  }

  private bounds(): { from?: string; to?: string } {
    const days = this.periodDays;
    if (days === undefined) return {};
    const edge = daysFromNow(this.tab === "past" ? -days : days);
    return this.tab === "past" ? { from: edge } : { to: edge };
  }
}
