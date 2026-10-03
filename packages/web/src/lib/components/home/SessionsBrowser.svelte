<script lang="ts">
  import type { Snippet } from "svelte";
  import { SearchX } from "@lucide/svelte";
  import type { Room } from "@pairbox/shared";
  import * as Empty from "$lib/components/ui/empty";
  import type { SessionList } from "$lib/sessions.svelte";
  import Pager from "./Pager.svelte";
  import SessionsTable from "./SessionsTable.svelte";
  import SessionsToolbar from "./SessionsToolbar.svelte";

  /** A searchable, paged table of sessions. `empty` is shown when there are none at all. */
  interface Props {
    list: SessionList;
    ondelete: (room: Room) => void;
    /** Past sessions only: opens your notes on one. */
    onnotes?: (room: Room) => void;
    empty: Snippet;
  }

  let { list, ondelete, onnotes, empty }: Props = $props();
</script>

<div class="space-y-4">
  <SessionsToolbar {list} />

  {#if list.result?.total === 0 && !list.loading}
    <Empty.Root class="bg-card border border-dashed">
      <Empty.Header>
        {#if list.filtered}
          <Empty.Media variant="icon"><SearchX /></Empty.Media>
          <Empty.Title>No sessions match</Empty.Title>
          <Empty.Description>Try another search or period.</Empty.Description>
        {:else}
          {@render empty()}
        {/if}
      </Empty.Header>
    </Empty.Root>
  {:else}
    <SessionsTable
      tab={list.tab}
      rooms={list.result?.items}
      stale={list.loading && !!list.result}
      {ondelete}
      {onnotes}
    />
    {#if list.result}
      <Pager
        page={list.page}
        pageSize={list.pageSize}
        total={list.result.total}
        onpage={(page) => (list.page = page)}
      />
    {/if}
  {/if}
</div>
