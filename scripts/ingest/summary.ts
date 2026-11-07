/** Prints a review table from data/ingest-report.json. */
import { readFileSync } from "node:fs";
type R = { name: string; platform: string; coffees: number; roast_level: string | null; process_focus: string | null; single_origin_share: number | null; llm: string | null; error?: string };
const rows = JSON.parse(readFileSync("data/ingest-report.json", "utf8")) as R[];
const pad = (s: unknown, n: number) => String(s ?? "-").padEnd(n);
console.log(pad("Roaster", 30) + pad("Platform", 12) + pad("Coffees", 8) + pad("Roast", 13) + pad("Process", 13) + pad("SO%", 5) + "LLM");
for (const r of rows) {
  console.log(pad(r.name, 30) + pad(r.platform, 12) + pad(r.coffees, 8) + pad(r.roast_level, 13) + pad(r.process_focus, 13) + pad(r.single_origin_share == null ? "-" : Math.round(r.single_origin_share * 100), 5) + (r.llm ?? "-") + (r.error ? `  ERROR ${r.error}` : ""));
}
const withMenu = rows.filter((r) => r.coffees > 0).length;
console.log(`\n${rows.length} roasters, ${withMenu} with menus, ${rows.reduce((a, r) => a + r.coffees, 0)} coffees, ${rows.filter((r) => r.error).length} errors`);
