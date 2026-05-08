// Pure helpers for managing local "cheers" reaction state in the activity feed.
// Kept separate from ActivityFeed.tsx so the toggle math is unit-testable
// without spinning up a browser.

export type CheersState = { count: number; mine: boolean };

export type CheersMap = Record<string, CheersState>;

export type CheerRow = { check_in_id: string; user_id: string };

export function emptyCheers(checkInIds: readonly string[]): CheersMap {
  const out: CheersMap = {};
  for (const id of checkInIds) out[id] = { count: 0, mine: false };
  return out;
}

export function aggregateCheers(
  checkInIds: readonly string[],
  rows: readonly CheerRow[],
  currentUserId: string | null
): CheersMap {
  const out = emptyCheers(checkInIds);
  for (const row of rows) {
    const entry = out[row.check_in_id];
    if (!entry) continue;
    entry.count += 1;
    if (currentUserId && row.user_id === currentUserId) entry.mine = true;
  }
  return out;
}

// Optimistic toggle for the local user. Returns the same reference if the
// state already matches (so React can bail out of re-render).
export function toggleMyCheer(prev: CheersMap, checkInId: string, nextCheered: boolean): CheersMap {
  const cur = prev[checkInId] ?? { count: 0, mine: false };
  if (cur.mine === nextCheered) return prev;
  return {
    ...prev,
    [checkInId]: {
      mine: nextCheered,
      count: Math.max(0, cur.count + (nextCheered ? 1 : -1)),
    },
  };
}

// Apply a realtime cheer event from another user. Self-events are ignored
// because the local user's optimistic toggle already accounted for them.
export function applyRemoteCheer(
  prev: CheersMap,
  event: { type: "INSERT" | "DELETE"; checkInId: string; userId: string },
  currentUserId: string | null,
  visibleIds: ReadonlySet<string>
): CheersMap {
  if (!visibleIds.has(event.checkInId)) return prev;
  if (currentUserId && event.userId === currentUserId) return prev;
  const cur = prev[event.checkInId] ?? { count: 0, mine: false };
  const delta = event.type === "INSERT" ? 1 : -1;
  return {
    ...prev,
    [event.checkInId]: { ...cur, count: Math.max(0, cur.count + delta) },
  };
}
