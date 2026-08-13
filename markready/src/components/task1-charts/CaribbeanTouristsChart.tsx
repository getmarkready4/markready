// Cambridge 15 Academic, Test 2 — number of tourists visiting a Caribbean
// island, 2010-2017. Source: cambridge-IELTS-test15-academic p.50.
import { FONT, GS } from "./theme";

const YEARS = [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017];
const SERIES = [
  { name: "Total", color: GS.navy, dash: undefined, v: [1.0, 1.25, 1.5, 2.0, 2.5, 2.75, 2.75, 3.5] },
  { name: "Visitors staying on island", color: GS.plum, dash: "7 5", v: [0.75, 0.75, 1.25, 1.5, 1.5, 1.5, 1.25, 1.5] },
  { name: "Visitors staying on cruise ships", color: GS.steel, dash: "2 4", v: [0.25, 0.5, 0.25, 0.5, 1.0, 1.25, 1.5, 2.0] },
];

const W = 680;
const H = 440;
const ML = 46;
const MR = 20;
const MT = 52;
const MB = 66;
const PLOT_W = W - ML - MR;
const PLOT_H = H - MT - MB;
const Y_MAX = 4;
const xAt = (i: number) => ML + (i / (YEARS.length - 1)) * PLOT_W;
const yAt = (v: number) => MT + PLOT_H - (v / Y_MAX) * PLOT_H;

export function CaribbeanTouristsChart() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily={FONT}>
      <title>Number of tourists visiting a Caribbean island between 2010 and 2017</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      <text x={W / 2} y="24" fontSize="15" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Number of tourists visiting a Caribbean island (2010–2017)
      </text>

      {[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((v) => (
        <g key={v}>
          <line x1={ML} y1={yAt(v)} x2={ML + PLOT_W} y2={yAt(v)} stroke={GS.grid} />
          <text x={ML - 6} y={yAt(v) + 4} fontSize="10" fill={GS.muted} textAnchor="end">{v}</text>
        </g>
      ))}
      <text x={13} y={MT + PLOT_H / 2} fontSize="11" fill={GS.muted} textAnchor="middle" transform={`rotate(-90 13 ${MT + PLOT_H / 2})`}>Millions of visitors</text>
      {YEARS.map((yr, i) => (
        <text key={yr} x={xAt(i)} y={MT + PLOT_H + 18} fontSize="11" fill={GS.muted} textAnchor="middle">{yr}</text>
      ))}

      {SERIES.map((s) => (
        <g key={s.name}>
          <path d={s.v.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} />
          {s.v.map((v, i) => (
            <circle key={i} cx={xAt(i)} cy={yAt(v)} r="3.5" fill={s.color} />
          ))}
        </g>
      ))}

      {/* Legend */}
      {SERIES.map((s, i) => (
        <g key={s.name}>
          <line x1={ML + i * 215} y1={H - 26} x2={ML + i * 215 + 22} y2={H - 26} stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} />
          <text x={ML + i * 215 + 28} y={H - 22} fontSize="10.5" fill={GS.ink}>{s.name}</text>
        </g>
      ))}
    </svg>
  );
}
