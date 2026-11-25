import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not enable `output: "standalone"` because CP-03+ uses a custom Node HTTP + Socket.IO server.
};

export default nextConfig;
