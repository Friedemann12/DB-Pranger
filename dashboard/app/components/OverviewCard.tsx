"use client";

interface OverviewCardProps {
  avgDelay: number;
  delayedPercentage: number;
  totalJourneys: number;
  activeLines: number;
  weather?: {
    temperature_c: number;
    weather_code: number;
  };
  weatherImpact?: {
    level: string;
    description: string;
  };
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

export function OverviewCard({
  avgDelay,
  delayedPercentage,
  totalJourneys,
  activeLines,
  weather,
  weatherImpact,
}: OverviewCardProps) {
  // Determine overall status
  const status = avgDelay < 2 ? "good" : avgDelay < 5 ? "warning" : "critical";
  
  const statusTextClass = {
    good: "text-good",
    warning: "text-warning",
    critical: "text-critical status-critical",
  }[status];

  const bgClass = {
    good: "card-bg-good",
    warning: "card-bg-warning",
    critical: "card-bg-critical",
  }[status];

  const statusText = {
    good: "Alles läuft gut",
    warning: "Leichte Störungen",
    critical: "Erhebliche Verspätungen",
  }[status];

  return (
    <div className={`feed-card ${bgClass}`}>
      {/* Weather Badge */}
      {weather && (
        <div className="weather-compact opacity-0 animate-in stagger-1">
          <span className="text-lg">{getWeatherEmoji(weather.weather_code)}</span>
          <span>{weather.temperature_c.toFixed(0)}°C</span>
          {weatherImpact && (
            <span className={`text-xs uppercase font-medium ${
              weatherImpact.level === "low" ? "text-good" :
              weatherImpact.level === "medium" ? "text-warning" : "text-critical"
            }`}>
              {weatherImpact.level === "low" ? "Gut" : 
               weatherImpact.level === "medium" ? "Mäßig" : "Schlecht"}
            </span>
          )}
        </div>
      )}

      {/* Title */}
      <h1 className="text-soft mt-6 opacity-0 animate-in stagger-1 uppercase tracking-[0.25em] text-sm font-medium">
        Hamburg HVV
      </h1>

      {/* Big Number - Average Delay */}
      <div className="mt-8 text-center opacity-0 animate-in stagger-2">
        <div className={`display-huge ${statusTextClass}`}>
          {avgDelay.toFixed(1)}
        </div>
        <div className="text-muted text-base mt-3 uppercase tracking-[0.2em] font-medium">
          Min Ø Verspätung
        </div>
      </div>

      {/* Status */}
      <div className={`mt-10 text-lg font-medium opacity-0 animate-in stagger-3 ${statusTextClass}`}>
        {statusText}
      </div>

      {/* Stats Grid */}
      <div className="stats-row mt-12 opacity-0 animate-in stagger-4">
        <div className="stat-item">
          <div className="stat-label">Verspätet</div>
          <div className={`stat-value ${
            delayedPercentage < 20 ? "text-good" :
            delayedPercentage < 40 ? "text-warning" : "text-critical"
          }`}>
            {delayedPercentage.toFixed(0)}%
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Fahrten</div>
          <div className="stat-value">
            {totalJourneys.toLocaleString()}
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Linien</div>
          <div className="stat-value text-accent">
            {activeLines}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OverviewCardSkeleton() {
  return (
    <div className="feed-card card-bg-neutral">
      <div className="skeleton w-32 h-8 rounded-full" />
      <div className="skeleton w-36 h-5 mt-6" />
      <div className="skeleton w-64 h-36 mt-8" />
      <div className="skeleton w-36 h-7 mt-10" />
      <div className="stats-row mt-12">
        <div className="skeleton w-16 h-14" />
        <div className="skeleton w-16 h-14" />
        <div className="skeleton w-16 h-14" />
      </div>
    </div>
  );
}
