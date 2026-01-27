import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",
  
  // Server external packages that shouldn't be bundled
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
