import { describe, expect, it } from "vitest";
import { checkInFormSchema, slugify } from "./schemas";

describe("slugify", () => {
  it("normalizes names", () => {
    expect(slugify("  Blue Bottle! ")).toBe("blue-bottle");
  });
});

describe("checkInFormSchema", () => {
  it("rejects half-step violations", () => {
    const r = checkInFormSchema.safeParse({
      coffeeId: "00000000-0000-0000-0000-000000000001",
      context: "home",
      brewMethodId: "00000000-0000-0000-0000-000000000002",
      rating: 3.3,
      tagIds: [],
    });
    expect(r.success).toBe(false);
  });
});
