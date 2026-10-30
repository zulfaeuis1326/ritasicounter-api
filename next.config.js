/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Berlaku di semua route -- header keamanan dasar yang Next.js tidak set sendiri.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" }, // cegah situs lain nge-embed app ini di <iframe> (clickjacking)
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
