// App icon drawn with plain boxes so next/og can render it to PNG.
// The mic stays inside the central 60% so "maskable" crops don't cut it.
export function AppIcon({ size }: { size: number }) {
  const u = size / 100;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#1a3c5e",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 18 * u,
          height: 30 * u,
          borderRadius: 9 * u,
          background: "#ffffff",
        }}
      />
      <div
        style={{
          width: 32 * u,
          height: 16 * u,
          marginTop: -8 * u,
          borderLeft: `${4 * u}px solid #ffffff`,
          borderRight: `${4 * u}px solid #ffffff`,
          borderBottom: `${4 * u}px solid #ffffff`,
          borderBottomLeftRadius: 16 * u,
          borderBottomRightRadius: 16 * u,
        }}
      />
      <div style={{ width: 4 * u, height: 8 * u, background: "#ffffff" }} />
    </div>
  );
}
