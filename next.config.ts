import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep build tracing scoped to this extracted app, even when a parent folder also has a lockfile.
  outputFileTracingRoot: process.cwd(),
  // db-migrations reads this SQL at runtime. The path is built in code, so the file
  // tracer does not see it unless every route includes the migrations folder.
  outputFileTracingIncludes: {
    "*": ["./migrations/**/*"],
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
