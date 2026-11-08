import Link from "next/link";
import { Chip } from "./ui/Chip";
import { ScoreBadge } from "./ui/ScoreBadge";
import { Photo, Thumb } from "./ui/Img";
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

function TitleLine({ name, score, distance }: { name: string; score: number | null | undefined; distance: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h3 className="min-w-0 truncate text-[17px] font-medium tracking-tight underline decoration-transparent underline-offset-4 transition group-hover:decoration-text">{name}</h3>
      <span className="flex shrink-0 items-center gap-3">
        <span className="num text-[11px] text-muted">{miles(distance)}</span>
        <ScoreBadge score={score} size="sm" />
      </span>
    </div>
  );
}

export function RoasterCard({ r, index }: { r: DiscoverRoaster; index?: number }) {
  return (
    <Cell href={`/roasters/${r.slug}`} index={index}>
      <Thumb icon={r.logo_url} name={r.name} size={72} />
      <div className="min-w-0 flex-1">
        <TitleLine name={r.name} score={r.specialty_score} distance={r.distance_m} />
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
      <Thumb icon={c.logo_url} name={c.name} size={72} />
      <div className="min-w-0 flex-1">
        <TitleLine name={c.name} score={c.specialty_score} distance={c.distance_m} />
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

/** The lead roaster, shown large with its photo. Used at the top of the home list. */
export function FeaturedRoaster({ r }: { r: DiscoverRoaster & { image_url: string } }) {
  return (
    <Link href={`/roasters/${r.slug}`} className="group grid grid-cols-1 gap-6 border-t border-border py-6 sm:grid-cols-12 sm:gap-10">
      <div className="aspect-[4/3] overflow-hidden rounded-[2px] bg-surface-2 sm:col-span-7">
        <Photo src={r.image_url} alt={r.name} width={720} sizes="(min-width: 1152px) 640px, (min-width: 640px) 58vw, 100vw" priority className="transition duration-700 group-hover:scale-[1.02]" />
      </div>
      <div className="flex flex-col justify-between sm:col-span-5">
        <div>
          <p className="label">Nearest standout · {miles(r.distance_m)}</p>
          <h3 className="mt-3 text-3xl font-light leading-[1.05] tracking-tight sm:text-4xl">{r.name}</h3>
          <p className="mt-2 text-muted">
            {r.city}
            {r.active_coffee_count ? ` · ${r.active_coffee_count} coffees` : ""}
            {r.cafe_count ? ` · ${r.cafe_count} cafe${r.cafe_count === 1 ? "" : "s"}` : ""}
          </p>
          {r.description && <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted">{r.description}</p>}
        </div>
        <div className="mt-6 flex items-center gap-4">
          <ScoreBadge score={r.specialty_score} />
          <div className="flex flex-wrap gap-1.5">
            {r.roast_level && <Chip tone={r.roast_level.includes("light") ? "bronze" : "default"}>{ROAST_LABEL[r.roast_level]}</Chip>}
            {r.process_focus && <Chip>{PROCESS_FOCUS_LABEL[r.process_focus]}</Chip>}
          </div>
        </div>
      </div>
    </Link>
  );
}
