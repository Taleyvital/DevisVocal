// App icon drawn with plain boxes so next/og can render it to PNG:
// a black mic on tape-measure yellow, graduations along the bottom.
// The mic stays inside the central 60% so "maskable" crops don't cut it.
export function AppIcon({ size }: { size: number }) {
  const u = size / 100;
  const ink = "#141414";
  const ticks = Array.from({ length: 11 }, (_, i) => i);
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#ffd400",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <div style={{ width: 18 * u, height: 30 * u, borderRadius: 9 * u, background: ink }} />
      <div
        style={{
          width: 32 * u,
          height: 16 * u,
          marginTop: -8 * u,
          borderLeft: `${4 * u}px solid ${ink}`,
          borderRight: `${4 * u}px solid ${ink}`,
          borderBottom: `${4 * u}px solid ${ink}`,
          borderBottomLeftRadius: 16 * u,
          borderBottomRightRadius: 16 * u,
        }}
      />
      <div style={{ width: 4 * u, height: 8 * u, background: ink }} />
      {size >= 64 && (
        <div
          style={{
            position: "absolute",
            left: 20 * u,
            right: 20 * u,
            bottom: 12 * u,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          {ticks.map((i) => (
            <div
              key={i}
              style={{
                width: 1.4 * u,
                height: (i % 5 === 0 ? 8 : 4) * u,
                background: i === 5 ? "#e5322d" : ink,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
