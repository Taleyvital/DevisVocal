// DevisVocal mark as SVG: tape-measure case with the dot grille,
// optionally with the wavy graduated tape coming out of it.

const YELLOW = "#f6c445";
const INK = "#161616";

const DOTS = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => [38 + c * 12, 38 + r * 12]));

export function LogoMark({ height = 36, tape = false }: { height?: number; tape?: boolean }) {
  const width = tape ? 250 : 100;
  return (
    <svg
      height={height}
      width={(height * width) / 100}
      viewBox={`0 0 ${width} 100`}
      role="img"
      aria-label="DevisVocal"
      className="logo-mark"
    >
      {tape && (
        <g>
          {/* Graduated tape: yellow band with dark ticks across it */}
          <path
            d="M92 62 C118 36 142 36 160 58 S206 86 236 52"
            fill="none"
            stroke={YELLOW}
            strokeWidth="18"
          />
          <path
            d="M92 62 C118 36 142 36 160 58 S206 86 236 52"
            fill="none"
            stroke={INK}
            strokeWidth="9"
            strokeDasharray="2 8"
          />
          <rect x="232" y="40" width="8" height="24" rx="3" fill={YELLOW} transform="rotate(-38 236 52)" />
        </g>
      )}
      <rect x="2" y="2" width="96" height="96" rx="24" fill={YELLOW} />
      <circle cx="50" cy="50" r="30" fill={INK} />
      {DOTS.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4.6" fill={YELLOW} />
      ))}
    </svg>
  );
}
