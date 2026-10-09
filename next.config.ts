import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";
import { resolveBuildIdentifier } from "./src/lib/build-info";

let head: string | undefined, dirty = false;
try {
  head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  dirty = !!execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch { /* Archives without Git must supply trusted CI metadata or remain unidentified. */ }
const identifier = resolveBuildIdentifier(process.env.QUICKEXIT_BUILD_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA, head, dirty);

const nextConfig: NextConfig = {
  generateBuildId: async () => identifier,
  env: { NEXT_PUBLIC_QUICKEXIT_BUILD_ID: identifier },
  cacheComponents: true,
  partialPrefetching: true,
};

export default nextConfig;
