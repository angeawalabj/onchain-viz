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

  // Permet l'import de fichiers GLSL (shaders custom si besoin futur).
  // Next.js 16 utilise Turbopack par défaut, qui refuse un config
  // webpack() sans config turbopack explicite — migré vers sa syntaxe
  // native plutôt que forcer --webpack (confirmé dans
  // node_modules/next/dist/docs/.../turbopack.md : raw-loader est
  // officiellement supporté par Turbopack).
  turbopack: {
    rules: {
      "*.glsl": { loaders: ["raw-loader"], as: "*.js" },
      "*.vs":   { loaders: ["raw-loader"], as: "*.js" },
      "*.fs":   { loaders: ["raw-loader"], as: "*.js" },
      "*.vert": { loaders: ["raw-loader"], as: "*.js" },
      "*.frag": { loaders: ["raw-loader"], as: "*.js" },
    },
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
