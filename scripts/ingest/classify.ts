import type { CoffeeRecord, ProcessFamily, ProcessFocus, RawProduct, RoastLevel, RoasterAttributes } from "./types";

/** Product types / tag words that mean "not a bag of coffee". */
const NON_COFFEE = [
  "subscription", "gift card", "giftcard", "merch", "apparel", "t-shirt", "tee", "hoodie", "hat", "cap",
  "tote", "mug", "cup", "tumbler", "kettle", "grinder", "brewer", "dripper", "filter", "equipment",
  "gear", "accessor", "sticker", "book", "class", "workshop", "tour", "ticket", "event", "bundle",
  "sampler", "sample pack", "variety pack", "pods", "capsule", "instant", "tea", "matcha", "chocolate bar",
  "syrup", "beans for business", "wholesale", "e-gift", "chai", "cold brew bottle", "canned", "rtd",
  "bottle", "growler", "sign", "tacker", "poster", "print", "card", "scoop", "timer", "scale", "glass", "beanie",
  "socks", "pin", "patch", "keychain", "candle", "custom bag",
];

const COUNTRIES: Record<string, string> = {
  ethiopia: "ET", ethiopian: "ET", kenya: "KE", kenyan: "KE", colombia: "CO", colombian: "CO",
  brazil: "BR", brazilian: "BR", guatemala: "GT", guatemalan: "GT", honduras: "HN", honduran: "HN",
  "el salvador": "SV", salvadoran: "SV", "costa rica": "CR", "costa rican": "CR", nicaragua: "NI",
  panama: "PA", panamanian: "PA", peru: "PE", peruvian: "PE", bolivia: "BO", bolivian: "BO",
  ecuador: "EC", mexico: "MX", mexican: "MX", rwanda: "RW", rwandan: "RW", burundi: "BI", burundian: "BI",
  uganda: "UG", ugandan: "UG", tanzania: "TZ", tanzanian: "TZ", "democratic republic of congo": "CD",
  "dr congo": "CD", congo: "CD", malawi: "MW", zambia: "ZM", yemen: "YE", yemeni: "YE", india: "IN",
  indian: "IN", indonesia: "ID", indonesian: "ID", sumatra: "ID", sumatran: "ID", java: "ID", sulawesi: "ID",
  bali: "ID", flores: "ID", "papua new guinea": "PG", png: "PG", vietnam: "VN", thailand: "TH", thai: "TH",
  myanmar: "MM", china: "CN", yunnan: "CN", hawaii: "US", kona: "US", jamaica: "JM", "dominican republic": "DO",
  "puerto rico": "PR", haiti: "HT", laos: "LA", philippines: "PH", "timor-leste": "TL", timor: "TL",
  nepal: "NP", taiwan: "TW",
};
// Longest names first so "costa rica" wins over "rica" style partials.
const COUNTRY_KEYS = Object.keys(COUNTRIES).sort((a, b) => b.length - a.length);

const VARIETIES = [
  "gesha", "geisha", "bourbon", "pink bourbon", "yellow bourbon", "red bourbon", "caturra", "catuai",
  "typica", "sl28", "sl-28", "sl34", "sl-34", "sl14", "ruiru 11", "batian", "pacamara", "pacas", "maragogipe",
  "mundo novo", "castillo", "colombia", "tabi", "wush wush", "sidra", "chiroso", "java", "catimor",
  "sarchimor", "parainema", "heirloom", "landrace", "74110", "74112", "74158", "74165", "jarc", "dega",
  "kurume", "wolisho", "ethiopian landraces", "villa sarchi", "villalobos", "obata", "icatu", "arara",
  "laurina", "mokka", "eugenioides", "ombligon", "papayo", "striped bourbon", "san bernardo",
];

function hay(p: RawProduct): string {
  return `${p.title}\n${p.product_type}\n${p.tags.join(", ")}\n${p.body_text}`.toLowerCase();
}

const NON_COFFEE_RE = new RegExp(`(^|[^a-z])(${NON_COFFEE.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(e?s)?([^a-z]|$)`);
const NON_COFFEE_TYPE_RE = /merch|apparel|equipment|gear|accessor|\btea\b|gift|hardware|brewing|drinkware|subscription|instant|ready[- ]to[- ]drink/;
const COFFEE_TYPE_RE = /coffee|beans|whole bean|single origin|blend|espresso|roast|decaf/;

/** Is this product a bag of roasted coffee (not merch, gear, instant, subscriptions)? */
export function isCoffeeProduct(p: RawProduct): boolean {
  const title = p.title.toLowerCase();
  const type = p.product_type.toLowerCase();
  // The store's own product type is the most reliable signal when present.
  if (type && NON_COFFEE_TYPE_RE.test(type)) return false;
  if (NON_COFFEE_RE.test(title)) return false;
  if (type && COFFEE_TYPE_RE.test(type)) return true;
  const tagText = p.tags.join(" ").toLowerCase();
  if (/^(merch|apparel|gear|equipment)/.test(tagText)) return false;
  if (/coffee|beans|single origin|blend|espresso|roast|decaf|washed|natural|honey|anaerobic/.test(`${title} ${tagText}`)) return true;
  if (p.size_grams && p.size_grams >= 150 && p.size_grams <= 2500) return true;
  return false;
}

export function detectProcess(text: string): { process: string | null; family: ProcessFamily | null } {
  const t = text.toLowerCase();
  const checks: [RegExp, ProcessFamily, string][] = [
    [/carbonic maceration/, "experimental", "Carbonic maceration"],
    [/thermal shock|thermic/, "experimental", "Thermal shock"],
    [/co-?ferment|yeast inoculat|lactic|koji|infused|wine yeast|fruit ferment/, "experimental", "Co-fermented"],
    [/anaerobic natural/, "anaerobic", "Anaerobic natural"],
    [/anaerobic washed/, "anaerobic", "Anaerobic washed"],
    [/anaerobic|anoxic|sealed tank/, "anaerobic", "Anaerobic"],
    [/black honey/, "honey", "Black honey"],
    [/red honey/, "honey", "Red honey"],
    [/yellow honey/, "honey", "Yellow honey"],
    [/white honey/, "honey", "White honey"],
    [/\bhoney process|honey-process|\bhoney\b.*process|process.*\bhoney\b|pulped natural/, "honey", "Honey"],
    [/wet[- ]hulled|giling basah/, "other", "Wet-hulled"],
    [/\bnatural\b|sun[- ]dried|dry process/, "natural", "Natural"],
    [/\bwashed\b|fully washed|wet process/, "washed", "Washed"],
  ];
  for (const [re, family, label] of checks) {
    if (re.test(t)) return { process: label, family };
  }
  return { process: null, family: null };
}

const ROAST_WORD: Record<string, RoastLevel> = {
  "ultra light": "ultra_light", "ultra-light": "ultra_light", "nordic": "ultra_light", "extra light": "ultra_light",
  "light": "light", "lightly": "light", "blonde": "light",
  "medium light": "medium_light", "medium-light": "medium_light", "light medium": "medium_light", "light-medium": "medium_light",
  "medium": "medium",
  "medium dark": "medium_dark", "medium-dark": "medium_dark", "dark medium": "medium_dark",
  "dark": "dark", "darkly": "dark", "french": "dark", "italian": "dark", "espresso roast": "dark",
};
const ROAST_WORDS_RE = "(ultra[- ]light|extra light|nordic|medium[- ]light|light[- ]medium|medium[- ]dark|dark[- ]medium|light|medium|dark|blonde|french|italian)";

/** Only explicit roast phrasing counts; "dark chocolate" or "light body" in tasting notes must not. */
export function detectRoastLevel(text: string, tags: string[] = []): RoastLevel | null {
  for (const tag of tags) {
    const t = tag.toLowerCase().trim().replace(/\s+roast(ed)?$/, "");
    if (t in ROAST_WORD) return ROAST_WORD[t];
    const m = t.match(/^roast(?: level| profile)?[:\s-]+(.+)$/);
    if (m && m[1] in ROAST_WORD) return ROAST_WORD[m[1]];
  }
  const t = text.toLowerCase();
  const patterns = [
    new RegExp(`\\b${ROAST_WORDS_RE}[- ]roast(?:ed|s|ing)?\\b`),
    new RegExp(`roast(?: level| profile| degree)?\\s*[:\\-–—]\\s*${ROAST_WORDS_RE}\\b`),
    new RegExp(`\\broasted\\s+(?:on the\\s+)?(lightly|light|medium|dark|darkly)(?:\\s+side)?\\b(?!\\s+(chocolate|cherry|fruit|berr|sugar|caramel|roast))`),
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const w = m[1].replace(/\s+/g, " ");
      if (w in ROAST_WORD) return ROAST_WORD[w];
    }
  }
  return null;
}

export function detectOrigin(text: string): string | null {
  const t = ` ${text.toLowerCase()} `;
  for (const k of COUNTRY_KEYS) {
    if (t.includes(` ${k} `) || t.includes(` ${k},`) || t.includes(` ${k}.`) || t.includes(` ${k}\n`)) {
      return COUNTRIES[k];
    }
  }
  return null;
}

export function detectBlend(p: RawProduct, originCount: number): boolean {
  const h = `${p.title} ${p.product_type} ${p.tags.join(" ")}`.toLowerCase();
  if (/\bblend\b/.test(h)) return true;
  if (/single[- ]origin/.test(h)) return false;
  return originCount >= 2;
}

export function detectVarieties(text: string): string[] {
  const t = text.toLowerCase();
  const found = new Set<string>();
  for (const v of VARIETIES) {
    // "colombia" and "java" are also places; only count them when the text says "variety" nearby.
    if ((v === "colombia" || v === "java") && !/variet|cultivar/.test(t)) continue;
    const re = new RegExp(`(^|[^a-z0-9])${v.replace(/[-]/g, "[- ]?")}([^a-z0-9]|$)`);
    if (re.test(t)) found.add(v === "geisha" ? "gesha" : v);
  }
  return [...found];
}

export function detectTastingNotes(p: RawProduct): string[] {
  const text = p.body_text;
  const m =
    text.match(/(?:tasting notes?|notes?|flavou?r notes?|we taste|tastes like|flavou?rs?)\s*[:\-–—]\s*([^\n.]{3,160})/i) ??
    text.match(/^([A-Za-z][A-Za-z' ]{2,24}(?:,\s*[A-Za-z][A-Za-z' ]{2,24}){1,4})\s*$/m);
  if (!m) {
    const fromTags = p.tags.filter((t) => /^(notes?|flavou?r)[: ]/i.test(t)).map((t) => t.replace(/^(notes?|flavou?r)[: ]\s*/i, ""));
    if (fromTags.length) return splitNotes(fromTags.join(", "));
    return [];
  }
  return splitNotes(m[1]);
}

function splitNotes(s: string): string[] {
  return s
    .split(/,|\/|\band\b|\+|•|\|/)
    .map((x) => x.trim().replace(/[.]+$/, "").toLowerCase())
    .filter((x) => x.length >= 3 && x.length <= 30)
    .slice(0, 6);
}

function detectOriginCount(text: string): number {
  const t = ` ${text.toLowerCase()} `;
  const codes = new Set<string>();
  for (const k of COUNTRY_KEYS) if (t.includes(` ${k} `) || t.includes(` ${k},`)) codes.add(COUNTRIES[k]);
  return codes.size;
}

function slugify(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

export function toCoffeeRecord(p: RawProduct): CoffeeRecord {
  const text = hay(p);
  const titleText = `${p.title} ${p.tags.join(" ")}`;
  const proc = detectProcess(text);
  // Prefer origin from the title; body copy often name-drops other countries.
  const origin = detectOrigin(p.title) ?? detectOrigin(titleText) ?? detectOrigin(text);
  const originCount = detectOriginCount(titleText);
  const isBlend = detectBlend(p, originCount);
  return {
    external_id: p.external_id,
    name: p.title,
    slug: slugify(p.handle || p.title),
    url: p.url,
    image_url: p.image_url,
    price_cents: p.price_cents,
    size_grams: p.size_grams,
    is_blend: isBlend,
    roast_level: detectRoastLevel(text, p.tags),
    origin_country_code: isBlend ? null : origin,
    origin_region: null,
    producer: null,
    varieties: detectVarieties(text),
    process: proc.process,
    process_family: proc.family,
    tasting_notes: detectTastingNotes(p),
    status: p.available ? "active" : "closed",
  };
}

const ROAST_ORDER: RoastLevel[] = ["ultra_light", "light", "medium_light", "medium", "medium_dark", "dark"];

/** Rolls per-coffee signals up into roaster-level attributes. */
export function rollupRoaster(coffees: CoffeeRecord[], siteText = ""): RoasterAttributes {
  const active = coffees.filter((c) => c.status === "active");
  const pool = active.length >= 3 ? active : coffees;
  const n = pool.length;

  const roastVotes = pool.map((c) => c.roast_level).filter((r): r is RoastLevel => r != null);
  let roast_level: RoastLevel | null = null;
  if (roastVotes.length) {
    const idx = roastVotes.map((r) => ROAST_ORDER.indexOf(r)).sort((a, b) => a - b);
    roast_level = ROAST_ORDER[idx[Math.floor(idx.length / 2)]];
  } else {
    roast_level = detectRoastLevel(siteText);
  }

  const fam = pool.map((c) => c.process_family).filter((f): f is ProcessFamily => f != null);
  let process_focus: ProcessFocus | null = null;
  if (fam.length >= 2) {
    const washed = fam.filter((f) => f === "washed").length / fam.length;
    const wild = fam.filter((f) => f === "anaerobic" || f === "experimental").length / fam.length;
    process_focus = wild >= 0.3 ? "experimental" : washed >= 0.7 ? "washed" : "mixed";
  }

  const single_origin_share = n ? Math.round((pool.filter((c) => !c.is_blend).length / n) * 100) / 100 : null;

  return { roast_level, process_focus, single_origin_share, coffee_count: n, description: null };
}
