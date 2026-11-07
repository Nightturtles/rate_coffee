export function scoreTone(score: number | null | undefined) {
  if (score == null) return "lo";
  if (score >= 80) return "hi";
  if (score >= 65) return "mid";
  return "lo";
}

/** Specialty score 0-100ish. Derived from catalog attributes until ratings arrive. */
export function ScoreBadge({ score, size = "md" }: { score: number | null | undefined; size?: "sm" | "md" | "lg" }) {
  const tone = scoreTone(score);
  const color = tone === "hi" ? "text-score-hi border-score-hi/40" : tone === "mid" ? "text-score-mid border-score-mid/40" : "text-score-lo border-score-lo/40";
  const dim = size === "lg" ? "h-14 w-14 text-xl" : size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-base";
  return (
    <span title="Specialty score" className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 bg-surface font-display font-semibold tabular-nums ${dim} ${color}`}>
      {score ?? "–"}
    </span>
  );
}
