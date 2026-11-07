export const ROAST_LABEL: Record<string, string> = {
  ultra_light: "Ultra light",
  light: "Light",
  medium_light: "Medium-light",
  medium: "Medium",
  medium_dark: "Medium-dark",
  dark: "Dark",
};

export const PROCESS_FOCUS_LABEL: Record<string, string> = {
  washed: "Washed focus",
  mixed: "Mixed processes",
  experimental: "Experimental",
};

export const PROCESS_LABEL: Record<string, string> = {
  washed: "Washed",
  natural: "Natural",
  honey: "Honey",
  anaerobic: "Anaerobic",
  experimental: "Experimental",
  other: "Other",
};

export function pct(n: number | null | undefined): string {
  return n == null ? "—" : `${Math.round(n * 100)}%`;
}

export function money(cents: number | null | undefined): string {
  return cents == null ? "" : `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
