/** Flatten PostgREST `check_in_tags` rows with nested `tags(label)` into sorted label lists per check-in. */
export function tagsByCheckInFromRows(
  rows: {
    check_in_id: string;
    tags: { label: string } | { label: string }[] | null;
  }[]
): Record<string, string[]> {
  const acc: Record<string, Set<string>> = {};
  for (const row of rows) {
    const t = row.tags;
    const label = Array.isArray(t) ? t[0]?.label : t?.label;
    if (!label) continue;
    if (!acc[row.check_in_id]) acc[row.check_in_id] = new Set();
    acc[row.check_in_id].add(label);
  }
  const out: Record<string, string[]> = {};
  for (const [id, set] of Object.entries(acc)) {
    out[id] = [...set].sort((a, b) => a.localeCompare(b));
  }
  return out;
}
