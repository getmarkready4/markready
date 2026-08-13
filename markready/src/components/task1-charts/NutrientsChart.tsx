// Cambridge 14 Academic, Test 1 — average percentages of sodium, saturated fat
// and added sugar in typical US meals, by meal type.
// Source: cambridge-IELTS-test-14-academic p.29.
import { FONT, GS, CAT } from "./theme";
import { Pie } from "./pie";

const MEALS = [
  { label: "Breakfast", color: CAT[0] },
  { label: "Lunch", color: CAT[1] },
  { label: "Dinner", color: CAT[2] },
  { label: "Snacks", color: CAT[3] },
];
// order: [Breakfast, Lunch, Dinner, Snacks]
const NUTRIENTS = [
  { name: "Sodium", cx: 190, cy: 215, v: [14, 29, 43, 14] },
  { name: "Saturated fat", cx: 490, cy: 215, v: [16, 26, 37, 21] },
  { name: "Added sugar", cx: 340, cy: 430, v: [16, 19, 23, 42] },
];
const colors = MEALS.map((m) => m.color);

const W = 680;
const H = 600;

export function NutrientsChart() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily={FONT}>
      <title>Average percentages of sodium, saturated fat and added sugar in typical US meals</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      <text x={W / 2} y="24" fontSize="14" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Average percentages of sodium, saturated fats and added
      </text>
      <text x={W / 2} y="44" fontSize="14" fontWeight="700" fill={GS.ink} textAnchor="middle">
        sugars in typical meals consumed in the USA
      </text>

      {NUTRIENTS.map((n) => (
        <g key={n.name}>
          <text x={n.cx} y={n.cy - 92} fontSize="13" fontWeight="700" fill={GS.ink} textAnchor="middle">{n.name}</text>
          <Pie cx={n.cx} cy={n.cy} r={80} values={n.v} colors={colors} />
        </g>
      ))}

      {/* Legend */}
      {MEALS.map((m, i) => (
        <g key={m.label}>
          <rect x={250 + (i % 2) * 120} y={540 + Math.floor(i / 2) * 22} width="13" height="13" fill={m.color} />
          <text x={268 + (i % 2) * 120} y={551 + Math.floor(i / 2) * 22} fontSize="12" fill={GS.ink}>{m.label}</text>
        </g>
      ))}
    </svg>
  );
}
