"use client";

import { Prediction, LineStats } from "@/lib/api";

interface PredictionDetailSlideProps {
  prediction: Prediction;
  historicalStats?: LineStats | null;
  isFirst?: boolean;
}

const vehicleIcons: Record<string, string> = {
  U_BAHN: "🚇",
  METROBUS: "🚌",
  BUS: "🚌",
  S_BAHN: "🚆",
  TRAIN: "🚆",
  FERRY: "⛴️",
};

export function PredictionDetailSlide({
  prediction,
  historicalStats,
  isFirst,
}: PredictionDetailSlideProps) {
  const delay = prediction.predicted_delay_minutes ?? 0;
  const probability = prediction.classification?.probability_delayed ?? 0;
  const probOnTime = prediction.classification?.probability_on_time ?? 0;
  const icon = vehicleIcons[prediction.vehicle_type || "BUS"] || "🚌";

  // Determine status
  let status: "good" | "warning" | "critical" = "good";
  if (delay >= 5 || probability > 0.7) status = "critical";
  else if (delay >= 2 || probability > 0.4) status = "warning";

  const statusTextClass = {
    good: "text-good",
    warning: "text-warning",
    critical: "text-critical",
  }[status];

  // Compare with historical
  const historicalDelay = historicalStats?.avg_delay_minutes ?? null;
  const delayDiff = historicalDelay !== null ? delay - historicalDelay : null;

  return (
    <div className={`prediction-detail-slide prediction-${status}`}>
      {/* Header */}
      <div className="prediction-header">
        <span className="prediction-icon-large">{icon}</span>
        <div className="prediction-line-info">
          <h2 className="prediction-line-name">{prediction.line}</h2>
          <p className="prediction-direction">{prediction.direction || "—"}</p>
        </div>
        {isFirst && (
          <div className="prediction-badge-new">TOP</div>
        )}
      </div>

      {/* Main Prediction */}
      <div className="prediction-main">
        <div className="prediction-delay-display">
          <span className={`delay-number ${statusTextClass}`}>
            +{delay.toFixed(1)}
          </span>
          <span className="delay-unit">min</span>
        </div>
        <div className="prediction-status-label">
          {status === "good" && "Pünktlich erwartet"}
          {status === "warning" && "Leichte Verspätung"}
          {status === "critical" && "Erhebliche Verspätung"}
        </div>
      </div>

      {/* Probability Visualization */}
      <div className="prediction-probability-section">
        <div className="prob-header">
          <span className="prob-title">Verspätungs-Wahrscheinlichkeit</span>
          <span className={`prob-value ${statusTextClass}`}>
            {(probability * 100).toFixed(0)}%
          </span>
        </div>
        <div className="prob-bar">
          <div 
            className={`prob-bar-fill prob-${status}`}
            style={{ width: `${probability * 100}%` }}
          />
        </div>
        <div className="prob-labels">
          <span className="text-good">{(probOnTime * 100).toFixed(0)}% pünktlich</span>
          <span className={statusTextClass}>{(probability * 100).toFixed(0)}% verspätet</span>
        </div>
      </div>

      {/* Comparison with Historical */}
      {historicalDelay !== null && (
        <div className="prediction-comparison">
          <div className="comparison-item">
            <span className="comp-label">Historisch</span>
            <span className="comp-value">+{historicalDelay.toFixed(1)} min</span>
          </div>
          <div className="comparison-arrow">
            {delayDiff !== null && (
              delayDiff > 0.5 ? "📈" : delayDiff < -0.5 ? "📉" : "➡️"
            )}
          </div>
          <div className="comparison-item">
            <span className="comp-label">Predicted</span>
            <span className={`comp-value ${statusTextClass}`}>+{delay.toFixed(1)} min</span>
          </div>
        </div>
      )}

      {/* ML Info */}
      <div className="prediction-footer">
        <span className="ml-badge">🤖 RandomForest ML</span>
        <span className="confidence">
          Konfidenz: {((probOnTime > probability ? probOnTime : probability) * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

