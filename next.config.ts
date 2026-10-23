import type { NextConfig } from "next";

// Deny framing for every authenticated/sensitive route -- otherwise a
// malicious site could iframe the admin/staff dashboards or the sign-in
// page for clickjacking. /reservations/[slug] is deliberately excluded:
// it's the embeddable widget, meant to be framed by any restaurant's own
// external website.
const NO_FRAME_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  images: {
    // Restaurant logo/banner uploads live in Vercel Blob. Without this,
    // next/image refuses to optimize them, which is why `unoptimized` got
    // added at the call sites -- but that skips Vercel's image CDN
    // entirely, so every page view re-fetched the full original straight
    // from Blob and blew through the account's Blob data-transfer quota.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  experimental: {
    serverActions: {
      // Default is 1MB -- the logo upload action allows up to 5MB, so
      // without this every upload over 1MB was rejected before ever
      // reaching that check.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      { source: "/", headers: NO_FRAME_HEADERS },
      { source: "/sign-in", headers: NO_FRAME_HEADERS },
      { source: "/admin/:path*", headers: NO_FRAME_HEADERS },
      { source: "/r/:path*", headers: NO_FRAME_HEADERS },
    ];
  },
};

export default nextConfig;
