"use client";

import { GlassCard, GlassCardHeader } from "./ui/GlassCard";

interface DataPoint {
  timestamp: string;
  avg_delay: number;
  max_delay: number;
  min_delay: number;
  count: number;
}

interface TimeSeriesChartProps {
  data: DataPoint[];
  loading?: boolean;
}

export function TimeSeriesChart({ data, loading = false }: TimeSeriesChartProps) {
  if (loading) {
    return (
      <GlassCard variant="strong" className="col-span-full lg:col-span-2">
        <GlassCardHeader title="Delay Timeline" subtitle="Loading..." />
        <div className="skeleton h-64 rounded-xl" />
      </GlassCard>
    );
  }

  // Calculate chart dimensions and scale
  const maxDelay = Math.max(...data.map((d) => d.max_delay), 10);
  const chartHeight = 200;
  const chartWidth = 100; // percentage

  // Simple SVG chart
  const points = data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * chartWidth,
    y: chartHeight - (d.avg_delay / maxDelay) * chartHeight,
    data: d,
  }));

  const linePath = points.length > 0
    ? `M ${points.map((p) => `${p.x},${p.y}`).join(" L ")}`
    : "";

  const areaPath = points.length > 0
    ? `M ${points[0].x},${chartHeight} ${points.map((p) => `L ${p.x},${p.y}`).join(" ")} L ${points[points.length - 1].x},${chartHeight} Z`
    : "";

  return (
    <GlassCard variant="strong" className="col-span-full lg:col-span-2">
      <GlassCardHeader
        title="Delay Timeline"
        subtitle="Average delays over time"
        action={
          <div className="flex gap-2">
            {["24h", "7d", "30d"].map((period) => (
              <button
                key={period}
                className="px-3 py-1 text-xs rounded-full bg-white/5 text-muted hover:bg-white/10 hover:text-foreground transition-all-200"
              >
                {period}
              </button>
            ))}
          </div>
        }
      />
      
      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted">
          No data available
        </div>
      ) : (
        <div className="relative h-64">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-muted">
            <span>{maxDelay.toFixed(0)}m</span>
            <span>{(maxDelay / 2).toFixed(0)}m</span>
            <span>0m</span>
          </div>
          
          {/* Chart area */}
          <div className="absolute left-14 right-0 top-0 bottom-8">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="none"
              className="w-full h-full"
            >
              {/* Grid lines */}
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(6, 182, 212)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="rgb(6, 182, 212)" stopOpacity="0" />
                </linearGradient>
              </defs>
              
              {/* Horizontal grid */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                <line
                  key={ratio}
                  x1="0"
                  y1={chartHeight * ratio}
                  x2={chartWidth}
                  y2={chartHeight * ratio}
                  stroke="rgba(148, 163, 184, 0.1)"
                  strokeWidth="0.5"
                />
              ))}
              
              {/* Area fill */}
              <path
                d={areaPath}
                fill="url(#areaGradient)"
              />
              
              {/* Line */}
              <path
                d={linePath}
                fill="none"
                stroke="rgb(6, 182, 212)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Data points */}
              {points.map((point, i) => (
                <g key={i}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="3"
                    fill="rgb(6, 182, 212)"
                    className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                  />
                </g>
              ))}
            </svg>
          </div>
          
          {/* X-axis labels */}
          <div className="absolute left-14 right-0 bottom-0 h-8 flex justify-between text-xs text-muted">
            {data.length > 0 && (
              <>
                <span>{formatTime(data[0].timestamp)}</span>
                {data.length > 2 && (
                  <span>{formatTime(data[Math.floor(data.length / 2)].timestamp)}</span>
                )}
                <span>{formatTime(data[data.length - 1].timestamp)}</span>
              </>
            )}
          </div>
          
          {/* Legend */}
          <div className="absolute top-2 right-2 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-cyan-400 rounded" />
              <span className="text-muted">Avg Delay</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Summary stats */}
      <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-xs text-muted mb-1">Peak Delay</p>
          <p className="text-lg font-semibold text-red-400">
            {data.length > 0 ? Math.max(...data.map(d => d.max_delay)).toFixed(1) : 0}m
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted mb-1">Average</p>
          <p className="text-lg font-semibold text-cyan-400">
            {data.length > 0
              ? (data.reduce((sum, d) => sum + d.avg_delay, 0) / data.length).toFixed(1)
              : 0}m
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted mb-1">Data Points</p>
          <p className="text-lg font-semibold text-foreground">
            {data.reduce((sum, d) => sum + d.count, 0).toLocaleString()}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

