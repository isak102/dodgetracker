/** @type {import('next').NextConfig} */
BigInt.prototype["toJSON"] = function () {
  return this.toString();
};

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
