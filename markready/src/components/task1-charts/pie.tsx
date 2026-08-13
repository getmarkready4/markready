// Shared pie-chart helpers. <Pie> returns a <g> (no <svg> wrapper) so several
// pies plus a legend can live inside one parent <svg> and rasterize together.
import { labelOn } from "./theme";

// Slice path; angles measured clockwise from 12 o'clock.
export function slicePath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

export function Pie({
  cx,
  cy,
  r,
  values,
  colors,
  subtitle,
}: {
  cx: number;
  cy: number;
  r: number;
  values: number[];
  colors: string[];
  subtitle?: string;
}) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  // Cumulative start of each slice (pure — no reassignment during render).
  const starts = values.map((_, i) => values.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <g>
      {values.map((v, i) => {
        const a0 = (starts[i] / total) * 2 * Math.PI;
        const a1 = ((starts[i] + v) / total) * 2 * Math.PI;
        const mid = (a0 + a1) / 2;
        const lr = r * 0.62;
        const lx = cx + lr * Math.sin(mid);
        const ly = cy - lr * Math.cos(mid);
        return (
          <g key={i}>
            <path d={slicePath(cx, cy, r, a0, a1)} fill={colors[i]} stroke="#ffffff" strokeWidth="1.5" />
            {v > 0 && (
              <text x={lx} y={ly + 4} fontSize="11" fontWeight="600" fill={labelOn(colors[i])} textAnchor="middle">
                {v}%
              </text>
            )}
          </g>
        );
      })}
      {subtitle && (
        <text x={cx} y={cy + r + 20} fontSize="12" fontWeight="700" fill="#23282B" textAnchor="middle">
          {subtitle}
        </text>
      )}
    </g>
  );
}
