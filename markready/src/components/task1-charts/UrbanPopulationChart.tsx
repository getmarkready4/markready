// Cambridge 18 Academic, Test 1 — percentage of the population living in cities
// in four Asian countries, 1970-2040. Source: Cambridge-IELTS-18 p.28.
import { FONT, GS } from "./theme";

const YEARS = [1970, 1980, 1990, 2000, 2010, 2020, 2030, 2040];
const SERIES = [
  { name: "Malaysia", color: GS.navy, dash: "2 4", v: [30, 40, 45, 60, 71, 76, 81, 83] },
  { name: "Philippines", color: GS.plum, dash: "7 5", v: [32, 34, 48, 46, 43, 45, 51, 56] },
  { name: "Indonesia", color: GS.gold, dash: undefined, v: [14, 17, 25, 30, 43, 52, 61, 64] },
  { name: "Thailand", color: GS.steel, dash: "5 3", v: [18, 23, 30, 30, 32, 33, 41, 50] },
];

const W = 690;
const H = 430;
const ML = 46;
const MR = 130;
const MT = 40;
const MB = 46;
const PLOT_W = W - ML - MR;
const PLOT_H = H - MT - MB;
const Y_MAX = 90;
const xAt = (i: number) => ML + (i / (YEARS.length - 1)) * PLOT_W;
const yAt = (v: number) => MT + PLOT_H - (v / Y_MAX) * PLOT_H;

export function UrbanPopulationChart() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily={FONT}>
      <title>Percentage of the population living in cities in four Asian countries, 1970 to 2040</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      <text x={ML + PLOT_W / 2} y="22" fontSize="14" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Percentage of the population living in cities
      </text>

      {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map((v) => (
        <g key={v}>
          <line x1={ML} y1={yAt(v)} x2={ML + PLOT_W} y2={yAt(v)} stroke={GS.grid} />
          <text x={ML - 6} y={yAt(v) + 4} fontSize="10" fill={GS.muted} textAnchor="end">{v}</text>
        </g>
      ))}
      {YEARS.map((yr, i) => (
        <text key={yr} x={xAt(i)} y={MT + PLOT_H + 18} fontSize="10" fill={GS.muted} textAnchor="middle">{yr}</text>
      ))}

      {SERIES.map((s) => (
        <g key={s.name}>
          <path d={s.v.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} />
          {s.v.map((v, i) => (
            <circle key={i} cx={xAt(i)} cy={yAt(v)} r="3" fill={s.color} />
          ))}
        </g>
      ))}

      {/* Legend */}
      {SERIES.map((s, i) => (
        <g key={s.name}>
          <line x1={ML + PLOT_W + 14} y1={MT + 14 + i * 22} x2={ML + PLOT_W + 40} y2={MT + 14 + i * 22} stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} />
          <text x={ML + PLOT_W + 46} y={MT + 18 + i * 22} fontSize="12" fill={GS.ink}>{s.name}</text>
        </g>
      ))}
    </svg>
  );
}
