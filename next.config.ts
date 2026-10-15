import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep build tracing scoped to this extracted app, even when a parent folder also has a lockfile.
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [
      { source: "/forms", destination: "/admin/sources", permanent: false },
      { source: "/forms/manage", destination: "/admin/sources", permanent: false },
      { source: "/forms/manage/:path*", destination: "/admin/sources", permanent: false },
      { source: "/forms/builder", destination: "/admin/sources", permanent: false },
      { source: "/forms/builder/:path*", destination: "/admin/sources", permanent: false },
      { source: "/forms/sheet", destination: "/admin/sources", permanent: false },
      { source: "/forms/tracker", destination: "/admin/sources", permanent: false },
      { source: "/forms/workflows", destination: "/admin/sources", permanent: false },
      { source: "/forms/search", destination: "/admin/sources", permanent: false },
      { source: "/forms/approver/sign-in", destination: "/admin/sign-in?next=/admin/sources", permanent: false },
      { source: "/forms/my", destination: "/student", permanent: false },
      { source: "/forms/my/:path*", destination: "/student/:path*", permanent: false },
    ];
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
