// Mini artisan mascot (orange helmet, hi-vis vest, tablet), disappointed
// expression for error popups. Pure SVG so it stays sharp and light.

const SKIN = "#7a4a2a";
const SKIN_DARK = "#5e3820";
const BEARD = "#33200f";
const ORANGE = "#f97316";
const ORANGE_DARK = "#ea580c";
const REFLECT = "#d6d9de";
const SHIRT = "#eef0f2";

export function SadArtisan({ size = 140 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 1.2}
      viewBox="0 0 200 240"
      aria-hidden
      className="mascot"
    >
      <defs>
        <linearGradient id="helmet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fb923c" />
          <stop offset="1" stopColor={ORANGE_DARK} />
        </linearGradient>
        <radialGradient id="face" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#8d5a35" />
          <stop offset="1" stopColor={SKIN} />
        </radialGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="100" cy="232" rx="54" ry="6" fill="rgba(0,0,0,0.12)" />

      {/* Legs and boots */}
      <rect x="72" y="184" width="24" height="38" rx="6" fill="#4b5563" />
      <rect x="104" y="184" width="24" height="38" rx="6" fill="#4b5563" />
      <rect x="72" y="204" width="24" height="5" fill={REFLECT} />
      <rect x="104" y="204" width="24" height="5" fill={REFLECT} />
      <rect x="66" y="218" width="34" height="14" rx="7" fill="#5b3a24" />
      <rect x="100" y="218" width="34" height="14" rx="7" fill="#5b3a24" />

      {/* Hanging right arm */}
      <rect x="136" y="132" width="17" height="46" rx="8" fill={SHIRT} />
      <circle cx="145" cy="183" r="9" fill={SKIN} />

      {/* Torso: shirt, vest, reflective strips */}
      <rect x="62" y="122" width="78" height="68" rx="18" fill={SHIRT} />
      <path d="M62 140 Q62 124 80 124 L94 124 L94 190 L66 190 Q62 190 62 184 Z" fill={ORANGE} />
      <path d="M140 140 Q140 124 122 124 L106 124 L106 190 L136 190 Q140 190 140 184 Z" fill={ORANGE} />
      <rect x="62" y="166" width="32" height="7" fill={REFLECT} />
      <rect x="106" y="166" width="34" height="7" fill={REFLECT} />
      <rect x="74" y="124" width="6" height="42" fill={REFLECT} />
      <rect x="121" y="124" width="6" height="42" fill={REFLECT} />
      <rect x="110" y="140" width="10" height="9" rx="2" fill={ORANGE_DARK} />

      {/* Tablet held low, head-down mood */}
      <g transform="rotate(-10 62 158)">
        <rect x="36" y="140" width="48" height="34" rx="5" fill="#2f3742" />
        <rect x="40" y="144" width="40" height="26" rx="3" fill="#3b4552" />
      </g>
      <circle cx="56" cy="166" r="9" fill={SKIN} />

      {/* Head */}
      <circle cx="62" cy="88" r="8" fill={SKIN_DARK} />
      <circle cx="138" cy="88" r="8" fill={SKIN_DARK} />
      <circle cx="100" cy="86" r="39" fill="url(#face)" />
      <path
        d="M64 94 C66 122 86 128 100 128 C114 128 134 122 136 94 C127 106 114 110 100 110 C86 110 73 106 64 94 Z"
        fill={BEARD}
      />

      {/* Helmet */}
      <path d="M56 74 C56 42 78 27 100 27 C122 27 144 42 144 74 Z" fill="url(#helmet)" />
      <rect x="94" y="28" width="12" height="44" rx="6" fill="#fdba74" opacity="0.7" />
      <rect x="49" y="68" width="102" height="11" rx="5.5" fill={ORANGE_DARK} />

      {/* Disappointed face: brows up in the middle, eyes looking down, frown */}
      <ellipse cx="86" cy="93" rx="7.5" ry="8" fill="#fff" />
      <ellipse cx="114" cy="93" rx="7.5" ry="8" fill="#fff" />
      <circle cx="86" cy="96.5" r="4.2" fill="#1b1b1b" />
      <circle cx="114" cy="96.5" r="4.2" fill="#1b1b1b" />
      <circle cx="84.5" cy="95" r="1.3" fill="#fff" />
      <circle cx="112.5" cy="95" r="1.3" fill="#fff" />
      <path d="M77 88 L94 82" stroke={BEARD} strokeWidth="4.5" strokeLinecap="round" />
      <path d="M106 82 L123 88" stroke={BEARD} strokeWidth="4.5" strokeLinecap="round" />
      <ellipse cx="100" cy="105" rx="6.5" ry="4.5" fill={SKIN_DARK} />
      <path
        d="M88 120 Q100 110 112 120 Q100 115 88 120 Z"
        fill="#5a2416"
        stroke="#5a2416"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Sweat drop */}
      <path d="M150 84 q7 10 0 14 q-7 -4 0 -14 z" fill="#7dd3fc" />
    </svg>
  );
}
