"use client";

import { LineStats } from "@/lib/api";

interface LineHeatmapProps {
  lines: LineStats[];
  onLineClick?: (line: string) => void;
}

const vehicleIcons: Record<string, string> = {
  U_BAHN: "🚇",
  METROBUS: "🚌",
  BUS: "🚌",
  S_BAHN: "🚆",
  TRAIN: "🚆",
  FERRY: "⛴️",
};

export function LineHeatmap({ lines, onLineClick }: LineHeatmapProps) {
  if (lines.length === 0) {
    return (
      <div className="feed-card card-bg-neutral">
        <div className="text-muted text-center py-8">
          Keine Linien-Daten verfügbar
        </div>
      </div>
    );
  }

  // Group by vehicle type
  const grouped = lines.reduce(
    (acc, line) => {
      const type = line.vehicle_type || "OTHER";
      if (!acc[type]) acc[type] = [];
      acc[type].push(line);
      return acc;
    },
    {} as Record<string, LineStats[]>
  );

  // Sort order for vehicle types
  const typeOrder = ["U_BAHN", "S_BAHN", "METROBUS", "BUS", "FERRY", "OTHER"];
  const sortedTypes = Object.keys(grouped).sort(
    (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b)
  );

  return (
    <div className="feed-card card-bg-neutral">
      {/* Title */}
      <div className="text-center mb-6 opacity-0 animate-in">
        <span className="text-3xl">🗺️</span>
        <h2 className="display-medium mt-2">Alle Linien</h2>
        <p className="text-muted text-sm mt-1">
          {lines.length} Linien im Überblick
        </p>
      </div>

      {/* Grouped Line Grid */}
      <div className="space-y-6 opacity-0 animate-in stagger-1">
        {sortedTypes.map((type) => (
          <div key={type} className="line-group">
            {/* Group Header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">
                {vehicleIcons[type] || "🚃"}
              </span>
              <span className="text-sm font-medium text-soft uppercase tracking-wide">
                {type.replace("_", "-")}
              </span>
              <span className="text-xs text-muted">
                ({grouped[type].length})
              </span>
            </div>

            {/* Line Pills */}
            <div className="line-pill-grid">
              {grouped[type]
                .sort((a, b) => b.avg_delay_minutes - a.avg_delay_minutes)
                .map((line) => (
                  <button
                    key={line.line}
                    className={`line-pill line-pill-${line.status}`}
                    onClick={() => onLineClick?.(line.line)}
                    title={`${line.line}: Ø ${line.avg_delay_minutes.toFixed(1)} min Verspätung`}
                  >
                    <span className="line-pill-name">{line.line}</span>
                    <span className="line-pill-delay">
                      +{line.avg_delay_minutes.toFixed(1)}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-6 text-xs opacity-0 animate-in stagger-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-good" />
          <span className="text-soft">&lt;2 min</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-warning" />
          <span className="text-soft">2-5 min</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-critical" />
          <span className="text-soft">&gt;5 min</span>
        </div>
      </div>
    </div>
  );
}

export function LineHeatmapSkeleton() {
  return (
    <div className="feed-card card-bg-neutral">
      <div className="skeleton w-32 h-6 mx-auto mb-4" />
      <div className="skeleton w-full h-48" />
    </div>
  );
}

