// Cambridge 17, Test 3 — average weekly spending by families, 1968 vs 2018.
// Source: CAMBRIDGE-17-TEST.pdf p.72 (values read from the printed chart).
import { FONT, GS } from "./theme";

const ROWS = [
  { label: "Food", y1968: 35, y2018: 17 },
  { label: "Housing", y1968: 10, y2018: 19 },
  { label: "Fuel and power", y1968: 6, y2018: 4 },
  { label: "Clothing and footware", y1968: 10, y2018: 5 },
  { label: "Household goods", y1968: 8, y2018: 8 },
  { label: "Personal goods", y1968: 8, y2018: 4 },
  { label: "Transport", y1968: 8, y2018: 14 },
  { label: "Leisure", y1968: 9, y2018: 22 },
];

const W = 660;
const H = 430;
const ML = 150; // label gutter
const MR = 24;
const MT = 58;
const AXIS_MAX = 40;
const plotL = ML;
const plotR = W - MR;
const plotW = plotR - plotL;
const rowH = 42;
const barH = 15;

const xAt = (v: number) => plotL + (v / AXIS_MAX) * plotW;

export function WeeklySpendingChart() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily={FONT}>
      <title>Average weekly spending by families in 1968 and 2018</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      <text x={W / 2} y="22" fontSize="15" fontWeight="700" fill={GS.ink} textAnchor="middle">
        1968 and 2018: average weekly spending by families
      </text>

      {/* Legend */}
      <rect x={ML} y="36" width="13" height="13" fill={GS.navy} />
      <text x={ML + 19} y="47" fontSize="12" fill={GS.muted}>1968</text>
      <rect x={ML + 70} y="36" width="13" height="13" fill={GS.steel} />
      <text x={ML + 89} y="47" fontSize="12" fill={GS.muted}>2018</text>

      {/* Vertical gridlines + x labels */}
      {[0, 5, 10, 15, 20, 25, 30, 35, 40].map((v) => (
        <g key={v}>
          <line x1={xAt(v)} y1={MT} x2={xAt(v)} y2={MT + ROWS.length * rowH} stroke={GS.grid} />
          <text x={xAt(v)} y={MT + ROWS.length * rowH + 18} fontSize="11" fill={GS.muted} textAnchor="middle">{v}</text>
        </g>
      ))}
      <text x={(plotL + plotR) / 2} y={MT + ROWS.length * rowH + 36} fontSize="12" fontWeight="600" fill={GS.ink} textAnchor="middle">
        % of weekly income
      </text>

      {/* Rows */}
      {ROWS.map((r, i) => {
        const y = MT + i * rowH + 4;
        return (
          <g key={r.label}>
            <text x={ML - 8} y={y + barH + 2} fontSize="11" fill={GS.ink} textAnchor="end">{r.label}</text>
            <rect x={plotL} y={y} width={xAt(r.y1968) - plotL} height={barH} fill={GS.navy} />
            <text x={xAt(r.y1968) + 4} y={y + barH - 3} fontSize="10" fill={GS.muted}>{r.y1968}</text>
            <rect x={plotL} y={y + barH + 2} width={xAt(r.y2018) - plotL} height={barH} fill={GS.steel} />
            <text x={xAt(r.y2018) + 4} y={y + 2 * barH - 1} fontSize="10" fill={GS.muted}>{r.y2018}</text>
          </g>
        );
      })}
    </svg>
  );
}
