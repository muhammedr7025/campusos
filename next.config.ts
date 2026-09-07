import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uploads (note PDFs, KYC documents, assignment submissions) travel
    // through server actions, and the default cap is 1MB — below that, a
    // real PDF fails with a framework error before our own 20MB check can
    // return a message anyone can act on. Kept a little above that check so
    // ours is the limit users actually meet.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
