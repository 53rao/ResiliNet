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
