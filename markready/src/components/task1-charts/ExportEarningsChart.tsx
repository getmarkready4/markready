// Cambridge 14 Academic, Test 2 — value of one country's exports by category,
// 2015 vs 2016, plus percentage change table.
// Source: cambridge-IELTS-test-14-academic p.50.
import { FONT, GS } from "./theme";

const ROWS = [
  { label: "Petroleum products", y2015: 61, y2016: 63, change: "▲ 3%" },
  { label: "Engineered goods", y2015: 57, y2016: 62, change: "▲ 8.5%" },
  { label: "Gems and jewellery", y2015: 43, y2016: 41, change: "▼ 5.18%" },
  { label: "Agricultural products", y2015: 31, y2016: 32, change: "▲ 0.81%" },
  { label: "Textiles", y2015: 26, y2016: 30, change: "▲ 15.24%" },
];

const W = 680;
const H = 620;
const ML = 50;
const MR = 20;
const MT = 60;
const AXIS_MAX = 70;
const plotB = 300; // baseline y
const plotT = MT;
const plotH = plotB - plotT;
const plotL = ML;
const plotR = W - MR;
const plotW = plotR - plotL;

const yAt = (v: number) => plotB - (v / AXIS_MAX) * plotH;

export function ExportEarningsChart() {
  const groupW = plotW / ROWS.length;
  const barW = groupW / 3.2;

  // Table geometry
  const tx = 120;
  const tw = 440;
  const split = tx + 300;
  const ty = 360;
  const th = 26;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily={FONT}>
      <title>Value of exports by category in 2015 and 2016, with percentage change</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      <text x={W / 2} y="24" fontSize="15" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Export Earnings (2015–2016)
      </text>

      {/* Legend */}
      <rect x={W / 2 - 70} y="36" width="13" height="13" fill={GS.navy} />
      <text x={W / 2 - 50} y="47" fontSize="12" fill={GS.ink}>2015</text>
      <rect x={W / 2 + 10} y="36" width="13" height="13" fill={GS.steel} />
      <text x={W / 2 + 30} y="47" fontSize="12" fill={GS.ink}>2016</text>

      {/* Y axis */}
      {[0, 10, 20, 30, 40, 50, 60, 70].map((v) => (
        <g key={v}>
          <line x1={plotL} y1={yAt(v)} x2={plotR} y2={yAt(v)} stroke={GS.grid} />
          <text x={plotL - 6} y={yAt(v) + 4} fontSize="10" fill={GS.muted} textAnchor="end">{v}</text>
        </g>
      ))}
      <text x={16} y={(plotT + plotB) / 2} fontSize="11" fill={GS.muted} textAnchor="middle" transform={`rotate(-90 16 ${(plotT + plotB) / 2})`}>$ billions</text>

      {/* Grouped bars */}
      {ROWS.map((r, i) => {
        const gx = plotL + i * groupW + groupW / 2;
        return (
          <g key={r.label}>
            <rect x={gx - barW - 2} y={yAt(r.y2015)} width={barW} height={plotB - yAt(r.y2015)} fill={GS.navy} />
            <rect x={gx + 2} y={yAt(r.y2016)} width={barW} height={plotB - yAt(r.y2016)} fill={GS.steel} />
            <text x={gx} y={plotB + 16} fontSize="10" fill={GS.ink} textAnchor="middle">{r.label.split(" ")[0]}</text>
            <text x={gx} y={plotB + 28} fontSize="10" fill={GS.ink} textAnchor="middle">{r.label.split(" ").slice(1).join(" ")}</text>
          </g>
        );
      })}

      {/* Percentage change table */}
      <text x={W / 2} y={ty - 8} fontSize="12" fontWeight="700" fill={GS.ink} textAnchor="middle">Percentage change in values (2015–2016)</text>
      <rect x={tx} y={ty} width={tw} height={th * ROWS.length} fill="none" stroke={GS.rule} />
      <line x1={split} y1={ty} x2={split} y2={ty + th * ROWS.length} stroke={GS.rule} />
      {ROWS.map((r, i) => (
        <g key={r.label}>
          {i > 0 && <line x1={tx} y1={ty + i * th} x2={tx + tw} y2={ty + i * th} stroke={GS.rule} />}
          <text x={tx + 10} y={ty + i * th + 17} fontSize="12" fill={GS.ink}>{r.label}</text>
          <text x={split + 20} y={ty + i * th + 17} fontSize="12" fill={r.change.startsWith("▼") ? GS.plum : GS.navy}>{r.change}</text>
        </g>
      ))}
    </svg>
  );
}
