import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const common = {
  fill: "none",
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function PulseIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M2 12h4l2.1-7 3.8 14 2.3-9 1.7 5H22" />
    </svg>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </svg>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M4 6h7M15 6h5M4 12h3M11 12h9M4 18h9M17 18h3" />
      <circle cx="13" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="15" cy="18" r="2" />
    </svg>
  );
}

export function TimelineIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="12" r="2" />
      <circle cx="8" cy="18" r="2" />
      <path d="m8 7 8 4M16 13l-6 4" />
    </svg>
  );
}

export function ReportIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M6 3h9l3 3v15H6V3Z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </svg>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function ServerIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="3" y="4" width="18" height="6" rx="2" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
      <path d="M7 7h.01M7 17h.01" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="m8 5 11 7-11 7V5Z" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6.1 9a7 7 0 0 1 11.4-2L20 9M4 15l2.5 2a7 7 0 0 0 11.4-2" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return <svg {...common} {...props}><path d="M8 5v14M16 5v14" /></svg>;
}

export function StepIcon(props: IconProps) {
  return <svg {...common} {...props}><path d="m6 5 9 7-9 7V5ZM18 5v14" /></svg>;
}

export function ResetIcon(props: IconProps) {
  return <svg {...common} {...props}><path d="M4 4v6h6M20 20v-6h-6" /><path d="M5.2 15a8 8 0 0 0 13-5M18.8 9A8 8 0 0 0 5.9 4.7L4 7" /></svg>;
}
