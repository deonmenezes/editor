/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // R3F + Strict Mode double-mounts and confuses imperative three.js state
  output: 'export', // static export — no SSR needed; deploys to any static host
  images: { unoptimized: true },
}

export default nextConfig
