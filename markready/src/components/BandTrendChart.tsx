"use client";

import { useState } from "react";
import type { CriterionKey } from "@/types/scoring";
import { CRITERION_LABELS } from "@/types/scoring";

interface TrendPoint {
  date: string;
  overall: number | null;
  criteria: Partial<Record<CriterionKey, number>>;
}

export function BandTrendChart({ data }: { data: TrendPoint[] }) {
  const [selectedSeries, setSelectedSeries] = useState<CriterionKey | "overall">(
    "overall"
  );

  if (data.length === 0) return null;

  // Collect all criterion keys that appear anywhere in the data
  const allCriteria = new Set<CriterionKey>();
  for (const point of data) {
    for (const key of Object.keys(point.criteria) as CriterionKey[]) {
      allCriteria.add(key);
    }
  }
  const criteriaOptions = Array.from(allCriteria).sort();

  // Extract values for the selected series
  const values =
    selectedSeries === "overall"
      ? data.map((p) => p.overall)
      : data.map((p) => {
          const val = p.criteria[selectedSeries as CriterionKey];
          return val !== undefined ? val : null;
        });

  // Filter to non-null values
  const validValues = values.filter((v) => v !== null) as number[];

  // Use fixed 0-9 range
  const yMin = 0;
  const yMax = 9;
  const yRange = yMax - yMin;

  // SVG dimensions
  const width = 600;
  const height = 300;
  const marginLeft = 40;
  const marginRight = 20;
  const marginTop = 20;
  const marginBottom = 40;
  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;

  // Convert y value to SVG y coordinate
  const yToSvg = (y: number | null) => {
    if (y === null) return null;
    return marginTop + plotHeight - ((y - yMin) / yRange) * plotHeight;
  };

  // Build path for the line (only when ≥2 non-null points)
  let pathD = "";
  if (validValues.length >= 2) {
    for (let i = 0; i < data.length; i++) {
      const val =
        selectedSeries === "overall"
          ? data[i].overall
          : data[i].criteria[selectedSeries as CriterionKey];

      if (val !== null && val !== undefined) {
        const x =
          data.length === 1
            ? marginLeft + plotWidth / 2
            : marginLeft + (i / (data.length - 1)) * plotWidth;
        const y = yToSvg(val)!;
        if (pathD === "") {
          pathD = `M ${x} ${y}`;
        } else {
          pathD += ` L ${x} ${y}`;
        }
      }
    }
  }

  // X-axis label thinning
  const step = Math.ceil(data.length / 6);
  const shouldShowXLabel = (i: number) => {
    if (i === data.length - 1) return true;
    if (data.length - 1 - i < step) return false;
    return i % step === 0;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedSeries("overall")}
          className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
            selectedSeries === "overall"
              ? "bg-[#1F5C4E] text-white"
              : "bg-[#F2EEE5] text-[#5B6266] hover:bg-[#E4DFD3]"
          }`}
        >
          Overall
        </button>
        {criteriaOptions.map((key) => (
          <button
            key={key}
            onClick={() => setSelectedSeries(key)}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
              selectedSeries === key
                ? "bg-[#1F5C4E] text-white"
                : "bg-[#F2EEE5] text-[#5B6266] hover:bg-[#E4DFD3]"
            }`}
          >
            {CRITERION_LABELS[key]}
          </button>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto border border-[#E4DFD3] rounded-xl bg-white"
      >
        <title>
          {selectedSeries === "overall"
            ? "Overall band trend"
            : `${CRITERION_LABELS[selectedSeries as CriterionKey]} trend`}
        </title>
        {/* Horizontal gridlines */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((band) => {
          const yPos = yToSvg(band)!;
          return (
            <line
              key={`gridline-${band}`}
              x1={marginLeft}
              y1={yPos}
              x2={width - marginRight}
              y2={yPos}
              stroke="#E4DFD3"
              strokeWidth="1"
            />
          );
        })}
        {/* Y-axis labels */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((band) => {
          const yPos = yToSvg(band)!;
          return (
            <text
              key={`label-${band}`}
              x={marginLeft - 5}
              y={yPos + 3}
              textAnchor="end"
              className="text-xs fill-[#5B6266]"
            >
              {band}
            </text>
          );
        })}
        {/* X-axis labels with short dates */}
        {data.map((point, i) => {
          if (!shouldShowXLabel(i)) return null;
          const x =
            data.length === 1
              ? marginLeft + plotWidth / 2
              : marginLeft + (i / (data.length - 1)) * plotWidth;
          const dateStr = new Date(point.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          return (
            <text
              key={`x-label-${i}`}
              x={x}
              y={height - marginBottom + 15}
              textAnchor="middle"
              className="text-xs fill-[#5B6266]"
            >
              {dateStr}
            </text>
          );
        })}
        {/* Line (only if >= 2 non-null points) */}
        {validValues.length >= 2 && (
          <path d={pathD} stroke="#1F5C4E" strokeWidth="2" fill="none" />
        )}
        {/* Dots at true index positions */}
        {data.map((point, i) => {
          const val =
            selectedSeries === "overall"
              ? point.overall
              : point.criteria[selectedSeries as CriterionKey];
          if (val === null || val === undefined) return null;
          const x =
            data.length === 1
              ? marginLeft + plotWidth / 2
              : marginLeft + (i / (data.length - 1)) * plotWidth;
          const y = yToSvg(val)!;
          return <circle key={`dot-${i}`} cx={x} cy={y} r="4" fill="#1F5C4E" />;
        })}
      </svg>
    </div>
  );
}
