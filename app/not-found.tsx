export default function NotFound() {
  return (
    <div
      className="flex min-h-screen items-center justify-center font-mono"
      style={{ background: "#060610" }}
    >
      <div className="text-center">
        <p className="text-5xl font-bold mb-3" style={{ color: "#7c6df0" }}>
          404
        </p>
        <p className="text-sm mb-6" style={{ color: "rgba(232,230,240,0.4)" }}>
          Page introuvable
        </p>
        <a
          href="/"
          className="text-xs border rounded px-4 py-2 transition-colors"
          style={{
            color: "rgba(232,230,240,0.4)",
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          ← Retour au graphe
        </a>
      </div>
    </div>
  );
}
