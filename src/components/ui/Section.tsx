import Link from "next/link";

export function Section({ title, subtitle, href, hrefLabel, children }: { title: string; subtitle?: string; href?: string; hrefLabel?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="shrink-0 text-sm text-accent underline-offset-4 hover:underline">
            {hrefLabel ?? "See all"}
          </Link>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
