"use client";

import { useHeatmap } from "@/hooks/useDelayData";
import { ActivityIcon, ClockIcon } from "../icons";

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
  if (avgDelay < 1) return "var(--status-good)";
  if (avgDelay < 2) return "color-mix(in srgb, var(--status-good) 70%, var(--status-warning))";
  if (avgDelay < 3) return "color-mix(in srgb, var(--status-warning) 70%, var(--status-good))";
  if (avgDelay < 5) return "var(--status-warning)";
  return "var(--status-critical)";
}

function getDelayOpacity(avgDelay: number, maxDelay: number): number {
  if (maxDelay === 0) return 0.2;
  return Math.min(0.3 + (avgDelay / maxDelay) * 0.7, 1);
}

export function HeatmapScreen() {
  const { data, isLoading, isError } = useHeatmap();

  const dataMap = new Map<string, (typeof data)[0]>();
  let maxAvgDelay = 0;

  data.forEach((point) => {
    const key = `${point.hour}-${point.day_of_week}`;
    dataMap.set(key, point);
    if (point.avg_delay > maxAvgDelay) maxAvgDelay = point.avg_delay;
  });

  if (isLoading) {
    return (
      <div className="screen card-bg-neutral">
        <div className="skeleton w-32 h-6 mb-4" />
        <div className="skeleton w-full max-w-md h-48" />
      </div>
    );
  }

  if (isError || data.length === 0) {
    return (
      <div className="screen card-bg-neutral">
        <p className="text-muted">Keine Heatmap-Daten verfügbar</p>
      </div>
    );
  }

  return (
    <div className="screen card-bg-neutral">
      <div className="screen-header">
        <ActivityIcon size={28} className="text-accent" />
        <h2 className="screen-title">Verspätungs-Heatmap</h2>
        <p className="screen-subtitle">Stunde × Wochentag</p>
      </div>

      <div className="heatmap-container">
        <div className="heatmap-row heatmap-header">
          <div className="heatmap-day-label" />
          {HOURS.filter((h) => h % 3 === 0).map((hour) => (
            <div key={hour} className="heatmap-hour-label">{hour}</div>
          ))}
        </div>

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
                  style={{ backgroundColor: color, opacity }}
                  title={point ? `${day.name} ${hour}:00 - Ø ${avgDelay} min` : "Keine Daten"}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="heatmap-legend">
        <span className="legend-label">Pünktlich</span>
        <div className="heatmap-legend-gradient" />
        <span className="legend-label">Verspätet</span>
      </div>

      <div className="heatmap-info">
        <ClockIcon size={14} />
        <span>Rush Hour: 7-9 Uhr & 16-19 Uhr</span>
      </div>
    </div>
  );
}

