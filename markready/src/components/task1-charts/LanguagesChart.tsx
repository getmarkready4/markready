// Cambridge 11 Academic, Test 2 — proportions of British students at one
// university able to speak other languages, 2000 vs 2010.
// Source: Cambridge_IELTS_11_Academic.pdf p.54.
import { FONT, GS, CAT } from "./theme";
import { Pie } from "./pie";

const CATS = [
  { label: "No other language", color: CAT[0] },
  { label: "French only", color: CAT[1] },
  { label: "German only", color: CAT[2] },
  { label: "Spanish only", color: CAT[3] },
  { label: "Another language", color: CAT[4] },
  { label: "Two other languages", color: CAT[5] },
];
const Y2000 = [20, 15, 10, 30, 15, 10];
const Y2010 = [35, 10, 10, 10, 20, 15];
const colors = CATS.map((c) => c.color);

const W = 680;
const H = 560;

export function LanguagesChart() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily={FONT}>
      <title>Proportions of British students able to speak other languages, 2000 and 2010</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      <text x={W / 2} y="26" fontSize="15" fontWeight="700" fill={GS.ink} textAnchor="middle">
        % of British students able to speak languages other than English
      </text>

      <Pie cx={185} cy={210} r={92} values={Y2000} colors={colors} subtitle="2000" />
      <Pie cx={495} cy={210} r={92} values={Y2010} colors={colors} subtitle="2010" />

      {/* Legend — two rows of three */}
      {CATS.map((c, i) => (
        <g key={c.label}>
          <rect x={90 + (i % 3) * 190} y={470 + Math.floor(i / 3) * 26} width="13" height="13" fill={c.color} />
          <text x={108 + (i % 3) * 190} y={481 + Math.floor(i / 3) * 26} fontSize="12" fill={GS.ink}>{c.label}</text>
        </g>
      ))}
    </svg>
  );
}
