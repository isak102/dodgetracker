/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.communitydragon.org",
      },
    ],
  },
  experimental: {
    // this is to fix a bug with 404 page on riotID not working when wrapping everything with a suspense
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;
