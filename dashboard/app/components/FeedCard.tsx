"use client";

import { Prediction } from "@/lib/api";

interface FeedCardProps {
  line: string;
  vehicleType: string | null;
  avgDelay: number;
  maxDelay: number;
  delayedPercentage: number;
  totalSegments: number;
  status: "good" | "warning" | "critical";
  index: number;
  prediction?: Prediction | null;
  onShowJourneys?: () => void;
}

const vehicleIcons: Record<string, string> = {
  U_BAHN: "🚇",
  METROBUS: "🚌",
  BUS: "🚌",
  S_BAHN: "🚆",
  TRAIN: "🚆",
  FERRY: "⛴️",
};

const vehicleLabels: Record<string, string> = {
  U_BAHN: "U-Bahn",
  METROBUS: "Metrobus",
  BUS: "Bus",
  S_BAHN: "S-Bahn",
  TRAIN: "Zug",
  FERRY: "Fähre",
};

export function FeedCard({
  line,
  vehicleType,
  avgDelay,
  maxDelay,
  delayedPercentage,
  totalSegments,
  status,
  prediction,
  onShowJourneys,
}: FeedCardProps) {
  const icon = vehicleIcons[vehicleType || "BUS"] || "🚌";
  const label = vehicleLabels[vehicleType || "BUS"] || "Bus";

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
    good: "Pünktlich",
    warning: "Verspätet",
    critical: "Stark verspätet",
  }[status];

  // Format delay display
  const delayDisplay = avgDelay < 1 
    ? `${Math.round(avgDelay * 60)}` 
    : avgDelay.toFixed(1);
  
  const delayUnit = avgDelay < 1 ? "sek" : "min";

  // Prediction data
  const predictedDelay = prediction?.predicted_delay_minutes ?? null;
  const delayProbability = prediction?.classification?.probability_delayed ?? null;

  return (
    <div className={`feed-card ${bgClass}`}>
      {/* Vehicle Type Pill */}
      <div className="vehicle-pill opacity-0 animate-in stagger-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>

      {/* Line Name */}
      <h1 className="display-large mt-6 opacity-0 animate-in stagger-2">
        {line}
      </h1>

      {/* Big Delay Number - Historical */}
      <div className="mt-8 text-center opacity-0 animate-in stagger-3">
        <div className="text-xs uppercase tracking-[0.15em] text-muted mb-2">
          Historisch
        </div>
        <div className={`display-huge ${statusTextClass}`}>
          {avgDelay > 0 ? "+" : ""}{delayDisplay}
        </div>
        <div className="text-muted text-base mt-2 uppercase tracking-[0.2em] font-medium">
          {delayUnit}
        </div>
      </div>

      {/* Prediction Badge */}
      {predictedDelay !== null && (
        <div className="prediction-badge opacity-0 animate-in stagger-3">
          <div className="prediction-badge-icon">🤖</div>
          <div className="prediction-badge-content">
            <span className="prediction-label">ML Prediction</span>
            <span className={`prediction-value ${
              predictedDelay >= 5 ? "text-critical" :
              predictedDelay >= 2 ? "text-warning" : "text-good"
            }`}>
              +{predictedDelay.toFixed(1)} min
            </span>
            {delayProbability !== null && (
              <span className="prediction-probability">
                {(delayProbability * 100).toFixed(0)}% Wahrscheinlichkeit
              </span>
            )}
          </div>
        </div>
      )}

      {/* Status Label */}
      <div className={`mt-6 text-base font-medium opacity-0 animate-in stagger-4 ${statusTextClass}`}>
        {statusText}
      </div>

      {/* Delay Probability Bar */}
      <div className="delay-bar mt-8 opacity-0 animate-in stagger-4">
        <div 
          className={`delay-bar-fill ${status}`}
          style={{ width: `${Math.min(100, delayedPercentage)}%` }}
        />
      </div>
      <div className="text-soft text-sm mt-3 opacity-0 animate-in stagger-4">
        {delayedPercentage.toFixed(0)}% der Fahrten verspätet
      </div>

      {/* Stats Row */}
      <div className="stats-row opacity-0 animate-in stagger-4">
        <div className="stat-item">
          <div className="stat-label">Max</div>
          <div className="stat-value">
            {maxDelay.toFixed(1)} min
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Fahrten</div>
          <div className="stat-value">
            {totalSegments.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Show Journeys Button */}
      {onShowJourneys && (
        <button
          className="show-journeys-btn opacity-0 animate-in stagger-4"
          onClick={onShowJourneys}
        >
          <span>Einzelne Fahrten anzeigen</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Loading skeleton card
export function FeedCardSkeleton() {
  return (
    <div className="feed-card card-bg-neutral">
      <div className="skeleton w-28 h-8 rounded-full" />
      <div className="skeleton w-40 h-12 mt-6" />
      <div className="skeleton w-56 h-28 mt-10" />
      <div className="skeleton w-24 h-6 mt-8" />
      <div className="delay-bar mt-10">
        <div className="skeleton h-full w-1/2" />
      </div>
    </div>
  );
}
