/**
 * Tiny inline-SVG national flags — hand-drawn simplifications rendered at chip
 * size. No image assets, no external requests, no copyright baggage (flag
 * designs are public domain; these are minimal evocations, not reproductions).
 * Unmapped codes fall back to a neutral code chip so nothing ever breaks.
 */
import type { ReactNode } from "react";

const W = 30;
const H = 20;

/** Horizontal (default) or vertical colour bands with optional weights. */
function bands(defs: Array<[string, number?]>, vertical = false): ReactNode {
  const total = defs.reduce((s, [, w]) => s + (w ?? 1), 0);
  let off = 0;
  return defs.map(([c, w], i) => {
    const frac = (w ?? 1) / total;
    const rect = vertical ? (
      <rect key={i} x={off * W} y={0} width={frac * W + 0.1} height={H} fill={c} />
    ) : (
      <rect key={i} x={0} y={off * H} width={W} height={frac * H + 0.1} fill={c} />
    );
    off += frac;
    return rect;
  });
}

function star(cx: number, cy: number, r: number, fill: string): ReactNode {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.4 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return <polygon points={pts.join(" ")} fill={fill} />;
}

/** Scandinavian offset cross, optionally with an inner cross (Norway). */
function nordic(cross: string, inner?: string): ReactNode {
  return (
    <>
      <rect x={9} y={0} width={5.5} height={H} fill={cross} />
      <rect x={0} y={7.25} width={W} height={5.5} fill={cross} />
      {inner && (
        <>
          <rect x={10.4} y={0} width={2.7} height={H} fill={inner} />
          <rect x={0} y={8.65} width={W} height={2.7} fill={inner} />
        </>
      )}
    </>
  );
}

const FLAGS: Record<string, ReactNode> = {
  ARG: (
    <>
      {bands([["#75AADB"], ["#ffffff"], ["#75AADB"]])}
      <circle cx={15} cy={10} r={2.6} fill="#F6B40E" />
    </>
  ),
  AUS: (
    <>
      <rect width={W} height={H} fill="#00247D" />
      <path d="M0,0 L12,10 M12,0 L0,10" stroke="#ffffff" strokeWidth={1.6} />
      {star(20, 10, 4, "#ffffff")}
    </>
  ),
  AUT: bands([["#ED2939"], ["#ffffff"], ["#ED2939"]]),
  BEL: bands([["#000000"], ["#FDDA24"], ["#EF3340"]], true),
  BRA: (
    <>
      <rect width={W} height={H} fill="#009B3A" />
      <polygon points="15,2.5 26.5,10 15,17.5 3.5,10" fill="#FEDF00" />
      <circle cx={15} cy={10} r={3.4} fill="#002776" />
    </>
  ),
  CMR: (
    <>
      {bands([["#007A5E"], ["#CE1126"], ["#FCD116"]], true)}
      {star(15, 10, 2.6, "#FCD116")}
    </>
  ),
  CAN: bands([["#D80621"], ["#ffffff", 2], ["#D80621"]], true),
  CHI: (
    <>
      {bands([["#ffffff"], ["#D52B1E"]])}
      <rect x={0} y={0} width={12} height={10} fill="#0039A6" />
      {star(6, 5, 2.6, "#ffffff")}
    </>
  ),
  COL: bands([["#FCD116", 2], ["#003893"], ["#CE1126"]]),
  CRO: bands([["#FF0000"], ["#ffffff"], ["#171796"]]),
  DEN: (
    <>
      <rect width={W} height={H} fill="#C8102E" />
      {nordic("#ffffff")}
    </>
  ),
  ECU: bands([["#FFDD00", 2], ["#034EA2"], ["#ED1C24"]]),
  EGY: (
    <>
      {bands([["#CE1126"], ["#ffffff"], ["#000000"]])}
      <circle cx={15} cy={10} r={2.2} fill="#C09300" />
    </>
  ),
  ENG: (
    <>
      <rect width={W} height={H} fill="#ffffff" />
      <rect x={12.6} y={0} width={4.8} height={H} fill="#CE1124" />
      <rect x={0} y={7.6} width={W} height={4.8} fill="#CE1124" />
    </>
  ),
  FRA: bands([["#0055A4"], ["#ffffff"], ["#EF4135"]], true),
  GER: bands([["#000000"], ["#DD0000"], ["#FFCE00"]]),
  GHA: (
    <>
      {bands([["#CE1126"], ["#FCD116"], ["#006B3F"]])}
      {star(15, 10, 2.8, "#000000")}
    </>
  ),
  GRE: (
    <>
      {bands([["#0D5EAF"], ["#ffffff"], ["#0D5EAF"], ["#ffffff"], ["#0D5EAF"]])}
      <rect x={0} y={0} width={12} height={10} fill="#0D5EAF" />
      <rect x={5} y={0} width={2.2} height={10} fill="#ffffff" />
      <rect x={0} y={3.9} width={12} height={2.2} fill="#ffffff" />
    </>
  ),
  IRN: bands([["#239F40"], ["#ffffff"], ["#DA0000"]]),
  ITA: bands([["#009246"], ["#ffffff"], ["#CE2B37"]], true),
  JPN: (
    <>
      <rect width={W} height={H} fill="#ffffff" />
      <circle cx={15} cy={10} r={5} fill="#BC002D" />
    </>
  ),
  MEX: bands([["#006847"], ["#ffffff"], ["#CE1126"]], true),
  MAR: (
    <>
      <rect width={W} height={H} fill="#C1272D" />
      {star(15, 10, 4.6, "#006233")}
    </>
  ),
  NED: bands([["#AE1C28"], ["#ffffff"], ["#21468B"]]),
  NGA: bands([["#008751"], ["#ffffff"], ["#008751"]], true),
  NOR: (
    <>
      <rect width={W} height={H} fill="#BA0C2F" />
      {nordic("#ffffff", "#00205B")}
    </>
  ),
  PER: bands([["#D91023"], ["#ffffff"], ["#D91023"]], true),
  POL: bands([["#ffffff"], ["#DC143C"]]),
  POR: (
    <>
      {bands([["#046A38", 1.2], ["#DA291C", 1.8]], true)}
      <circle cx={12} cy={10} r={3.4} fill="#FFE900" />
    </>
  ),
  QAT: bands([["#ffffff"], ["#8A1538", 2]], true),
  KSA: (
    <>
      <rect width={W} height={H} fill="#006C35" />
      <rect x={8} y={8.6} width={14} height={1.7} fill="#ffffff" rx={0.8} />
    </>
  ),
  SCO: (
    <>
      <rect width={W} height={H} fill="#005EB8" />
      <path d="M0,0 L30,20 M30,0 L0,20" stroke="#ffffff" strokeWidth={4} />
    </>
  ),
  SEN: (
    <>
      {bands([["#00853F"], ["#FDEF42"], ["#E31B23"]], true)}
      {star(15, 10, 2.8, "#00853F")}
    </>
  ),
  SRB: bands([["#C6363C"], ["#0C4076"], ["#ffffff"]]),
  KOR: (
    <>
      <rect width={W} height={H} fill="#ffffff" />
      <circle cx={15} cy={10} r={4.6} fill="#0047A0" />
      <path d="M10.4,10 a4.6,4.6 0 0 1 9.2,0 z" fill="#CD2E3A" />
    </>
  ),
  ESP: bands([["#AA151B"], ["#F1BF00", 2], ["#AA151B"]]),
  SWE: (
    <>
      <rect width={W} height={H} fill="#006AA7" />
      {nordic("#FECC02")}
    </>
  ),
  SUI: (
    <>
      <rect width={W} height={H} fill="#DA291C" />
      <rect x={13} y={4.5} width={4} height={11} fill="#ffffff" />
      <rect x={9.5} y={8} width={11} height={4} fill="#ffffff" />
    </>
  ),
  TUN: (
    <>
      <rect width={W} height={H} fill="#E70013" />
      <circle cx={15} cy={10} r={5} fill="#ffffff" />
      <circle cx={16} cy={10} r={3.8} fill="#E70013" />
      <circle cx={17.4} cy={10} r={3} fill="#ffffff" />
      {star(15.4, 10, 1.8, "#E70013")}
    </>
  ),
  TUR: (
    <>
      <rect width={W} height={H} fill="#E30A17" />
      <circle cx={12} cy={10} r={4} fill="#ffffff" />
      <circle cx={13.4} cy={10} r={3.2} fill="#E30A17" />
      {star(18.2, 10, 2, "#ffffff")}
    </>
  ),
  UKR: bands([["#0057B7"], ["#FFD700"]]),
  URU: (
    <>
      {bands([["#ffffff"], ["#0038A8"], ["#ffffff"], ["#0038A8"], ["#ffffff"]])}
      <rect x={0} y={0} width={12} height={12} fill="#ffffff" />
      <circle cx={6} cy={6} r={2.8} fill="#FCD116" />
    </>
  ),
  USA: (
    <>
      {bands([
        ["#B22234"], ["#ffffff"], ["#B22234"], ["#ffffff"],
        ["#B22234"], ["#ffffff"], ["#B22234"],
      ])}
      <rect x={0} y={0} width={12} height={10} fill="#3C3B6E" />
    </>
  ),
  WAL: bands([["#ffffff"], ["#00B140"]]),
};

export default function Flag({
  code,
  className = "",
}: {
  code: string;
  className?: string;
}) {
  const art = FLAGS[code];
  if (!art) {
    return (
      <span
        className={`inline-flex h-[15px] w-[22px] shrink-0 items-center justify-center rounded-[3px] border border-white/15 bg-white/[0.06] font-mono text-[7px] tracking-wide text-ivory-faint ${className}`}
        aria-hidden="true"
      >
        {code.slice(0, 2)}
      </span>
    );
  }
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`h-[15px] w-[22px] shrink-0 rounded-[3px] border border-white/20 ${className}`}
      aria-hidden="true"
    >
      {art}
    </svg>
  );
}
