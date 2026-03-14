/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: "templated-assets.s3.amazonaws.com" },
      { hostname: "v3b.fal.media" },
      { hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
