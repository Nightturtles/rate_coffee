import type { NextConfig } from "next";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = join(here, "..", "..");

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  outputFileTracingRoot: monorepoRoot,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  transpilePackages: ["@rate-coffee/shared"],
  reactStrictMode: true,
};

export default nextConfig;
