"use client";

import { useId } from "react";

export type CupFill = "full" | "half" | "empty";

/** Half-step aware: cup i is full if r ≥ i, half if r ∈ [i−0.5, i), else empty. */
export function cupFillForIndex(rating: number, index1To5: number): CupFill {
  const r = rating;
  const i = index1To5;
  if (r >= i) return "full";
  if (r >= i - 0.5 && r < i) return "half";
  return "empty";
}

type Props = {
  rating: number;
  className?: string;
};

/** Five coffee cups for a 0.5–5.0 style rating (half cups supported). */
export function RatingCups({ rating, className }: Props) {
  const raw = Number(rating);
  const r = Number.isFinite(raw) ? Math.min(5, Math.max(0, raw)) : 0;
  const label =
    r % 1 === 0 ? `Rating ${r} out of 5` : `Rating ${r.toFixed(1)} out of 5`;

  return (
    <span
      className={className ?? "inline-flex items-center gap-0.5 text-sage-700"}
      role="img"
      aria-label={label}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <SingleCup key={i} fill={cupFillForIndex(r, i)} />
      ))}
    </span>
  );
}

function SingleCup({ fill }: { fill: CupFill }) {
  const uid = useId();
  const clipHalfId = `${uid}-half`;

  return (
    <svg
      width={22}
      height={26}
      viewBox="0 0 24 28"
      className="shrink-0"
      aria-hidden
    >
      <defs>
        <clipPath id={clipHalfId}>
          <rect x="0" y="0" width="12" height="28" />
        </clipPath>
      </defs>
      {/* Mug outline */}
      <path
        d="M7 7h11v13c0 3.5-2.5 6-6 6H10c-3.5 0-6-2.5-6-6V7z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinejoin="round"
      />
      <path
        d="M18 11c2.5 0 4.5 2 4.5 4.5S20.5 20 18 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinecap="round"
      />
      {/* Liquid */}
      {fill === "full" && (
        <path
          d="M9.5 11h6v11c0 2.5-1.8 4.5-4 4.5h-2c-2.2 0-4-2-4-4.5V11z"
          className="fill-current opacity-85"
        />
      )}
      {fill === "half" && (
        <g clipPath={`url(#${clipHalfId})`}>
          <path
            d="M9.5 11h6v11c0 2.5-1.8 4.5-4 4.5h-2c-2.2 0-4-2-4-4.5V11z"
            className="fill-current opacity-85"
          />
        </g>
      )}
    </svg>
  );
}
