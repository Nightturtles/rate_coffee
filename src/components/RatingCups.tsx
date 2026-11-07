"use client";

import { Coffee } from "lucide-react";
import { useState } from "react";

const STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

/** Five cups, half-step precision. Pass `onChange` for an input; omit it for a read-only display. */
export function RatingCups({ value, onChange, size = 28, name }: { value: number | null; onChange?: (v: number) => void; size?: number; name?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const interactive = !!onChange;
  return (
    <div className="inline-flex items-center gap-1" role={interactive ? "radiogroup" : undefined} aria-label="Rating" onMouseLeave={() => setHover(null)}>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      {[1, 2, 3, 4, 5].map((cup) => {
        const fill = Math.max(0, Math.min(1, shown - (cup - 1)));
        return (
          <span key={cup} className="relative inline-block" style={{ width: size, height: size }}>
            <Coffee size={size} strokeWidth={1.6} className="absolute inset-0 text-border" />
            <Coffee size={size} strokeWidth={1.6} className="absolute inset-0 text-accent" fill="currentColor" fillOpacity={0.25}
              style={{ clipPath: `inset(0 ${Math.round((1 - fill) * 100)}% 0 0)` }} />
            {interactive && [cup - 0.5, cup].map((v, i) => (
              <button key={v} type="button" role="radio" aria-checked={value === v} aria-label={`${v} cups`}
                className="absolute top-0 h-full w-1/2 cursor-pointer" style={{ left: i === 0 ? 0 : "50%" }}
                onMouseEnter={() => setHover(v)} onFocus={() => setHover(v)} onBlur={() => setHover(null)} onClick={() => onChange(v)} />
            ))}
          </span>
        );
      })}
      <span className="ml-2 min-w-[2.5rem] text-sm tabular-nums text-muted">{shown ? shown.toFixed(1) : interactive ? "—" : ""}</span>
    </div>
  );
}

export { STEPS as RATING_STEPS };
