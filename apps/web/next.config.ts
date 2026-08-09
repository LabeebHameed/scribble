import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // When Vercel deploys from the monorepo root, emit .next at repo root.
  distDir: process.env.SCRIBBLE_VERCEL_ROOT ? "../../.next" : ".next",
  transpilePackages: [
    "@workspace/ui",
    "@workspace/core",
    "@workspace/db",
    "@workspace/mind",
    "@workspace/ai",
  ],
}

export default nextConfig
