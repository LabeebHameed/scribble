import path from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")

const nextConfig: NextConfig = {
  // When deploying from monorepo root on Vercel, emit .next at repo root.
  distDir: process.env.VERCEL_MONOREPO_ROOT ? "../../.next" : ".next",
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
