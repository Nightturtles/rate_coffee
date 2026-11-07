export function Chip({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "accent" }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${tone === "accent" ? "border-accent/40 bg-accent/10 text-accent" : "border-border bg-surface text-muted"}`}>
      {children}
    </span>
  );
}
