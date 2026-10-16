import type { NextConfig } from 'next';

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : '*.supabase.co';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['google-auth-library'],
  // Las fotos se comprimen en el navegador; el margen cubre navegadores que no pueden hacerlo.
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/services/**' }],
  },
};

export default nextConfig;
