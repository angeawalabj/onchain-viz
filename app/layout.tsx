import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:       "OnChain Viz — 3D Blockchain Explorer",
  description: "Visualisation 3D interactive des données on-chain Ethereum. Graphe de transactions, liquidité DeFi, activité de contracts.",
  keywords:    ["blockchain", "ethereum", "visualization", "3d", "defi", "onchain"],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title:       "OnChain Viz",
    description: "3D blockchain graph explorer",
    type:        "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased overflow-hidden" style={{ background: "#060610" }}>
        {children}
      </body>
    </html>
  );
}
