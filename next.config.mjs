/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: "images.unsplash.com" },
      { hostname: "ariroiycjuferrlxidla.supabase.co" },
      { hostname: "v3b.fal.media" },
      { hostname: "fal.media" },
    ],
  },
};

export default nextConfig;
