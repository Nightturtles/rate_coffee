import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { CoffeeRecord, RoasterAttributes } from "./types";

const Enrichment = z.object({
  roast_level: z.enum(["ultra_light", "light", "medium_light", "medium", "medium_dark", "dark"]).nullable(),
  process_focus: z.enum(["washed", "mixed", "experimental"]).nullable(),
  description: z.string().describe("Two sentences, neutral tone, describing the roaster's style for a coffee enthusiast."),
  is_specialty: z.boolean().describe("True if this reads as a third-wave specialty roaster (origin transparency, light-to-medium roasts)."),
  confidence: z.enum(["low", "medium", "high"]),
});

export type Enrichment = z.infer<typeof Enrichment>;

/** Optional: asks Claude to read the live menu and settle roast level and process focus. Skipped without credentials. */
export async function enrichRoaster(
  name: string,
  website: string,
  coffees: CoffeeRecord[],
  rules: RoasterAttributes,
): Promise<Enrichment | null> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return null;
  const client = new Anthropic();
  const menu = coffees
    .slice(0, 40)
    .map((c) => `- ${c.name}${c.process ? ` | ${c.process}` : ""}${c.roast_level ? ` | ${c.roast_level}` : ""}${c.tasting_notes.length ? ` | notes: ${c.tasting_notes.join(", ")}` : ""}${c.is_blend ? " | blend" : ""}`)
    .join("\n");
  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(Enrichment) },
    messages: [
      {
        role: "user",
        content: `Classify this coffee roaster for a specialty-coffee discovery app.\n\nRoaster: ${name}\nWebsite: ${website}\nRule-based guess: roast=${rules.roast_level ?? "unknown"}, process_focus=${rules.process_focus ?? "unknown"}, single_origin_share=${rules.single_origin_share ?? "unknown"}\n\nCurrent menu (${coffees.length} coffees):\n${menu || "(no menu found)"}\n\nUse the menu as primary evidence. "experimental" process focus means a meaningful share of anaerobic, co-fermented, or similar lots. If the menu is empty or ambiguous, return null for the unknown fields and low confidence.`,
      },
    ],
  });
  return response.parsed_output ?? null;
}
