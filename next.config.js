/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["lh3.googleusercontent.com", "firebasestorage.googleapis.com"],
  },
  experimental: {
    serverComponentsExternalPackages: ["imapflow", "mailparser"],
    optimizePackageImports: ["lucide-react", "recharts", "googleapis", "date-fns"],
  },
};

module.exports = nextConfig;
