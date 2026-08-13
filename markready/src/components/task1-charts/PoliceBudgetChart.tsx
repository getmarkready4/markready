// Cambridge 17, Test 2 — police budget 2017-2018: source table + distribution pies.
// Source: CAMBRIDGE-17-TEST.pdf p.50 (values read from the printed table and pies).
import { FONT, GS } from "./theme";
import { Pie } from "./pie";

const TABLE = {
  head: ["Sources", "2017", "2018"],
  rows: [
    ["National Government", "175.5", "177.8"],
    ["Local Taxes", "91.2", "102.3"],
    ["Other sources (eg grants)", "38", "38.5"],
    ["Total", "304.7", "318.6"],
  ],
};

const SLICES = [
  { name: "Salaries (officers and staff)", color: GS.navy },
  { name: "Technology", color: GS.steel },
  { name: "Buildings and transport", color: GS.plum },
];
const PIES = [
  { year: "2017", values: [75, 8, 17] },
  { year: "2018", values: [69, 14, 17] },
];

const W = 660;
const H = 560;
const colors = SLICES.map((s) => s.color);

export function PoliceBudgetChart() {
  // Table geometry
  const tx = 60;
  const tw = 540;
  const col = [tx, tx + 260, tx + 400, tx + tw];
  const th = 26;
  const ty = 40;
  const nRows = TABLE.rows.length + 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily={FONT}>
      <title>Police budget 2017 to 2018: sources of funding and how the money was spent</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      <text x={W / 2} y="24" fontSize="15" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Police Budget 2017–2018 (in £m)
      </text>

      {/* Table grid */}
      <rect x={tx} y={ty} width={tw} height={nRows * th} fill="none" stroke={GS.rule} />
      {Array.from({ length: nRows - 1 }, (_, i) => (
        <line key={`h${i}`} x1={tx} y1={ty + (i + 1) * th} x2={tx + tw} y2={ty + (i + 1) * th} stroke={GS.rule} />
      ))}
      {[col[1], col[2]].map((x, i) => (
        <line key={`v${i}`} x1={x} y1={ty} x2={x} y2={ty + nRows * th} stroke={GS.rule} />
      ))}
      {/* Header */}
      {TABLE.head.map((h, i) => (
        <text key={h} x={i === 0 ? tx + 10 : (col[i] + col[i + 1]) / 2} y={ty + 17} fontSize="12" fontWeight="700" fill={GS.ink} textAnchor={i === 0 ? "start" : "middle"}>{h}</text>
      ))}
      {/* Rows */}
      {TABLE.rows.map((row, r) => (
        <g key={row[0]}>
          {row.map((cell, c) => (
            <text
              key={c}
              x={c === 0 ? tx + 10 : (col[c] + col[c + 1]) / 2}
              y={ty + (r + 1) * th + 17}
              fontSize="12"
              fontWeight={row[0] === "Total" ? 700 : 400}
              fill={GS.ink}
              textAnchor={c === 0 ? "start" : "middle"}
            >
              {cell}
            </text>
          ))}
        </g>
      ))}

      {/* Pies */}
      <text x={W / 2} y={ty + nRows * th + 46} fontSize="13" fontWeight="700" fill={GS.ink} textAnchor="middle">
        How the money was spent
      </text>
      {PIES.map((pie, pi) => (
        <Pie key={pie.year} cx={pi === 0 ? 200 : 460} cy={380} r={82} values={pie.values} colors={colors} subtitle={pie.year} />
      ))}

      {/* Legend */}
      {SLICES.map((s, i) => (
        <g key={s.name}>
          <rect x={180} y={490 + i * 22} width="13" height="13" fill={s.color} />
          <text x={200} y={501 + i * 22} fontSize="12" fill={GS.ink}>{s.name}</text>
        </g>
      ))}
    </svg>
  );
}
