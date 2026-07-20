/** @type {import('next').NextConfig} */
const backendApiOrigin = process.env.BACKEND_API_ORIGIN?.replace(/\/+$/, "");

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (!backendApiOrigin) return [];

    return [
      {
        source: "/backend-api/:path*",
        destination: `${backendApiOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
