import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep build tracing scoped to this extracted app, even when a parent folder also has a lockfile.
  outputFileTracingRoot: process.cwd(),
  // Runtime migrations read SQL from disk; include them in every serverless trace.
  outputFileTracingIncludes: {
    "/*": ["./migrations/**/*"],
  },
  async headers() {
    return [
      {
        // Allow iframe embedding of public view pages from any origin (WordPress, etc.)
        source: "/view/:path*",
        headers: [
          // CSP frame-ancestors is the correct mechanism for cross-origin iframe embedding.
          // X-Frame-Options is intentionally omitted: it has no standard "allow all" value,
          // and modern browsers respect frame-ancestors over X-Frame-Options when both are set.
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
    ];
  },
};

export default nextConfig;
