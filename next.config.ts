import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["lh3.googleusercontent.com", "firebasestorage.googleapis.com"],
  },
  serverExternalPackages: ["imapflow", "mailparser", "googleapis"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
    serverComponentsHmrCache: true,
  },
};

export default nextConfig;