import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./lib/security/headers";

const config: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: buildSecurityHeaders(process.env.NODE_ENV) }];
  },
};
export default config;
