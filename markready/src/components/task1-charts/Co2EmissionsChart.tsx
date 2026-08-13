// CO2 emissions in four European countries, 1967-2007 (metric tonnes per person).
// Original rendering of the standard Cambridge data (values pending verification).
// Presentation attributes only so svgToDataUri() rasterizes it faithfully.

const YEARS = [1967, 1977, 1987, 1997, 2007];
const SERIES = [
  // Cambridge 11 Academic, Test 3 — source: Cambridge_IELTS_11_Academic.pdf p.77
  { name: "United Kingdom", color: "#12284B", values: [10.7, 10.7, 10.0, 9.2, 8.7] }, // navy
  { name: "Sweden", color: "#6E1E50", values: [8.6, 10.5, 7.0, 5.9, 5.4] }, // plum
  { name: "Italy", color: "#8FAAC9", values: [4.2, 6.3, 6.7, 7.6, 7.6] }, // steel blue
  { name: "Portugal", color: "#B4894A", values: [1.2, 2.2, 3.2, 5.3, 5.4] }, // gold
];

const INK = "#23282B";
const MUTED = "#5B6266";
const GRID = "#E4DFD3";

const W = 690;
const H = 400;
const ML = 46;
const MR = 168;
const MT = 28;
const MB = 44;
const PLOT_W = W - ML - MR;
const PLOT_H = H - MT - MB;
const Y_MAX = 12;

const xAt = (i: number) => ML + (i / (YEARS.length - 1)) * PLOT_W;
const yAt = (v: number) => MT + PLOT_H - (v / Y_MAX) * PLOT_H;

export function Co2EmissionsChart() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily="Arial, Helvetica, sans-serif">
      <title>Carbon dioxide emissions in four European countries between 1967 and 2007</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
      <text x={ML} y="16" fontSize="12" fill={MUTED}>Metric tonnes per person</text>

      {/* Y gridlines + labels */}
      {[0, 2, 4, 6, 8, 10, 12].map((v) => (
        <g key={v}>
          <line x1={ML} y1={yAt(v)} x2={ML + PLOT_W} y2={yAt(v)} stroke={GRID} />
          <text x={ML - 6} y={yAt(v) + 4} fontSize="11" fill={MUTED} textAnchor="end">{v}</text>
        </g>
      ))}

      {/* X labels */}
      {YEARS.map((yr, i) => (
        <text key={yr} x={xAt(i)} y={H - MB + 18} fontSize="11" fill={MUTED} textAnchor="middle">{yr}</text>
      ))}

      {/* Series */}
      {SERIES.map((s) => {
        const d = s.values.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" />
            {s.values.map((v, i) => (
              <circle key={i} cx={xAt(i)} cy={yAt(v)} r="3.5" fill={s.color} />
            ))}
          </g>
        );
      })}

      {/* Legend */}
      {SERIES.map((s, i) => (
        <g key={s.name}>
          <line x1={ML + PLOT_W + 16} y1={MT + 12 + i * 22} x2={ML + PLOT_W + 40} y2={MT + 12 + i * 22} stroke={s.color} strokeWidth="2.5" />
          <circle cx={ML + PLOT_W + 28} cy={MT + 12 + i * 22} r="3.5" fill={s.color} />
          <text x={ML + PLOT_W + 46} y={MT + 16 + i * 22} fontSize="12" fill={INK}>{s.name}</text>
        </g>
      ))}
    </svg>
  );
}
