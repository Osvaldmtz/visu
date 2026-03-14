/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: "images.unsplash.com" },
      { hostname: "ariroiycjuferrlxidla.supabase.co" },
    ],
  },
};

export default nextConfig;
