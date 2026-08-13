// Cambridge 15 Academic, Test 1 — coffee and tea buying/drinking habits in five
// Australian cities. Source: cambridge-IELTS-test15-academic p.29.
import { FONT, GS } from "./theme";

const SERIES = [
  { label: "Bought fresh coffee in last 4 weeks", color: GS.navy },
  { label: "Bought instant coffee in last 4 weeks", color: GS.steel },
  { label: "Went to a café for coffee or tea in last 4 weeks", color: GS.plum },
];
const CITIES = [
  { name: "Sydney", v: [44, 45.5, 61] },
  { name: "Melbourne", v: [42, 48, 63] },
  { name: "Brisbane", v: [34, 52.5, 55] },
  { name: "Adelaide", v: [34, 49.5, 49] },
  { name: "Hobart", v: [38, 54, 62.5] },
];

const W = 680;
const H = 500;
const ML = 48;
const MR = 20;
const MIN = 20;
const MAX = 70;
const plotB = 360;
const plotT = 56;
const plotH = plotB - plotT;
const plotL = ML;
const plotR = W - MR;
const plotW = plotR - plotL;
const yAt = (v: number) => plotB - ((v - MIN) / (MAX - MIN)) * plotH;

export function CoffeeTeaChart() {
  const groupW = plotW / CITIES.length;
  const barW = groupW / 4.2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily={FONT}>
      <title>Coffee and tea buying and drinking habits in five cities in Australia</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      <text x={W / 2} y="26" fontSize="14" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Coffee and tea buying and drinking habits in five cities in Australia
      </text>

      {[20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70].map((v) => (
        <g key={v}>
          <line x1={plotL} y1={yAt(v)} x2={plotR} y2={yAt(v)} stroke={GS.grid} />
          <text x={plotL - 6} y={yAt(v) + 4} fontSize="10" fill={GS.muted} textAnchor="end">{v}%</text>
        </g>
      ))}
      <text x={14} y={(plotT + plotB) / 2} fontSize="11" fill={GS.muted} textAnchor="middle" transform={`rotate(-90 14 ${(plotT + plotB) / 2})`}>Percentage of city residents</text>

      {CITIES.map((c, i) => {
        const gx = plotL + i * groupW + groupW / 2;
        return (
          <g key={c.name}>
            {c.v.map((val, s) => (
              <rect key={s} x={gx + (s - 1.5) * barW} y={yAt(val)} width={barW} height={plotB - yAt(val)} fill={SERIES[s].color} />
            ))}
            <text x={gx} y={plotB + 16} fontSize="11" fill={GS.ink} textAnchor="middle">{c.name}</text>
          </g>
        );
      })}

      {/* Legend */}
      {SERIES.map((s, i) => (
        <g key={s.label}>
          <rect x={70} y={410 + i * 22} width="13" height="13" fill={s.color} />
          <text x={90} y={421 + i * 22} fontSize="12" fill={GS.ink}>{s.label}</text>
        </g>
      ))}
    </svg>
  );
}
