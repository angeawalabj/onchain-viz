"use client";

import { useEffect } from "react";

interface ErrorProps {
  error:  Error & { digest?: string };
  reset:  () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log en production — remplacer par Sentry si besoin
    console.error("[OnChain Viz] Unhandled error:", error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen items-center justify-center font-mono"
      style={{ background: "#060610" }}
    >
      <div className="text-center max-w-sm px-4">
        {/* Icône erreur */}
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border text-lg"
          style={{
            borderColor: "rgba(248,113,113,0.3)",
            background:  "rgba(248,113,113,0.08)",
            color:       "#f87171",
          }}
        >
          ⚠
        </div>

        <h1
          className="text-sm font-semibold mb-2"
          style={{ color: "rgba(232,230,240,0.85)" }}
        >
          Quelque chose s'est mal passé
        </h1>

        <p
          className="text-xs mb-1"
          style={{ color: "rgba(232,230,240,0.4)" }}
        >
          {error.message || "Erreur inattendue"}
        </p>

        {error.digest && (
          <p
            className="text-xs mb-5 font-mono"
            style={{ color: "rgba(232,230,240,0.2)" }}
          >
            ID : {error.digest}
          </p>
        )}

        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="rounded-md px-4 py-2 text-xs font-mono transition-colors"
            style={{
              background:   "rgba(124,109,240,0.15)",
              borderColor:  "rgba(124,109,240,0.3)",
              border:       "1px solid",
              color:        "#a78bfa",
            }}
          >
            Réessayer
          </button>
          <button
            onClick={() => window.location.href = "/"}
            className="rounded-md px-4 py-2 text-xs font-mono transition-colors"
            style={{
              border:      "1px solid rgba(255,255,255,0.08)",
              color:       "rgba(232,230,240,0.4)",
            }}
          >
            Accueil
          </button>
        </div>
      </div>
    </div>
  );
}
