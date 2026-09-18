/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // R3F et drei contiennent des ESM-only packages — doivent être transpilés
  transpilePackages: [
    "three",
    "@react-three/fiber",
    "@react-three/drei",
    "@react-three/postprocessing",
    "postprocessing",
  ],

  webpack(config) {
    // Permet l'import de fichiers GLSL (shaders custom si besoin futur)
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      use: "raw-loader",
    });
    return config;
  },

  // Headers sécurité
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options",        value: "DENY" },
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
          // SharedArrayBuffer nécessaire pour certains workers WASM (optionnel)
          { key: "Cross-Origin-Opener-Policy",   value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy",  value: "require-corp" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
