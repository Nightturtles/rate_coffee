import Link from "next/link";

export function Section({ title, eyebrow, subtitle, href, hrefLabel, children }: { title: string; eyebrow?: string; subtitle?: string; href?: string; hrefLabel?: string; children: React.ReactNode }) {
  return (
    <section className="mt-16 first:mt-10">
      <div className="flex items-end justify-between gap-6 border-b border-border pb-3">
        <div>
          {eyebrow && <p className="label">{eyebrow}</p>}
          <h2 className="mt-1 text-2xl font-light tracking-tight sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="label shrink-0 pb-1 text-text transition hover:text-muted">
            {hrefLabel ?? "See all"} →
          </Link>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}
