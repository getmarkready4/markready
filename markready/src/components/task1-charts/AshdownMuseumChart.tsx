// Cambridge 11 Academic, Test 4 — visitors to Ashdown Museum + visitor
// satisfaction before/after refurbishment. Source: Cambridge_IELTS_11_Academic.pdf p.100.
import { FONT, GS, CAT } from "./theme";
import { Pie } from "./pie";

const SAT = [
  { label: "Very satisfied", color: CAT[0] },
  { label: "Satisfied", color: CAT[1] },
  { label: "Dissatisfied", color: CAT[2] },
  { label: "Very dissatisfied", color: CAT[3] },
  { label: "No response", color: CAT[4] },
];
const BEFORE = [15, 30, 40, 10, 5];
const AFTER = [35, 40, 15, 5, 5];
const colors = SAT.map((s) => s.color);

const W = 660;
const H = 560;

export function AshdownMuseumChart() {
  const tx = 70;
  const tw = 520;
  const split = tx + 360;
  const ty = 42;
  const th = 28;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily={FONT}>
      <title>Visitors to Ashdown Museum and visitor satisfaction before and after refurbishment</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />

      {/* Visitor table */}
      <rect x={tx} y={ty} width={tw} height={th * 3} fill="none" stroke={GS.rule} />
      <line x1={tx} y1={ty + th} x2={tx + tw} y2={ty + th} stroke={GS.rule} />
      <line x1={tx} y1={ty + 2 * th} x2={tx + tw} y2={ty + 2 * th} stroke={GS.rule} />
      <line x1={split} y1={ty + th} x2={split} y2={ty + 3 * th} stroke={GS.rule} />
      <text x={tx + tw / 2} y={ty + 19} fontSize="14" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Total number of visitors to Ashdown Museum
      </text>
      <text x={tx + 10} y={ty + th + 19} fontSize="12" fill={GS.ink}>During the year before refurbishment:</text>
      <text x={split + 20} y={ty + th + 19} fontSize="12" fontWeight="600" fill={GS.ink}>74,000</text>
      <text x={tx + 10} y={ty + 2 * th + 19} fontSize="12" fill={GS.ink}>During the year after refurbishment:</text>
      <text x={split + 20} y={ty + 2 * th + 19} fontSize="12" fontWeight="600" fill={GS.ink}>92,000</text>

      {/* Satisfaction pies */}
      <text x={W / 2} y="182" fontSize="14" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Results of surveys of visitor satisfaction
      </text>
      <Pie cx={185} cy={300} r={80} values={BEFORE} colors={colors} subtitle="Year before refurbishment" />
      <Pie cx={475} cy={300} r={80} values={AFTER} colors={colors} subtitle="Year after refurbishment" />

      {/* Legend */}
      {SAT.map((s, i) => (
        <g key={s.label}>
          <rect x={150 + (i % 3) * 180} y={470 + Math.floor(i / 3) * 24} width="13" height="13" fill={s.color} />
          <text x={168 + (i % 3) * 180} y={481 + Math.floor(i / 3) * 24} fontSize="12" fill={GS.ink}>{s.label}</text>
        </g>
      ))}
    </svg>
  );
}
