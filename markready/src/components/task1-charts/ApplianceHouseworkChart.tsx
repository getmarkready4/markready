// Cambridge 16 Academic, Test 1 — ownership of electrical appliances and time
// spent on housework, 1920-2019. Source: Cambridge IELTS 16 Academic p.30.
import { FONT, GS } from "./theme";

const YEARS = [1920, 1940, 1960, 1980, 2000, 2019];
const APPLIANCES = [
  { name: "Washing machine", color: GS.navy, dash: undefined, v: [40, 60, 70, 64, 70, 75] },
  { name: "Refrigerator", color: GS.steel, dash: undefined, v: [3, 55, 90, 100, 100, 100] },
  { name: "Vacuum cleaner", color: GS.plum, dash: "6 4", v: [30, 50, 70, 90, 100, 100] },
];
const HOURS = [50, 35, 20, 15, 15, 11];

const W = 680;
const H = 700;
const ML = 52;
const MR = 24;
const plotL = ML;
const plotW = W - ML - MR;
const xAt = (i: number) => plotL + (i / (YEARS.length - 1)) * plotW;

// Top chart (appliances, 0-100)
const t = { top: 60, h: 230, max: 100 };
const tY = (v: number) => t.top + t.h - (v / t.max) * t.h;
// Bottom chart (hours, 0-60)
const b = { top: 430, h: 150, max: 60 };
const bY = (v: number) => b.top + b.h - (v / b.max) * b.h;

export function ApplianceHouseworkChart() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" fontFamily={FONT}>
      <title>Ownership of electrical appliances and hours of housework per week, 1920 to 2019</title>
      <rect x="0" y="0" width={W} height={H} fill="#ffffff" />

      {/* --- Top: appliances --- */}
      <text x={W / 2} y="28" fontSize="14" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Percentage of households with electrical appliances (1920–2019)
      </text>
      {[0, 20, 40, 60, 80, 100].map((v) => (
        <g key={v}>
          <line x1={plotL} y1={tY(v)} x2={plotL + plotW} y2={tY(v)} stroke={GS.grid} />
          <text x={plotL - 6} y={tY(v) + 4} fontSize="10" fill={GS.muted} textAnchor="end">{v}</text>
        </g>
      ))}
      {YEARS.map((yr, i) => (
        <text key={yr} x={xAt(i)} y={t.top + t.h + 16} fontSize="10" fill={GS.muted} textAnchor="middle">{yr}</text>
      ))}
      {APPLIANCES.map((s) => (
        <g key={s.name}>
          <path d={s.v.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${tY(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} />
          {s.v.map((v, i) => <circle key={i} cx={xAt(i)} cy={tY(v)} r="3" fill={s.color} />)}
        </g>
      ))}
      {APPLIANCES.map((s, i) => (
        <g key={s.name}>
          <line x1={plotL + 30 + i * 200} y1={t.top + t.h + 40} x2={plotL + 54 + i * 200} y2={t.top + t.h + 40} stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} />
          <text x={plotL + 60 + i * 200} y={t.top + t.h + 44} fontSize="11.5" fill={GS.ink}>{s.name}</text>
        </g>
      ))}

      {/* --- Bottom: housework hours --- */}
      <text x={W / 2} y={b.top - 24} fontSize="14" fontWeight="700" fill={GS.ink} textAnchor="middle">
        Number of hours of housework per week, per household (1920–2019)
      </text>
      {[0, 20, 40, 60].map((v) => (
        <g key={v}>
          <line x1={plotL} y1={bY(v)} x2={plotL + plotW} y2={bY(v)} stroke={GS.grid} />
          <text x={plotL - 6} y={bY(v) + 4} fontSize="10" fill={GS.muted} textAnchor="end">{v}</text>
        </g>
      ))}
      {YEARS.map((yr, i) => (
        <text key={yr} x={xAt(i)} y={b.top + b.h + 16} fontSize="10" fill={GS.muted} textAnchor="middle">{yr}</text>
      ))}
      <path d={HOURS.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${bY(v)}`).join(" ")} fill="none" stroke={GS.gold} strokeWidth="2.5" />
      {HOURS.map((v, i) => <circle key={i} cx={xAt(i)} cy={bY(v)} r="3" fill={GS.gold} />)}
      <line x1={plotL + 30} y1={b.top + b.h + 40} x2={plotL + 54} y2={b.top + b.h + 40} stroke={GS.gold} strokeWidth="2.5" />
      <text x={plotL + 60} y={b.top + b.h + 44} fontSize="11.5" fill={GS.ink}>Hours per week</text>
    </svg>
  );
}
