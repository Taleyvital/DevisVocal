// App icon drawn with plain boxes so next/og can render it to PNG:
// the DevisVocal mark (yellow tape-measure case, black grille with 3×3 dots)
// on the logo's dark background. The case stays inside the central 60% so
// "maskable" crops don't cut it.
export const LOGO_YELLOW = "#f6c445";
export const LOGO_INK = "#161616";

export function AppIcon({ size }: { size: number }) {
  const u = size / 100;
  const dot = 5 * u;
  const gap = 2.6 * u;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: LOGO_INK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 58 * u,
          height: 58 * u,
          borderRadius: 14 * u,
          background: LOGO_YELLOW,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 36 * u,
            height: 36 * u,
            borderRadius: "50%",
            background: LOGO_INK,
            display: "flex",
            flexWrap: "wrap",
            alignContent: "center",
            justifyContent: "center",
            padding: `0 ${(36 * u - 3 * dot - 2 * gap) / 2}px`,
            gap,
          }}
        >
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              style={{ width: dot, height: dot, borderRadius: "50%", background: LOGO_YELLOW }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
