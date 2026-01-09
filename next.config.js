/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  swcMinify: true,
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
  // Standalone output dla Docker
  output: 'standalone',
  
  // Wyłącz telemetrię i zewnętrzne połączenia
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Wyłącz preconnect do zewnętrznych domen
  experimental: {
    optimizeFonts: false,
  },
};

export default config;