"use client";

import { Journey } from "@/lib/api";

interface JourneySlideProps {
  journey: Journey;
  isActive: boolean;
  onClick: () => void;
}

export function JourneySlide({ journey, isActive, onClick }: JourneySlideProps) {
  const statusClass = {
    good: "journey-slide-good",
    warning: "journey-slide-warning",
    critical: "journey-slide-critical",
  }[journey.status];

  const statusTextClass = {
    good: "text-good",
    warning: "text-warning",
    critical: "text-critical",
  }[journey.status];

  // Format timestamp to readable time
  const formatTime = (timestamp: number | null): string => {
    if (!timestamp) return "—";
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Truncate journey ID for display
  const shortId = journey.journey_id
    ? journey.journey_id.split("(")[0].trim().slice(-20)
    : "—";

  return (
    <button
      className={`journey-slide ${statusClass} ${isActive ? "active" : ""}`}
      onClick={onClick}
      aria-label={`Fahrt ${journey.journey_id}`}
    >
      {/* Status indicator */}
      <div className={`journey-slide-status ${journey.status}`} />

      {/* Route Info */}
      <div className="journey-slide-route">
        <div className="journey-slide-stations">
          <span className="station-name">
            {journey.first_station || "Start"}
          </span>
          <span className="route-arrow">→</span>
          <span className="station-name">
            {journey.last_station || "Ende"}
          </span>
        </div>
        <div className="journey-slide-direction text-muted text-xs mt-1">
          {journey.direction || "—"}
        </div>
      </div>

      {/* Delay */}
      <div className="journey-slide-delay">
        <span className={`delay-value ${statusTextClass}`}>
          {journey.avg_delay_minutes > 0 ? "+" : ""}
          {journey.avg_delay_minutes.toFixed(1)}
        </span>
        <span className="delay-unit">min</span>
      </div>

      {/* Stats */}
      <div className="journey-slide-stats">
        <div className="stat">
          <span className="stat-label">Max</span>
          <span className="stat-value">{journey.max_delay_minutes} min</span>
        </div>
        <div className="stat">
          <span className="stat-label">Segmente</span>
          <span className="stat-value">{journey.segment_count}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Zeit</span>
          <span className="stat-value">{formatTime(journey.start_time)}</span>
        </div>
      </div>

      {/* Tap hint */}
      <div className="journey-slide-hint">
        <span>Tippen für Details</span>
        <svg
          className="w-3 h-3 ml-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </button>
  );
}

