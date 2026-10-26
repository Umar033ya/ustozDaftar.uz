/** @type {import('next').NextConfig} */
const nextConfig = {
  // The repo root has its own package-lock.json; pin the workspace root to
  // this app so Turbopack does not resolve from the monorepo root (Render
  // builds with rootDir=frontend).
  turbopack: {
    root: process.cwd(),
  },

  // Compress responses with gzip
  compress: true,

  // Disable the "X-Powered-By: Next.js" header for security
  poweredByHeader: false,

  // Strict-mode for React (catches potential issues in development)
  reactStrictMode: true,

  // Admin pages moved under /dashboard/admin; old links keep working.
  async redirects() {
    return [
      { source: "/dashboard/admin/finance", destination: "/dashboard/admin", permanent: true },
      { source: "/dashboard/admin-payments", destination: "/dashboard/admin/payments", permanent: true },
    ];
  },

  // Security headers applied to every route
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
