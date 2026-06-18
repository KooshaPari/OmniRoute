/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pino", "@octokit/auth-app", "ioredis"]
  }
};
module.exports = nextConfig;
