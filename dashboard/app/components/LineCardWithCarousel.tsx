"use client";

import { useRef, useState, useEffect } from "react";
import { useJourneysByLine } from "@/hooks/useDelayData";
import { LineStats, Journey, Prediction } from "@/lib/api";

interface LineCardWithCarouselProps {
  lineStats: LineStats;
  prediction?: Prediction | null;
  onJourneyClick: (journey: Journey) => void;
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

export function LineCardWithCarousel({
  lineStats,
  prediction,
  onJourneyClick,
}: LineCardWithCarouselProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  
  // Fetch journeys for this line
  const { journeys, isLoading } = useJourneysByLine(lineStats.line, 20);
  
  // Total slides = 1 (overview) + journeys
  const totalSlides = 1 + journeys.length;

  const icon = vehicleIcons[lineStats.vehicle_type || "BUS"] || "🚌";
  const label = vehicleLabels[lineStats.vehicle_type || "BUS"] || "Bus";

  const statusTextClass = {
    good: "text-good",
    warning: "text-warning",
    critical: "text-critical",
  }[lineStats.status];

  const bgClass = {
    good: "card-bg-good",
    warning: "card-bg-warning",
    critical: "card-bg-critical",
  }[lineStats.status];

  // Format delay display
  const delayDisplay = lineStats.avg_delay_minutes < 1 
    ? `${Math.round(lineStats.avg_delay_minutes * 60)}` 
    : lineStats.avg_delay_minutes.toFixed(1);
  
  const delayUnit = lineStats.avg_delay_minutes < 1 ? "sek" : "min";

  // Prediction data
  const predictedDelay = prediction?.predicted_delay_minutes ?? null;
  const delayProbability = prediction?.classification?.probability_delayed ?? null;

  // Handle scroll to update active slide
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const handleScroll = () => {
      const scrollPos = carousel.scrollLeft;
      const slideWidth = carousel.offsetWidth;
      const newIndex = Math.round(scrollPos / slideWidth);
      setActiveSlide(Math.min(newIndex, totalSlides - 1));
    };

    carousel.addEventListener("scroll", handleScroll, { passive: true });
    return () => carousel.removeEventListener("scroll", handleScroll);
  }, [totalSlides]);

  // Scroll to specific slide
  const scrollToSlide = (index: number) => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    carousel.scrollTo({
      left: index * carousel.offsetWidth,
      behavior: "smooth",
    });
  };

  // Format timestamp
  const formatTime = (timestamp: number | null): string => {
    if (!timestamp) return "—";
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={`line-card-container ${bgClass}`}>
      {/* Horizontal Carousel */}
      <div ref={carouselRef} className="line-carousel">
        {/* Slide 0: Line Overview */}
        <div className="line-carousel-slide line-overview-slide">
          {/* Vehicle Type Pill */}
          <div className="vehicle-pill">
            <span>{icon}</span>
            <span>{label}</span>
          </div>

          {/* Line Name */}
          <h1 className="display-large mt-4">{lineStats.line}</h1>

          {/* Big Delay Number */}
          <div className="mt-6 text-center">
            <div className={`display-huge ${statusTextClass}`}>
              {lineStats.avg_delay_minutes > 0 ? "+" : ""}{delayDisplay}
            </div>
            <div className="text-muted text-sm mt-1 uppercase tracking-[0.15em]">
              {delayUnit} Ø Verspätung
            </div>
          </div>

          {/* Prediction Badge */}
          {predictedDelay !== null && (
            <div className="prediction-badge-inline">
              <span className="prediction-icon">🤖</span>
              <span className={`prediction-value ${
                predictedDelay >= 5 ? "text-critical" :
                predictedDelay >= 2 ? "text-warning" : "text-good"
              }`}>
                +{predictedDelay.toFixed(1)} min predicted
              </span>
              {delayProbability !== null && (
                <span className="prediction-prob">
                  ({(delayProbability * 100).toFixed(0)}%)
                </span>
              )}
            </div>
          )}

          {/* Stats Row */}
          <div className="stats-row-compact">
            <div className="stat-compact">
              <span className="stat-value">{lineStats.max_delay_minutes.toFixed(1)}</span>
              <span className="stat-label">max min</span>
            </div>
            <div className="stat-compact">
              <span className="stat-value">{lineStats.delayed_percentage.toFixed(0)}%</span>
              <span className="stat-label">verspätet</span>
            </div>
            <div className="stat-compact">
              <span className="stat-value">{lineStats.total_segments.toLocaleString()}</span>
              <span className="stat-label">Fahrten</span>
            </div>
          </div>

          {/* Swipe hint */}
          {journeys.length > 0 && (
            <div className="swipe-hint-right">
              <span>Fahrten →</span>
            </div>
          )}
        </div>

        {/* Journey Slides */}
        {isLoading ? (
          <div className="line-carousel-slide journey-slide-full">
            <div className="skeleton w-full h-full rounded-xl" />
          </div>
        ) : (
          journeys.map((journey, index) => (
            <button
              key={journey.journey_id}
              className={`line-carousel-slide journey-slide-full journey-${journey.status}`}
              onClick={() => onJourneyClick(journey)}
            >
              {/* Journey Number */}
              <div className="journey-number">
                Fahrt {index + 1}/{journeys.length}
              </div>

              {/* Route */}
              <div className="journey-route-full">
                <div className="route-station">
                  <div className="route-dot start" />
                  <span>{journey.first_station || "Start"}</span>
                </div>
                <div className="route-line-vertical" />
                <div className="route-station">
                  <div className="route-dot end" />
                  <span>{journey.last_station || "Ende"}</span>
                </div>
              </div>

              {/* Direction */}
              <div className="journey-direction">
                → {journey.direction || "—"}
              </div>

              {/* Delay Display */}
              <div className={`journey-delay-large ${journey.status}`}>
                <span className="delay-value">
                  {journey.avg_delay_minutes > 0 ? "+" : ""}
                  {journey.avg_delay_minutes.toFixed(1)}
                </span>
                <span className="delay-unit">min</span>
              </div>

              {/* Stats */}
              <div className="journey-stats-row">
                <div className="stat">
                  <span className="value">{journey.max_delay_minutes}</span>
                  <span className="label">max</span>
                </div>
                <div className="stat">
                  <span className="value">{journey.segment_count}</span>
                  <span className="label">Stops</span>
                </div>
                <div className="stat">
                  <span className="value">{formatTime(journey.start_time)}</span>
                  <span className="label">Start</span>
                </div>
              </div>

              {/* Tap for details */}
              <div className="tap-hint">
                Tippen für Segment-Details
              </div>
            </button>
          ))
        )}
      </div>

      {/* Pagination Dots */}
      {totalSlides > 1 && (
        <div className="line-carousel-pagination">
          {Array.from({ length: Math.min(totalSlides, 10) }).map((_, i) => (
            <button
              key={i}
              className={`pagination-dot ${activeSlide === i ? "active" : ""}`}
              onClick={() => scrollToSlide(i)}
              aria-label={i === 0 ? "Übersicht" : `Fahrt ${i}`}
            />
          ))}
          {totalSlides > 10 && (
            <span className="pagination-more">+{totalSlides - 10}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function LineCardSkeleton() {
  return (
    <div className="line-card-container card-bg-neutral">
      <div className="line-carousel">
        <div className="line-carousel-slide line-overview-slide">
          <div className="skeleton w-24 h-8 rounded-full" />
          <div className="skeleton w-20 h-12 mt-4" />
          <div className="skeleton w-40 h-24 mt-6" />
          <div className="skeleton w-full h-16 mt-6" />
        </div>
      </div>
    </div>
  );
}

