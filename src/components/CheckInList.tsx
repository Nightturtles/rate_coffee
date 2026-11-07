import Link from "next/link";
import type { CheckInRow } from "@/lib/checkins";
import { RatingCups } from "./RatingCups";
import { Chip } from "./ui/Chip";

/** `context` hides the part of the subject line that the surrounding page already states. */
export function CheckInList({ rows, context, emptyText = "No check-ins yet." }: { rows: CheckInRow[]; context?: "roaster" | "cafe" | "me"; emptyText?: string }) {
  if (rows.length === 0) return <p className="mt-2 text-sm text-muted">{emptyText}</p>;
  return (
    <ul className="mt-3 divide-y divide-border rounded-[var(--radius-card)] border border-border bg-surface">
      {rows.map((c) => {
        const who = c.profile?.display_name || "Someone";
        const subject = [
          c.coffees?.name,
          c.roasters && context !== "roaster" ? <Link key="r" href={`/roasters/${c.roasters.slug}`} className="underline-offset-4 hover:underline">{c.roasters.name}</Link> : null,
          c.cafes && context !== "cafe" ? <span key="c">at <Link href={`/cafes/${c.cafes.slug}`} className="underline-offset-4 hover:underline">{c.cafes.name}</Link></span> : null,
        ].filter(Boolean);
        return (
          <li key={c.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="text-sm">
                {context !== "me" && <span className="font-medium">{who} </span>}
                {subject.length > 0 ? subject.map((s, i) => <span key={i}>{i > 0 ? " · " : ""}{s}</span>) : <span className="text-muted">a coffee</span>}
                {c.brew_methods && <span className="text-muted"> · {c.brew_methods.label}</span>}
              </p>
              <span className="flex items-center gap-3 text-xs text-muted">
                <RatingCups value={Number(c.rating)} size={16} />
                {new Date(c.consumed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {c.visibility === "private" && <Chip>Private</Chip>}
              </span>
            </div>
            {c.notes && <p className="mt-1 text-sm">{c.notes}</p>}
            {c.check_in_tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {c.check_in_tags.map((t, i) => t.flavor_tags && <Chip key={i}>{t.flavor_tags.label}</Chip>)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
