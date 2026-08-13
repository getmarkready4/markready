// Cambridge 17, Test 4 — number of shop closures and openings, 2011-2018.
// Source: CAMBRIDGE-17-TEST.pdf p.93 (values read from the printed graph).
import { FONT, GS } from "./theme";

const YEARS = [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018];
const SERIES = [
  { name: "Closures", color: GS.navy, dash: undefined, values: [6400, 5900, 7200, 6500, 600, 5200, 5000, 5200] },
  { name: "Openings", color: GS.plum, dash: "6 4", values: [8500, 3900, 5000, 6200, 4000, 4000, 4200, 3000] },
];

const W = 660;
const H = 420;
const ML = 54;
const MR = 20;
const MT = 56;
const MB = 40;
const PLOT_W = W - ML - MR;
const PLOT_H = H - MT - MB;
const Y_MAX = 9000;

const xAt = (i: number) => ML + (i / (YEARS.length - 1)) * PLOT_W;
const yAt = (v: number) => MT + PLOT_H - (v / Y_MAX) * PLOT_H;

export function ShopClosuresChart() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily={FONT}>
      <title>Number of shop closures and openings between 2011 and 2018</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      <text x={W / 2} y="22" fontSize="15" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Number of shop closures and openings 2011–2018
      </text>

      {/* Legend */}
      {SERIES.map((s, i) => (
        <g key={s.name}>
          <line x1={W / 2 - 110 + i * 130} y1="40" x2={W / 2 - 86 + i * 130} y2="40" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} />
          <text x={W / 2 - 80 + i * 130} y="44" fontSize="12" fill={GS.ink}>{s.name}</text>
        </g>
      ))}

      {/* Y gridlines + labels */}
      {Array.from({ length: 10 }, (_, k) => k * 1000).map((v) => (
        <g key={v}>
          <line x1={ML} y1={yAt(v)} x2={ML + PLOT_W} y2={yAt(v)} stroke={GS.grid} />
          <text x={ML - 6} y={yAt(v) + 4} fontSize="10" fill={GS.muted} textAnchor="end">{v.toLocaleString()}</text>
        </g>
      ))}

      {/* X labels */}
      {YEARS.map((yr, i) => (
        <text key={yr} x={xAt(i)} y={H - MB + 18} fontSize="11" fill={GS.muted} textAnchor="middle">{yr}</text>
      ))}

      {/* Series */}
      {SERIES.map((s) => (
        <g key={s.name}>
          <path
            d={s.values.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth="2.5"
            strokeDasharray={s.dash}
          />
          {s.values.map((v, i) => (
            <circle key={i} cx={xAt(i)} cy={yAt(v)} r="3.5" fill={s.color} />
          ))}
        </g>
      ))}
    </svg>
  );
}
