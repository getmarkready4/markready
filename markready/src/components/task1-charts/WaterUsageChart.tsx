// Cambridge 11 Academic, Test 1 — percentage of water used for different
// purposes in six areas of the world. Source: Cambridge_IELTS_11_Academic.pdf p.30.
import { FONT, GS } from "./theme";
import { Pie } from "./pie";

// Category order: [Agricultural, Industrial, Domestic]
const CATS = [
  { label: "Agricultural use", color: GS.navy },
  { label: "Industrial use", color: GS.steel },
  { label: "Domestic use", color: GS.plum },
];
const REGIONS = [
  { name: "North America", v: [39, 48, 13] },
  { name: "South America", v: [71, 19, 10] },
  { name: "Europe", v: [32, 53, 15] },
  { name: "Africa", v: [84, 7, 9] },
  { name: "Central Asia", v: [88, 5, 7] },
  { name: "South East Asia", v: [81, 12, 7] },
];

const W = 720;
const H = 560;
const COLS = 3;
const R = 68;
const colX = [140, 360, 580];
const rowY = [170, 370];
const colors = CATS.map((c) => c.color);

export function WaterUsageChart() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily={FONT}>
      <title>Percentage of water used for different purposes in six areas of the world</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      <text x={W / 2} y="26" fontSize="15" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Percentage of water used for different purposes in six areas of the world
      </text>

      {REGIONS.map((reg, i) => (
        <Pie
          key={reg.name}
          cx={colX[i % COLS]}
          cy={rowY[Math.floor(i / COLS)]}
          r={R}
          values={reg.v}
          colors={colors}
          subtitle={reg.name}
        />
      ))}

      {/* Legend */}
      {CATS.map((c, i) => (
        <g key={c.label}>
          <rect x={180 + i * 130} y={520} width="13" height="13" fill={c.color} />
          <text x={198 + i * 130} y={531} fontSize="12" fill={GS.ink}>{c.label}</text>
        </g>
      ))}
    </svg>
  );
}
