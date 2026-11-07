import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { stripHtml } from "./shopify";

const UA = "rate-coffee-ingest/0.1 (catalog research)";

const CANDIDATE_PATHS = [
  "/pages/stockists", "/pages/where-to-find-us", "/pages/where-to-find", "/pages/find-us", "/pages/locations",
  "/pages/wholesale-partners", "/pages/partners", "/pages/our-partners", "/pages/friends", "/pages/cafes",
  "/pages/where-to-buy", "/pages/retailers", "/pages/find-our-coffee", "/pages/serving", "/pages/who-serves-us",
  "/stockists", "/where-to-find-us", "/find-us", "/locations", "/wholesale-partners", "/partners", "/retailers",
  "/where-to-buy", "/cafes", "/our-partners", "/friends",
];

const Stockist = z.object({
  name: z.string(),
  address: z.string().nullable().describe("Street address if shown"),
  city: z.string().nullable(),
  state: z.string().nullable().describe("Two-letter US state if shown or obvious"),
  kind: z.enum(["cafe", "restaurant", "grocery", "roaster_own_cafe", "other"]),
});
const StockistList = z.object({
  page_is_stockist_list: z.boolean().describe("True only if the page actually lists places that serve or sell this roaster's coffee."),
  stockists: z.array(Stockist),
});
export type Stockist = z.infer<typeof Stockist>;

async function getText(url: string): Promise<{ status: number; text: string } | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    const html = await res.text();
    return { status: res.status, text: stripHtml(html) };
  } catch {
    return null;
  }
}

/** Finds a roaster's stockist / where-to-find-us page by probing common paths and the homepage's links. */
export async function findStockistPage(website: string): Promise<{ url: string; text: string } | null> {
  const origin = new URL(website).origin;
  // Homepage links first: they name the page the way the roaster does.
  try {
    const res = await fetch(origin, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    const html = await res.text();
    const links = [...html.matchAll(/href="([^"#?]+)"[^>]*>([^<]{0,80})</gi)]
      .map((m) => ({ href: m[1], label: m[2].trim() }))
      .filter((l) => /stockist|where to (find|buy)|find us|wholesale partner|our partners|retailers|locations|who serves|find our coffee|cafes? (that )?serv/i.test(`${l.label} ${l.href}`))
      .filter((l) => !/wholesale$|\/wholesale\/?$|apply|inquir|login|cart|account/i.test(l.href));
    for (const l of links.slice(0, 4)) {
      const url = l.href.startsWith("http") ? l.href : `${origin}${l.href.startsWith("/") ? "" : "/"}${l.href}`;
      if (new URL(url).origin !== origin) continue;
      const page = await getText(url);
      if (page && page.status === 200 && page.text.length > 200) return { url, text: page.text };
    }
  } catch {
    // fall through to path probing
  }
  for (const path of CANDIDATE_PATHS) {
    const url = `${origin}${path}`;
    const page = await getText(url);
    if (page && page.status === 200 && page.text.length > 200 && !/page not found|404/i.test(page.text.slice(0, 300))) {
      return { url, text: page.text };
    }
  }
  return null;
}

/** Asks Claude to turn a stockist page into structured rows. */
export async function extractStockists(roasterName: string, pageUrl: string, pageText: string): Promise<Stockist[]> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return [];
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(StockistList) },
    messages: [
      {
        role: "user",
        content: `This is text from ${pageUrl}, a page on the website of the coffee roaster "${roasterName}". If it lists cafes, restaurants, or shops that serve or sell their coffee, extract every one as a row. Keep the roaster's own cafes too (kind = roaster_own_cafe). Ignore navigation, footer, and unrelated content. Only include places in the United States.\n\n---\n${pageText.slice(0, 60000)}`,
      },
    ],
  });
  const parsed = response.parsed_output;
  if (!parsed || !parsed.page_is_stockist_list) return [];
  return parsed.stockists;
}
