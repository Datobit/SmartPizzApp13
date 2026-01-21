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
  
  // Wyłącz wszystkie zewnętrzne połączenia
  webpack: (config, { isServer }) => {
    // Wyłącz próby połączeń sieciowych podczas budowania
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
      };
    }
    return config;
  },
  
  // Wyłącz sprawdzanie aktualizacji
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
  },
};

export default config;