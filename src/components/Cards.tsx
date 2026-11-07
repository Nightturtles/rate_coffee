import Link from "next/link";
import { Chip } from "./ui/Chip";
import { ScoreBadge } from "./ui/ScoreBadge";
import { PROCESS_FOCUS_LABEL, ROAST_LABEL, pct } from "@/lib/labels";
import { miles, type DiscoverCafe, type DiscoverRoaster } from "@/lib/discovery";

export function RoasterCard({ r }: { r: DiscoverRoaster }) {
  return (
    <Link href={`/roasters/${r.slug}`} className="flex gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 transition hover:border-accent/50">
      <ScoreBadge score={r.specialty_score} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="truncate text-lg font-semibold">{r.name}</h3>
          <span className="shrink-0 text-xs text-muted">{miles(r.distance_m)}</span>
        </div>
        <p className="text-sm text-muted">
          {r.city}
          {r.active_coffee_count ? ` · ${r.active_coffee_count} coffees on the menu` : ""}
          {r.cafe_count ? ` · ${r.cafe_count} cafe${r.cafe_count === 1 ? "" : "s"}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.roast_level && <Chip tone={r.roast_level.includes("light") ? "accent" : "default"}>{ROAST_LABEL[r.roast_level]}</Chip>}
          {r.process_focus && <Chip>{PROCESS_FOCUS_LABEL[r.process_focus]}</Chip>}
          {r.single_origin_share != null && <Chip>{pct(r.single_origin_share)} single origin</Chip>}
        </div>
        {r.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{r.description}</p>}
      </div>
    </Link>
  );
}

export function CafeCard({ c }: { c: DiscoverCafe }) {
  const serves = c.own_roaster_name ? `${c.own_roaster_name}'s own cafe` : c.roaster_names.length ? `Serves ${c.roaster_names.slice(0, 3).join(", ")}${c.roaster_names.length > 3 ? ` +${c.roaster_names.length - 3}` : ""}` : "No roaster signal yet";
  return (
    <Link href={`/cafes/${c.slug}`} className="flex gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 transition hover:border-accent/50">
      <ScoreBadge score={c.specialty_score} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="truncate text-lg font-semibold">{c.name}</h3>
          <span className="shrink-0 text-xs text-muted">{miles(c.distance_m)}</span>
        </div>
        <p className="text-sm text-muted">{[c.address_line1, c.city].filter(Boolean).join(", ")}</p>
        <p className="mt-1 text-sm">{serves}</p>
        {(c.has_pourover || c.has_batch_brew) && (
          <div className="mt-2 flex gap-1.5">
            {c.has_pourover && <Chip>Pour over</Chip>}
            {c.has_batch_brew && <Chip>Batch brew</Chip>}
          </div>
        )}
      </div>
    </Link>
  );
}
