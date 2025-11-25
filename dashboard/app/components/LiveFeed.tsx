"use client";

import { GlassCard, GlassCardHeader } from "./ui/GlassCard";

interface Prediction {
  line: string;
  vehicle_type: string | null;
  predicted_delay_minutes: number | null;
  classification: {
    is_delayed: boolean;
    probability_delayed: number;
    probability_on_time: number;
    threshold_minutes: number;
  } | null;
  direction: string | null;
}

interface WeatherImpact {
  level: string;
  score: number;
  description: string;
  factors: string[];
  weather_description: string;
}

interface Weather {
  temperature_c: number;
  precipitation_mm: number;
  wind_speed_kmh: number;
  weather_code: number;
  humidity_percent: number;
  cloud_cover_percent: number;
}

interface LiveFeedProps {
  predictions: Prediction[];
  weather?: Weather;
  weatherImpact?: WeatherImpact;
  loading?: boolean;
  timestamp?: string;
}

const vehicleIcons: Record<string, string> = {
  U_BAHN: "🚇",
  METROBUS: "🚌",
  BUS: "🚌",
  S_BAHN: "🚆",
  TRAIN: "🚆",
};

const impactColors: Record<string, string> = {
  low: "text-emerald-400",
  medium: "text-amber-400",
  high: "text-red-400",
};

const impactBg: Record<string, string> = {
  low: "bg-emerald-500/10 border-emerald-500/30",
  medium: "bg-amber-500/10 border-amber-500/30",
  high: "bg-red-500/10 border-red-500/30",
};

export function LiveFeed({
  predictions,
  weather,
  weatherImpact,
  loading = false,
  timestamp,
}: LiveFeedProps) {
  if (loading) {
    return (
      <GlassCard variant="strong" className="col-span-full lg:col-span-1">
        <GlassCardHeader title="Live Predictions" subtitle="Loading..." />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="strong" className="col-span-full lg:col-span-1">
      <GlassCardHeader
        title="Live Predictions"
        subtitle={timestamp ? `Updated ${formatRelativeTime(timestamp)}` : "Real-time data"}
        action={
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-emerald-400">Live</span>
          </div>
        }
      />

      {/* Weather Impact Card */}
      {weatherImpact && weather && (
        <div className={`mb-4 p-3 rounded-xl border ${impactBg[weatherImpact.level]}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{getWeatherEmoji(weather.weather_code)}</span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {weather.temperature_c.toFixed(1)}°C
                </p>
                <p className="text-xs text-muted">
                  {weatherImpact.weather_description}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-medium ${impactColors[weatherImpact.level]}`}>
                {weatherImpact.level.toUpperCase()} Impact
              </p>
              <p className="text-xs text-muted">{weatherImpact.description}</p>
            </div>
          </div>
          {weatherImpact.factors.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {weatherImpact.factors.map((factor, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs rounded-full bg-white/5 text-muted"
                >
                  {factor}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Predictions List */}
      <div className="space-y-2 max-h-96 overflow-y-auto no-scrollbar">
        {predictions.length === 0 ? (
          <div className="text-center py-8 text-muted">
            <p>No predictions available</p>
            <p className="text-xs mt-1">Models may not be trained yet</p>
          </div>
        ) : (
          predictions.map((pred, index) => {
            const delay = pred.predicted_delay_minutes ?? 0;
            const isDelayed = pred.classification?.is_delayed ?? delay > 2;
            const probability = pred.classification?.probability_delayed ?? 0;

            return (
              <div
                key={`${pred.line}-${index}`}
                className={`
                  p-3 rounded-xl border transition-all-200 hover:bg-white/5
                  ${isDelayed
                    ? delay > 5
                      ? "bg-red-500/5 border-red-500/20"
                      : "bg-amber-500/5 border-amber-500/20"
                    : "bg-white/5 border-white/10"
                  }
                  animate-slide-up
                `}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {vehicleIcons[pred.vehicle_type || "BUS"] || "🚌"}
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">{pred.line}</p>
                      <p className="text-xs text-muted truncate max-w-32">
                        {pred.direction || "Unknown direction"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-bold ${
                        isDelayed
                          ? delay > 5
                            ? "text-red-400"
                            : "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {delay > 0 ? `+${delay.toFixed(1)}` : delay.toFixed(1)}m
                    </p>
                    <p className="text-xs text-muted">
                      {(probability * 100).toFixed(0)}% delay risk
                    </p>
                  </div>
                </div>
                {/* Probability bar */}
                <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      probability > 0.7
                        ? "bg-red-500"
                        : probability > 0.4
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${probability * 100}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </GlassCard>
  );
}

function getWeatherEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌧️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "🌤️";
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString("de-DE");
  } catch {
    return isoString;
  }
}

