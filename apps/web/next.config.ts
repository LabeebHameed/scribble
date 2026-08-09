import path from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")

const nextConfig: NextConfig = {
  // Emit .next at monorepo root when Vercel builds from repo root.
  distDir: process.env.SCRIBBLE_VERCEL_ROOT ? "../../.next" : ".next",
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: [
    "@workspace/ui",
    "@workspace/core",
    "@workspace/db",
    "@workspace/mind",
    "@workspace/ai",
  ],
}

export default nextConfig
