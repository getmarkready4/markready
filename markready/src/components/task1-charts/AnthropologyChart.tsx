// Cambridge 15 Academic, Test 4 — destinations of Anthropology graduates (pie)
// plus salaries after five years (table).
// Source: cambridge-IELTS-test15-academic p.94.
import { FONT, GS, CAT } from "./theme";
import { Pie } from "./pie";

const DEST = [
  { label: "Full-time work", color: CAT[0] },
  { label: "Part-time work", color: CAT[1] },
  { label: "Part-time work + postgrad study", color: CAT[2] },
  { label: "Full-time postgrad study", color: CAT[3] },
  { label: "Unemployed", color: CAT[4] },
  { label: "Not known", color: CAT[5] },
];
const DEST_V = [52, 15, 5, 8, 12, 8];

const SAL_COLS = ["$25,000–49,999", "$50,000–74,999", "$75,000–99,999", "$100,000+"];
const SAL_ROWS = [
  ["Freelance consultants", "5%", "15%", "40%", "40%"],
  ["Government sector", "5%", "15%", "30%", "50%"],
  ["Private companies", "10%", "35%", "25%", "30%"],
];

const W = 680;
const H = 640;
const colors = DEST.map((d) => d.color);

export function AnthropologyChart() {
  // Table geometry
  const tx = 60;
  const tw = 560;
  const c0 = 190; // first column width (label)
  const colW = (tw - c0) / 4;
  const ty = 430;
  const th = 30;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily={FONT}>
      <title>Destinations of Anthropology graduates and their salaries after five years</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      <text x={W / 2} y="24" fontSize="14" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Destination of Anthropology graduates (from one university)
      </text>

      <Pie cx={230} cy={175} r={110} values={DEST_V} colors={colors} />
      {/* Legend — two columns */}
      {DEST.map((d, i) => (
        <g key={d.label}>
          <rect x={400} y={110 + i * 26} width="13" height="13" fill={d.color} />
          <text x={418} y={121 + i * 26} fontSize="11.5" fill={GS.ink}>{d.label}</text>
        </g>
      ))}

      {/* Salary table */}
      <text x={W / 2} y={ty - 12} fontSize="13" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Salaries of Anthropology graduates (after 5 years&apos; work)
      </text>
      <rect x={tx} y={ty} width={tw} height={th * 4} fill="none" stroke={GS.rule} />
      {[1, 2, 3].map((i) => (
        <line key={i} x1={tx} y1={ty + i * th} x2={tx + tw} y2={ty + i * th} stroke={GS.rule} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={tx + c0 + i * colW} y1={ty} x2={tx + c0 + i * colW} y2={ty + th * 4} stroke={GS.rule} />
      ))}
      {/* header */}
      <text x={tx + 10} y={ty + 19} fontSize="11" fontWeight="700" fill={GS.ink}>Type of employment</text>
      {SAL_COLS.map((c, i) => (
        <text key={c} x={tx + c0 + i * colW + colW / 2} y={ty + 19} fontSize="10" fontWeight="700" fill={GS.ink} textAnchor="middle">{c}</text>
      ))}
      {/* rows */}
      {SAL_ROWS.map((row, r) => (
        <g key={row[0]}>
          <text x={tx + 10} y={ty + (r + 1) * th + 19} fontSize="11" fill={GS.ink}>{row[0]}</text>
          {row.slice(1).map((cell, c) => (
            <text key={c} x={tx + c0 + c * colW + colW / 2} y={ty + (r + 1) * th + 19} fontSize="11" fill={GS.ink} textAnchor="middle">{cell}</text>
          ))}
        </g>
      ))}
    </svg>
  );
}
