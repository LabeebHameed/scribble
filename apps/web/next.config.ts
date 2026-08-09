import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: [
    "@workspace/ui",
    "@workspace/core",
    "@workspace/db",
    "@workspace/mind",
    "@workspace/ai",
  ],
}

export default nextConfig
