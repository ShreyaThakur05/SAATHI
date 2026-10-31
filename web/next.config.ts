import type { NextConfig } from "next";

// Hosts allowed to embed /chat in an iframe (space-separated origins). Everything else is un-frameable.
const frameAncestors = process.env.FRAME_ANCESTORS ?? "'self' http://localhost:3000";

const nextConfig: NextConfig = {
  // The Docker image sets STANDALONE=1; Vercel and `next start` use the default output.
  output: process.env.STANDALONE === "1" ? "standalone" : undefined,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];
    return [
      { source: "/chat", headers: [...base, { key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors}` }] },
      { source: "/((?!chat).*)", headers: [...base, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }] },
    ];
  },
};

export default nextConfig;
