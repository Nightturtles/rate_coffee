import Link from "next/link";
import { Chip } from "./ui/Chip";
import { ScoreBadge } from "./ui/ScoreBadge";
import { PROCESS_FOCUS_LABEL, ROAST_LABEL, pct } from "@/lib/labels";
import { miles, type DiscoverCafe, type DiscoverRoaster } from "@/lib/discovery";

/** Grid cell with a hairline on top. Index numbers come from the parent, Weber-style. */
function Cell({ href, index, children }: { href: string; index?: number; children: React.ReactNode }) {
  return (
    <Link href={href} className="group flex gap-5 border-t border-border py-5 transition">
      {index != null && <span className="num w-6 shrink-0 pt-3 text-[11px] text-muted">{String(index).padStart(2, "0")}</span>}
      {children}
    </Link>
  );
}

export function RoasterCard({ r, index }: { r: DiscoverRoaster; index?: number }) {
  return (
    <Cell href={`/roasters/${r.slug}`} index={index}>
      <ScoreBadge score={r.specialty_score} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="min-w-0 truncate text-[17px] font-medium tracking-tight underline decoration-transparent underline-offset-4 transition group-hover:decoration-text">{r.name}</h3>
          <span className="num shrink-0 text-[11px] text-muted">{miles(r.distance_m)}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted">
          {r.city}
          {r.active_coffee_count ? ` · ${r.active_coffee_count} coffees` : ""}
          {r.cafe_count ? ` · ${r.cafe_count} cafe${r.cafe_count === 1 ? "" : "s"}` : ""}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {r.roast_level && <Chip tone={r.roast_level.includes("light") ? "bronze" : "default"}>{ROAST_LABEL[r.roast_level]}</Chip>}
          {r.process_focus && <Chip>{PROCESS_FOCUS_LABEL[r.process_focus]}</Chip>}
          {r.single_origin_share != null && <Chip>{pct(r.single_origin_share)} single origin</Chip>}
        </div>
        {r.description && <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-muted">{r.description}</p>}
      </div>
    </Cell>
  );
}

export function CafeCard({ c, index }: { c: DiscoverCafe; index?: number }) {
  const serves = c.own_roaster_name ? `${c.own_roaster_name}'s own cafe` : c.roaster_names.length ? `Serves ${c.roaster_names.slice(0, 3).join(", ")}${c.roaster_names.length > 3 ? ` +${c.roaster_names.length - 3}` : ""}` : "No roaster signal yet";
  return (
    <Cell href={`/cafes/${c.slug}`} index={index}>
      <ScoreBadge score={c.specialty_score} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="min-w-0 truncate text-[17px] font-medium tracking-tight underline decoration-transparent underline-offset-4 transition group-hover:decoration-text">{c.name}</h3>
          <span className="num shrink-0 text-[11px] text-muted">{miles(c.distance_m)}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted">{[c.address_line1, c.city].filter(Boolean).join(", ")}</p>
        <p className="mt-1 text-sm">{serves}</p>
        {(c.has_pourover || c.has_batch_brew) && (
          <div className="mt-2.5 flex gap-1.5">
            {c.has_pourover && <Chip>Pour over</Chip>}
            {c.has_batch_brew && <Chip>Batch brew</Chip>}
          </div>
        )}
      </div>
    </Cell>
  );
}
