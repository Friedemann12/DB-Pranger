"use client";

import { WeatherIcon, VehicleIcon, ClockIcon, ActivityIcon } from "../icons";

interface OverviewScreenProps {
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

function getStatus(avgDelay: number): "good" | "warning" | "critical" {
  if (avgDelay < 2) return "good";
  if (avgDelay < 5) return "warning";
  return "critical";
}

export function OverviewScreen({
  avgDelay,
  delayedPercentage,
  totalJourneys,
  activeLines,
  weather,
  weatherImpact,
}: OverviewScreenProps) {
  const status = getStatus(avgDelay);

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
    <div className={`screen ${bgClass}`}>
      {weather && (
        <div className="weather-badge">
          <WeatherIcon code={weather.weather_code} size={20} />
          <span>{weather.temperature_c.toFixed(0)}°C</span>
          {weatherImpact && (
            <span className={`weather-impact-label ${
              weatherImpact.level === "low" ? "text-good" :
              weatherImpact.level === "medium" ? "text-warning" : "text-critical"
            }`}>
              {weatherImpact.level === "low" ? "Gut" : 
               weatherImpact.level === "medium" ? "Mäßig" : "Schlecht"}
            </span>
          )}
        </div>
      )}

      <h1 className="screen-subtitle">Hamburg HVV</h1>

      <div className="delay-display">
        <div className={`delay-number ${statusTextClass}`}>
          {avgDelay}
        </div>
        <div className="delay-label">Min Ø Verspätung</div>
      </div>

      <div className={`status-text ${statusTextClass}`}>{statusText}</div>

      <div className="stats-grid">
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
          <div className="stat-value">{totalJourneys.toLocaleString()}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Linien</div>
          <div className="stat-value text-accent">{activeLines}</div>
        </div>
      </div>
    </div>
  );
}

export function OverviewScreenSkeleton() {
  return (
    <div className="screen card-bg-neutral">
      <div className="skeleton w-32 h-8 rounded-full" />
      <div className="skeleton w-36 h-5 mt-6" />
      <div className="skeleton w-64 h-36 mt-8" />
      <div className="skeleton w-36 h-7 mt-10" />
      <div className="stats-grid mt-12">
        <div className="skeleton w-16 h-14" />
        <div className="skeleton w-16 h-14" />
        <div className="skeleton w-16 h-14" />
      </div>
    </div>
  );
}

