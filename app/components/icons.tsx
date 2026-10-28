type IconProps = { size?: number };

const svg = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export function MicIcon({ size = 24 }: IconProps) {
  return (
    <svg {...svg(size)}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
      <path d="M12 18v4" />
    </svg>
  );
}

export function StopIcon({ size = 24 }: IconProps) {
  return (
    <svg {...svg(size)}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

export function ShareIcon({ size = 24 }: IconProps) {
  return (
    <svg {...svg(size)}>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v13" />
    </svg>
  );
}

export function TrashIcon({ size = 20 }: IconProps) {
  return (
    <svg {...svg(size)}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

export function PlusIcon({ size = 20 }: IconProps) {
  return (
    <svg {...svg(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function BuildingIcon({ size = 20 }: IconProps) {
  return (
    <svg {...svg(size)}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </svg>
  );
}
