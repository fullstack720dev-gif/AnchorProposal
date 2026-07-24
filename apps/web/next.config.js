/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@anchorproposal/shared'],
  // Proxy API through the web app so a single ngrok tunnel (port 3000) is enough.
  // Browser calls /backend/* → Next forwards to local Nest on 3001.
  async rewrites() {
    // Use 127.0.0.1 (not localhost) — on Windows localhost often resolves to [::1] and fails.
    const api = process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001';
    return [
      {
        source: '/backend/:path*',
        destination: `${api}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
