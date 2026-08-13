// Cambridge 18 Academic, Test 2 — number of US households (millions) by annual
// income in 2007, 2011 and 2015. Source: Cambridge-IELTS-18 p.51.
import { FONT, GS, CAT } from "./theme";

const BRACKETS = [
  { label: "Less than $25,000", color: CAT[0] },
  { label: "$25,000–$49,999", color: CAT[1] },
  { label: "$50,000–$74,999", color: CAT[2] },
  { label: "$75,000–$99,999", color: CAT[3] },
  { label: "$100,000 or more", color: CAT[4] },
];
const GROUPS = [
  { year: "2007", v: [25, 27, 21, 14.5, 29.5] },
  { year: "2011", v: [28.5, 29.5, 21, 14, 27.5] },
  { year: "2015", v: [28, 28.5, 21, 15, 33] },
];

const W = 680;
const H = 500;
const ML = 50;
const MR = 20;
const AXIS_MAX = 35;
const plotB = 340;
const plotT = 56;
const plotH = plotB - plotT;
const plotL = ML;
const plotR = W - MR;
const plotW = plotR - plotL;
const yAt = (v: number) => plotB - (v / AXIS_MAX) * plotH;

export function HouseholdsIncomeChart() {
  const groupW = plotW / GROUPS.length;
  const barW = groupW / 6.2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily={FONT}>
      <title>Number of US households in millions by annual income in 2007, 2011 and 2015</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      <text x={W / 2} y="26" fontSize="14" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Number of US households (in millions), by annual income
      </text>

      {[0, 5, 10, 15, 20, 25, 30, 35].map((v) => (
        <g key={v}>
          <line x1={plotL} y1={yAt(v)} x2={plotR} y2={yAt(v)} stroke={GS.grid} />
          <text x={plotL - 6} y={yAt(v) + 4} fontSize="10" fill={GS.muted} textAnchor="end">{v}</text>
        </g>
      ))}
      <text x={14} y={(plotT + plotB) / 2} fontSize="10.5" fill={GS.muted} textAnchor="middle" transform={`rotate(-90 14 ${(plotT + plotB) / 2})`}>Number of households (millions)</text>

      {GROUPS.map((g, gi) => {
        const gx = plotL + gi * groupW + groupW / 2;
        return (
          <g key={g.year}>
            {g.v.map((val, s) => (
              <rect key={s} x={gx + (s - 2.5) * barW} y={yAt(val)} width={barW} height={plotB - yAt(val)} fill={BRACKETS[s].color} />
            ))}
            <text x={gx} y={plotB + 18} fontSize="12" fill={GS.ink} textAnchor="middle">{g.year}</text>
          </g>
        );
      })}

      {/* Legend */}
      {BRACKETS.map((b, i) => (
        <g key={b.label}>
          <rect x={90 + (i % 3) * 180} y={392 + Math.floor(i / 3) * 24} width="13" height="13" fill={b.color} />
          <text x={108 + (i % 3) * 180} y={403 + Math.floor(i / 3) * 24} fontSize="12" fill={GS.ink}>{b.label}</text>
        </g>
      ))}
    </svg>
  );
}
