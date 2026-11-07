export function scoreTone(score: number | null | undefined) {
  if (score == null) return "lo";
  if (score >= 80) return "hi";
  if (score >= 65) return "mid";
  return "lo";
}

/** Specialty score, 0-100ish. A thin ring; the top tier fills solid so it reads at a glance. */
export function ScoreBadge({ score, size = "md" }: { score: number | null | undefined; size?: "sm" | "md" | "lg" }) {
  const tone = scoreTone(score);
  const color = tone === "hi" ? "border-text bg-text text-bg" : tone === "mid" ? "border-text text-text" : "border-border text-muted";
  const dim = size === "lg" ? "h-16 w-16 text-xl" : size === "sm" ? "h-8 w-8 text-[11px]" : "h-12 w-12 text-sm";
  return (
    <span title="Specialty score" className={`num inline-flex shrink-0 items-center justify-center rounded-full border ${dim} ${color}`}>
      {score ?? "–"}
    </span>
  );
}
