import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The DPDP checker tab reads the static results `npm run build` writes
  // (prebuild: scripts/dpdp-check.ts). Counts and statuses only.
  outputFileTracingIncludes: {
    "/manage/settings/dpdp": ["./src/lib/dpdp/checks/static-results.generated.json"],
  },
};

export default nextConfig;
