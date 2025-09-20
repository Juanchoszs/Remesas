/** @type {import('next').NextConfig} */
const nextConfig = {
  // Evita que Next escoja el lockfile del directorio padre como root
  // cuando hay múltiples lockfiles en Windows
  outputFileTracingRoot: process.cwd(),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
