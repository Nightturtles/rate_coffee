/** Remote imagery helpers. Images are hotlinked from roaster and cafe sites; the big CDNs resize on request. */

const SQUARESPACE_STEPS = [100, 300, 500, 750, 1000, 1500, 2500];

/** A rendition about `width` px wide when the host can resize, else the original. */
export function imgSrc(url: string, width: number): string {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("cdn.shopify.com") || u.pathname.includes("/cdn/shop/")) {
      u.searchParams.set("width", String(width));
      return u.href;
    }
    if (u.hostname.endsWith("squarespace-cdn.com") || u.hostname.endsWith("squarespace.com")) {
      u.searchParams.set("format", `${SQUARESPACE_STEPS.find((s) => s >= width) ?? 2500}w`);
      return u.href;
    }
    return url;
  } catch {
    return url;
  }
}

export function imgSrcSet(url: string, width: number): string | undefined {
  const a = imgSrc(url, width), b = imgSrc(url, width * 2);
  return a === b ? undefined : `${a} ${width}w, ${b} ${width * 2}w`;
}
