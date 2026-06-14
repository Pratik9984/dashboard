import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["lh3.googleusercontent.com", "firebasestorage.googleapis.com"],
  },
  serverExternalPackages: ["imapflow", "mailparser"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "googleapis", "date-fns"],
    serverComponentsHmrCache: true,
  },
};

export default nextConfig;