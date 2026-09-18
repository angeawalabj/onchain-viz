export default function Loading() {
  return (
    <div
      className="flex h-screen w-screen items-center justify-center font-mono"
      style={{ background: "#060610" }}
    >
      <div className="text-center">
        <div
          className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2"
          style={{
            borderColor: "rgba(124,109,240,0.2)",
            borderTopColor: "#7c6df0",
          }}
        />
        <p className="text-xs" style={{ color: "rgba(232,230,240,0.35)" }}>
          Chargement…
        </p>
      </div>
    </div>
  );
}
