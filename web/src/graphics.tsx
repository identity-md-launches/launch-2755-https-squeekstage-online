import type { CSSProperties } from "react";
export type IconName =
  | "wheel"
  | "monitor"
  | "heart"
  | "arrow"
  | "external"
  | "wallet"
  | "activity"
  | "cube"
  | "coins"
  | "copy"
  | "check"
  | "close"
  | "volume"
  | "muted"
  | "expand"
  | "settings"
  | "refresh"
  | "info"
  | "chevron";
const paths: Record<IconName, React.ReactNode> = {
  wheel: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2" />
      <path d="m12 3 0 7m0 4v7m-9-9h7m4 0h7M5.6 5.6l5 5m2.8 2.8 5 5m0-12.8-5 5m-2.8 2.8-5 5" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="3" width="18" height="13" rx="2" />
      <path d="M8 21h8m-4-5v5" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  external: (
    <>
      <path d="M14 3h7v7m0-7L10 14" />
      <path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 7V4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h15V7H5a1 1 0 0 1 0-3" />
      <path d="M20 11h-5v6h5m-3-3h.1" />
    </>
  ),
  activity: <path d="M2 12h4l3-9 6 18 3-9h4" />,
  cube: (
    <>
      <path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5m-9 5v10M7 4.8l9 5" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0m-16-3c0 4 16 4 16 0m-16 6c0 4 16 4 16 0" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M16 8V3H3v13h5" />
    </>
  ),
  check: <path d="m4 12 5 5L20 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  volume: (
    <>
      <path d="M11 4 6 8H2v8h4l5 4zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
    </>
  ),
  muted: (
    <>
      <path d="M11 4 6 8H2v8h4l5 4zM16 9l6 6m-6 0 6-6" />
    </>
  ),
  expand: <path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6" />,
  settings: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="8" cy="7" r="3" />
      <circle cx="16" cy="17" r="3" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 8a9 9 0 1 0 1 8M20 3v6h-6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10h.01" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
};
export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 36" aria-hidden="true">
      <path
        d="M4 14C-3 6 5-2 12 7h8c7-9 15-1 8 7 5 13-4 21-12 21S-1 27 4 14Z"
        fill="#f2c230"
      />
      <circle cx="10" cy="17" r="2" fill="#0b0b0d" />
      <circle cx="22" cy="17" r="2" fill="#0b0b0d" />
      <path
        d="m13 23 3 3 3-3"
        fill="none"
        stroke="#0b0b0d"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function Hamster({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 150"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M54 108c-38 8-41-23-26-22 14 1 5 16 19 17"
        stroke="#e6ad24"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M63 119c-32-19-29-72 8-86 38-15 71 3 80 32l10 37-39 22Z"
        fill="#e5aa23"
        stroke="#16151a"
        strokeWidth="3"
      />
      <path
        d="M66 112c-22-26-14-62 15-71m-18 24 5-8m14-10 6-1"
        stroke="#ffdb76"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="m67 120-17 10h31m40-10-9 12h28" fill="#e7ac24" />
      <path
        d="M123 51c-20-21-3-43 10-31 7 6 8 17 6 23m28 8c9-20 31-12 20 6"
        fill="#e8af30"
        stroke="#17151b"
        strokeWidth="3"
      />
      <path d="M126 42c-10-9-7-20-1-17 6 2 7 10 7 13" fill="#cb846a" />
      <path
        d="M126 45c20-16 55-5 62 24l17 12c10 8-3 22-19 28-27 11-49 3-66-9-13-9-13-32 6-55Z"
        fill="#f6cd70"
        stroke="#17151b"
        strokeWidth="3"
      />
      <path
        d="M142 81c17-14 20 17 42 9 16-6 15 10 0 15-18 8-38 3-44-7-4-6-2-13 2-17Z"
        fill="#ffedb4"
      />
      <ellipse cx="163" cy="66" rx="4" ry="7" fill="#17151b" />
      <ellipse cx="164" cy="64" rx="1" ry="2" fill="#fff5d5" />
      <path d="m194 81 9 2-8 4" fill="#21191b" />
      <path
        d="m192 88 22 5m-22-7 22-7m-25 12 15 12"
        stroke="#8d692c"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="m119 105 18 13 18-5m-18 5 9 8 13-3"
        stroke="#17151b"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="m134 121 5 5 8-1"
        stroke="#e3a32a"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function Wheel({
  progress,
  compact = false,
}: {
  progress: number | null;
  compact?: boolean;
}) {
  const safe = Math.max(0, Math.min(100, progress ?? 0));
  return (
    <div className={`wheel-visual ${compact ? "compact" : ""}`}>
      <svg className="wheel-rings" viewBox="0 0 300 300" aria-hidden="true">
        <circle cx="150" cy="150" r="145" className="outer-ring" />
        <circle cx="150" cy="150" r="133" className="tick-ring" />
        <circle cx="150" cy="150" r="119" className="inner-ring" />
        <circle
          cx="150"
          cy="150"
          r="119"
          className="progress-ring"
          pathLength="100"
          strokeDasharray={`${safe} 100`}
          transform="rotate(-90 150 150)"
        />
        <path d="M84 220Q150 270 216 220" stroke="#786221" strokeWidth="2" />
      </svg>
      <Hamster className="hamster" />
      <div className="wheel-caption">
        <strong>
          {progress == null ? "–" : safe.toFixed(1)}
          <small>%</small>
        </strong>
        <span>of next block</span>
      </div>
    </div>
  );
}
export const accentStyle = (accent: string): CSSProperties =>
  ({ "--overlay-accent": accent }) as CSSProperties;
