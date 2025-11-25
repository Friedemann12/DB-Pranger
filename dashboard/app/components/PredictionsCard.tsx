"use client";

import { Prediction, Weather, WeatherImpact } from "@/lib/api";

interface PredictionsCardProps {
  predictions: Prediction[];
  weather?: Weather;
  weatherImpact?: WeatherImpact;
  timeFeatures?: {
    hour_of_day: number;
    day_of_week: number;
    is_rush_hour: boolean;
    is_weekend: boolean;
  };
}

const vehicleIcons: Record<string, string> = {
  U_BAHN: "🚇",
  METROBUS: "🚌",
  BUS: "🚌",
  S_BAHN: "🚆",
  TRAIN: "🚆",
  FERRY: "⛴️",
};

const weatherIcons: Record<number, string> = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌧️",
  53: "🌧️",
  55: "🌧️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "🌨️",
  80: "🌧️",
  81: "🌧️",
  82: "🌧️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

const impactColors = {
  low: "text-good",
  medium: "text-warning",
  high: "text-critical",
};

export function PredictionsCard({
  predictions,
  weather,
  weatherImpact,
  timeFeatures,
}: PredictionsCardProps) {
  if (predictions.length === 0) {
    return (
      <div className="feed-card card-bg-neutral">
        <div className="text-center py-8">
          <span className="text-4xl mb-4 block">🤖</span>
          <h2 className="display-medium">ML Predictions</h2>
          <p className="text-muted mt-2">
            Keine Predictions verfügbar.
            <br />
            Stelle sicher, dass die ML-Modelle trainiert sind.
          </p>
        </div>
      </div>
    );
  }

  const weatherIcon = weather
    ? weatherIcons[weather.weather_code] || "🌡️"
    : "🌡️";

  return (
    <div className="feed-card card-bg-neutral">
      {/* Header */}
      <div className="text-center mb-6 opacity-0 animate-in">
        <span className="text-4xl">🤖</span>
        <h2 className="display-medium mt-2">ML Predictions</h2>
        <p className="text-muted text-sm mt-1">
          Vorhergesagte Verspätungen basierend auf aktuellen Bedingungen
        </p>
      </div>

      {/* Weather & Time Context */}
      <div className="prediction-context opacity-0 animate-in stagger-1">
        {/* Weather Card */}
        {weather && (
          <div className="context-card">
            <div className="text-2xl mb-1">{weatherIcon}</div>
            <div className="text-lg font-semibold">
              {weather.temperature_c.toFixed(0)}°C
            </div>
            <div className="text-xs text-muted">
              {weather.precipitation_mm > 0
                ? `${weather.precipitation_mm.toFixed(1)} mm`
                : "Trocken"}
            </div>
          </div>
        )}

        {/* Weather Impact */}
        {weatherImpact && (
          <div className="context-card">
            <div className="text-2xl mb-1">
              {weatherImpact.level === "low"
                ? "✅"
                : weatherImpact.level === "medium"
                  ? "⚠️"
                  : "🚨"}
            </div>
            <div
              className={`text-lg font-semibold ${impactColors[weatherImpact.level]}`}
            >
              {weatherImpact.level === "low"
                ? "Gering"
                : weatherImpact.level === "medium"
                  ? "Mittel"
                  : "Hoch"}
            </div>
            <div className="text-xs text-muted">Wetter-Einfluss</div>
          </div>
        )}

        {/* Time Context */}
        {timeFeatures && (
          <div className="context-card">
            <div className="text-2xl mb-1">
              {timeFeatures.is_rush_hour ? "🚦" : "🕐"}
            </div>
            <div className="text-lg font-semibold">
              {timeFeatures.hour_of_day}:00
            </div>
            <div className="text-xs text-muted">
              {timeFeatures.is_rush_hour
                ? "Rush Hour"
                : timeFeatures.is_weekend
                  ? "Wochenende"
                  : "Normal"}
            </div>
          </div>
        )}
      </div>

      {/* Predictions List */}
      <div className="predictions-list opacity-0 animate-in stagger-2">
        <h3 className="text-sm font-medium text-soft mb-3 uppercase tracking-wide">
          Top {predictions.length} Linien
        </h3>

        {predictions.map((pred, index) => {
          const delay = pred.predicted_delay_minutes ?? 0;
          const probability = pred.classification?.probability_delayed ?? 0;
          const icon = vehicleIcons[pred.vehicle_type || "BUS"] || "🚌";

          // Determine status based on prediction
          let status: "good" | "warning" | "critical" = "good";
          if (delay >= 5 || probability > 0.7) status = "critical";
          else if (delay >= 2 || probability > 0.4) status = "warning";

          return (
            <div
              key={`${pred.line}-${index}`}
              className={`prediction-item prediction-item-${status}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{icon}</span>
                <div>
                  <div className="font-semibold">{pred.line}</div>
                  <div className="text-xs text-muted">
                    {pred.direction || "—"}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className={`text-lg font-bold text-${status}`}>
                  +{delay.toFixed(1)} min
                </div>
                <div className="text-xs text-muted">
                  {(probability * 100).toFixed(0)}% Wahrscheinlichkeit
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="text-center mt-6 text-xs text-soft opacity-0 animate-in stagger-3">
        <p>
          Predictions basieren auf{" "}
          <span className="text-accent">RandomForest ML-Modellen</span>
        </p>
        <p className="mt-1">
          Features: Wetter, Uhrzeit, Wochentag, Linientyp
        </p>
      </div>
    </div>
  );
}

export function PredictionsCardSkeleton() {
  return (
    <div className="feed-card card-bg-neutral">
      <div className="skeleton w-32 h-8 mx-auto mb-4" />
      <div className="flex gap-3 justify-center mb-6">
        <div className="skeleton w-20 h-20 rounded-xl" />
        <div className="skeleton w-20 h-20 rounded-xl" />
        <div className="skeleton w-20 h-20 rounded-xl" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton w-full h-16 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

