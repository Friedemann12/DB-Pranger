"use client";

import { useEffect, useRef } from "react";
import { useJourneyDetail } from "@/hooks/useDelayData";
import { Journey } from "@/lib/api";

interface JourneyDetailModalProps {
  journey: Journey | null;
  onClose: () => void;
}

const vehicleIcons: Record<string, string> = {
  U_BAHN: "🚇",
  METROBUS: "🚌",
  BUS: "🚌",
  S_BAHN: "🚆",
  TRAIN: "🚆",
  FERRY: "⛴️",
};

export function JourneyDetailModal({
  journey,
  onClose,
}: JourneyDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { journey: detail, segments, isLoading, isError } = useJourneyDetail(
    journey?.journey_id ?? null
  );

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = journey ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [journey]);

  if (!journey) return null;

  const icon = vehicleIcons[journey.vehicle_type || "BUS"] || "🚌";

  // Format timestamp to readable time
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="modal-overlay">
      <div ref={modalRef} className="modal-container slide-up">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <h2 className="text-xl font-bold">{journey.line}</h2>
              <p className="text-sm text-muted">{journey.direction || "—"}</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Schließen">
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Journey Summary */}
        <div className="modal-summary">
          <div className={`summary-delay delay-${journey.status}`}>
            <span className="delay-value">
              {journey.avg_delay_minutes > 0 ? "+" : ""}
              {journey.avg_delay_minutes.toFixed(1)}
            </span>
            <span className="delay-label">min Ø Verspätung</span>
          </div>
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-value">{journey.max_delay_minutes}</span>
              <span className="stat-label">max min</span>
            </div>
            <div className="stat">
              <span className="stat-value">{journey.segment_count}</span>
              <span className="stat-label">Segmente</span>
            </div>
          </div>
        </div>

        {/* Route */}
        <div className="modal-route">
          <div className="route-endpoint">
            <div className="route-dot start" />
            <span>{journey.first_station || "Start"}</span>
          </div>
          <div className="route-line" />
          <div className="route-endpoint">
            <div className="route-dot end" />
            <span>{journey.last_station || "Ende"}</span>
          </div>
        </div>

        {/* Segments List */}
        <div className="modal-segments">
          <h3 className="text-sm font-medium text-soft mb-3 uppercase tracking-wide">
            Streckenabschnitte
          </h3>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center text-muted py-4">
              Fehler beim Laden der Segmente
            </div>
          ) : segments.length === 0 ? (
            <div className="text-center text-muted py-4">
              Keine Segmente verfügbar
            </div>
          ) : (
            <div className="segments-list">
              {segments.map((segment, index) => (
                <div
                  key={index}
                  className={`segment-item segment-${segment.status}`}
                >
                  <div className="segment-timeline">
                    <div className={`segment-dot ${segment.status}`} />
                    {index < segments.length - 1 && (
                      <div className="segment-connector" />
                    )}
                  </div>
                  <div className="segment-content">
                    <div className="segment-stations">
                      <span className="font-medium">
                        {segment.start_station}
                      </span>
                      <span className="text-muted mx-2">→</span>
                      <span className="font-medium">{segment.end_station}</span>
                    </div>
                    <div className="segment-meta">
                      <span className="text-xs text-muted">
                        {formatTime(segment.start_timestamp)}
                      </span>
                    </div>
                  </div>
                  <div className={`segment-delay text-${segment.status}`}>
                    {segment.delay_minutes > 0 ? "+" : ""}
                    {segment.delay_minutes} min
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <p className="text-xs text-muted text-center">
            Journey ID: {journey.journey_id?.slice(0, 50)}...
          </p>
        </div>
      </div>
    </div>
  );
}

