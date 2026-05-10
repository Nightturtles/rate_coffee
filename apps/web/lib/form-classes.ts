/** Shared control + surface styles (semantic tokens / dark chrome). */

export const inputClass =
  "rounded-md border border-input bg-muted/40 px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground shadow-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export const selectClass = inputClass;

export const textareaClass = `${inputClass} min-h-[4rem]`;

export const cardSurfaceClass =
  "rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm ring-1 ring-foreground/10";

/** Dense cards for feed / history rows */
export const feedCardClass =
  "rounded-xl border border-border bg-card p-3 text-sm text-card-foreground shadow-sm ring-1 ring-foreground/10";

export const tagPillClass =
  "rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground";

export function tabButtonClass(active: boolean) {
  return active
    ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
    : "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
}

export const comboboxListClass =
  "absolute z-20 mt-0.5 max-h-48 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10";
