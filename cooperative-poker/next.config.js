/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  // Use absolute paths for _next/static assets so refresh on /hand/, /profile/, etc. works
  assetPrefix: "/",
};

module.exports = nextConfig;
