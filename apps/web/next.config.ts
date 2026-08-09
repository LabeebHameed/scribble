import path from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..")

const nextConfig: NextConfig = {
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
