"use client";

import { GlassCard, GlassCardHeader } from "./ui/GlassCard";

interface LineStats {
  line: string;
  vehicle_type: string | null;
  line_type: string | null;
  avg_delay_minutes: number;
  max_delay_minutes: number;
  delayed_percentage: number;
  total_segments: number;
  status: "good" | "warning" | "critical";
}

interface LineGridProps {
  lines: LineStats[];
  loading?: boolean;
}

const statusConfig = {
  good: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    label: "On Time",
  },
  warning: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-400",
    label: "Delayed",
  },
  critical: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    label: "Major Delay",
  },
};

const vehicleIcons: Record<string, string> = {
  U_BAHN: "🚇",
  METROBUS: "🚌",
  BUS: "🚌",
  S_BAHN: "🚆",
  TRAIN: "🚆",
  FERRY: "⛴️",
};

export function LineGrid({ lines, loading = false }: LineGridProps) {
  if (loading) {
    return (
      <GlassCard variant="strong" className="col-span-full">
        <GlassCardHeader title="Line Performance" subtitle="Loading..." />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="strong" className="col-span-full">
      <GlassCardHeader
        title="Line Performance"
        subtitle={`${lines.length} active lines`}
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {lines.map((line, index) => {
          const config = statusConfig[line.status];
          const icon = vehicleIcons[line.vehicle_type || "BUS"] || "🚌";

          return (
            <div
              key={line.line}
              className={`
                p-4 rounded-xl border transition-all-200 hover-lift cursor-pointer
                ${config.bg} ${config.border}
                animate-slide-up
              `}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{icon}</span>
                  <span className="font-bold text-foreground">{line.line}</span>
                </div>
                <span className={`text-xs font-medium ${config.text}`}>
                  {config.label}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Avg Delay</span>
                  <span className={config.text}>
                    {line.avg_delay_minutes.toFixed(1)} min
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Delayed</span>
                  <span className="text-foreground/70">
                    {line.delayed_percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
              {/* Mini sparkline placeholder */}
              <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    line.status === "good"
                      ? "bg-emerald-500"
                      : line.status === "warning"
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  style={{
                    width: `${Math.min(100, (line.avg_delay_minutes / 10) * 100)}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

