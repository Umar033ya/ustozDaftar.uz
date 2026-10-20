/** @type {import('next').NextConfig} */
const nextConfig = {
  // The admin panel is a separate Next.js app in a monorepo folder next to
  // `frontend/`. Turbopack otherwise tries to infer the workspace root from the
  // multiple package-lock files at the repo root. process.cwd() is an absolute
  // Windows-safe path (the /admin directory when running from here).
  turbopack: {
    root: process.cwd(),
  },

  // Compress responses with gzip
  compress: true,

  // Disable the "X-Powered-By: Next.js" header for security
  poweredByHeader: false,

  // Strict-mode for React
  reactStrictMode: true,

  // Security headers
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