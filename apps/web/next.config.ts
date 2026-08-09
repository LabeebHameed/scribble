import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Monorepo deploys from the repo root on Vercel; emit .next there.
  distDir: process.env.VERCEL ? "../../.next" : ".next",
  transpilePackages: [
    "@workspace/ui",
    "@workspace/core",
    "@workspace/db",
    "@workspace/mind",
    "@workspace/ai",
  ],
}

export default nextConfig
