/** Small square tag. Default is quiet; "accent" is ink; "bronze" is the single warm signal. */
export function Chip({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "accent" | "bronze" }) {
  const cls = tone === "accent" ? "border-text text-text" : tone === "bronze" ? "border-bronze/50 text-bronze" : "border-border text-muted";
  return (
    <span className={`inline-flex items-center rounded-[2px] border px-1.5 py-[3px] font-mono text-[10px] uppercase leading-none tracking-[0.1em] ${cls}`}>
      {children}
    </span>
  );
}
