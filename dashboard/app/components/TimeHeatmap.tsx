"use client";

import { useHeatmap } from "@/hooks/useDelayData";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = [
  { num: 2, name: "Mo" },
  { num: 3, name: "Di" },
  { num: 4, name: "Mi" },
  { num: 5, name: "Do" },
  { num: 6, name: "Fr" },
  { num: 7, name: "Sa" },
  { num: 1, name: "So" },
];

function getDelayColor(avgDelay: number): string {
  if (avgDelay < 1) return "var(--color-good)";
  if (avgDelay < 2) return "var(--color-good-soft)";
  if (avgDelay < 3) return "var(--color-warning-soft)";
  if (avgDelay < 5) return "var(--color-warning)";
  return "var(--color-critical)";
}

function getDelayOpacity(avgDelay: number, maxDelay: number): number {
  if (maxDelay === 0) return 0.2;
  return Math.min(0.3 + (avgDelay / maxDelay) * 0.7, 1);
}

export function TimeHeatmap() {
  const { data, isLoading, isError } = useHeatmap();

  // Create a lookup map for quick access
  const dataMap = new Map<string, (typeof data)[0]>();
  let maxAvgDelay = 0;
  
  data.forEach((point) => {
    const key = `${point.hour}-${point.day_of_week}`;
    dataMap.set(key, point);
    if (point.avg_delay > maxAvgDelay) maxAvgDelay = point.avg_delay;
  });

  if (isLoading) {
    return (
      <div className="feed-card card-bg-neutral">
        <div className="skeleton w-32 h-6 mb-4" />
        <div className="skeleton w-full h-48" />
      </div>
    );
  }

  if (isError || data.length === 0) {
    return (
      <div className="feed-card card-bg-neutral">
        <div className="text-muted text-center py-8">
          Keine Heatmap-Daten verfügbar
        </div>
      </div>
    );
  }

  return (
    <div className="feed-card card-bg-neutral">
      {/* Title */}
      <div className="text-center mb-6 opacity-0 animate-in">
        <span className="text-3xl">🔥</span>
        <h2 className="display-medium mt-2">Verspätungs-Heatmap</h2>
        <p className="text-muted text-sm mt-1">Stunde × Wochentag</p>
      </div>

      {/* Heatmap Grid */}
      <div className="heatmap-container opacity-0 animate-in stagger-1">
        {/* Hour labels (top) */}
        <div className="heatmap-row heatmap-header">
          <div className="heatmap-day-label" />
          {HOURS.filter((h) => h % 3 === 0).map((hour) => (
            <div key={hour} className="heatmap-hour-label">
              {hour}
            </div>
          ))}
        </div>

        {/* Day rows */}
        {DAYS.map((day) => (
          <div key={day.num} className="heatmap-row">
            <div className="heatmap-day-label">{day.name}</div>
            {HOURS.map((hour) => {
              const key = `${hour}-${day.num}`;
              const point = dataMap.get(key);
              const avgDelay = point?.avg_delay ?? 0;
              const color = getDelayColor(avgDelay);
              const opacity = getDelayOpacity(avgDelay, maxAvgDelay);

              return (
                <div
                  key={hour}
                  className="heatmap-cell"
                  style={{
                    backgroundColor: color,
                    opacity: opacity,
                  }}
                  title={
                    point
                      ? `${day.name} ${hour}:00 - Ø ${avgDelay.toFixed(1)} min`
                      : "Keine Daten"
                  }
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="heatmap-legend opacity-0 animate-in stagger-2">
        <span className="text-xs text-muted">Pünktlich</span>
        <div className="heatmap-legend-gradient" />
        <span className="text-xs text-muted">Verspätet</span>
      </div>

      {/* Rush hour indicators */}
      <div className="text-center mt-4 text-xs text-soft opacity-0 animate-in stagger-3">
        🚦 Rush Hour: 7-9 Uhr & 16-19 Uhr
      </div>
    </div>
  );
}

export function TimeHeatmapSkeleton() {
  return (
    <div className="feed-card card-bg-neutral">
      <div className="skeleton w-32 h-6 mx-auto mb-4" />
      <div className="skeleton w-full h-48" />
    </div>
  );
}

