// Cambridge 18 Academic, Test 4 — average monthly change in prices of copper,
// nickel and zinc during 2014. Source: Cambridge-IELTS-18 p.95.
import { FONT, GS } from "./theme";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const SERIES = [
  { name: "Copper", color: GS.steel, dash: "3 4", v: [2, 1, 0.5, 0.5, -0.5, -0.5, 1, 1, 1, 0.5, 0.5, 1.5] },
  { name: "Nickel", color: GS.navy, dash: undefined, v: [6, 4, 1, 1, 0.5, -3, -1, -1, -1, -2, 1, 1] },
  { name: "Zinc", color: GS.plum, dash: "6 4", v: [1, 3, 2, 1.5, 1, -1, -0.5, -0.5, -0.5, -1, 1.5, 2] },
];

const W = 680;
const H = 440;
const ML = 52;
const MR = 20;
const MT = 56;
const MB = 60;
const PLOT_W = W - ML - MR;
const PLOT_H = H - MT - MB;
const Y_MIN = -4;
const Y_MAX = 7;
const xAt = (i: number) => ML + (i / (MONTHS.length - 1)) * PLOT_W;
const yAt = (v: number) => MT + PLOT_H - ((v - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H;

export function MetalPricesChart() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily={FONT}>
      <title>Average monthly change in the prices of copper, nickel and zinc during 2014</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      <text x={ML + PLOT_W / 2} y="24" fontSize="14" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Average monthly change in prices of copper, nickel and zinc (2014)
      </text>

      {[-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7].map((v) => (
        <g key={v}>
          <line x1={ML} y1={yAt(v)} x2={ML + PLOT_W} y2={yAt(v)} stroke={v === 0 ? GS.rule : GS.grid} strokeWidth={v === 0 ? 1.5 : 1} />
          <text x={ML - 6} y={yAt(v) + 4} fontSize="10" fill={GS.muted} textAnchor="end">{v}</text>
        </g>
      ))}
      <text x={16} y={MT + PLOT_H / 2} fontSize="10.5" fill={GS.muted} textAnchor="middle" transform={`rotate(-90 16 ${MT + PLOT_H / 2})`}>% change vs previous month</text>
      {MONTHS.map((m, i) => (
        <text key={i} x={xAt(i)} y={MT + PLOT_H + 18} fontSize="11" fill={GS.muted} textAnchor="middle">{m}</text>
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
          <line x1={ML + 40 + i * 150} y1={H - 26} x2={ML + 64 + i * 150} y2={H - 26} stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} />
          <text x={ML + 70 + i * 150} y={H - 22} fontSize="12" fill={GS.ink}>{s.name}</text>
        </g>
      ))}
    </svg>
  );
}
