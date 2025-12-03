"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { WeatherIcon, VehicleIcon, ClockIcon, TrendUpIcon, TrendDownIcon, DropletIcon, WindIcon, ChevronLeftIcon, ChevronRightIcon } from "../icons";
import { Prediction, Weather, WeatherImpact, LineStats } from "@/lib/api";

interface PredictionsScreenProps {
  predictions: Prediction[];
  weather?: Weather;
  weatherImpact?: WeatherImpact;
  timeFeatures?: {
    hour_of_day: number;
    day_of_week: number;
    is_rush_hour: boolean;
    is_weekend: boolean;
  };
  lineStatsMap: Map<string, LineStats>;
}

function getDelayStatus(delay: number | null): "good" | "warning" | "critical" {
  if (delay === null) return "good";
  if (delay < 2) return "good";
  if (delay < 5) return "warning";
  return "critical";
}

function ContextSlide({ weather, weatherImpact, timeFeatures }: {
  weather?: Weather;
  weatherImpact?: WeatherImpact;
  timeFeatures?: PredictionsScreenProps["timeFeatures"];
}) {
  return (
    <div className="carousel-slide context-slide">
      <h2 className="slide-title">Prognose</h2>
      <p className="slide-subtitle">Aktuelle Bedingungen</p>

      {weather && (
        <div className="weather-card">
          <div className="weather-main">
            <WeatherIcon code={weather.weather_code} size={48} />
            <div className="weather-temp">
              <span className="temp-value">{weather.temperature_c.toFixed(0)}</span>
              <span className="temp-unit">°C</span>
            </div>
          </div>
          <div className="weather-details">
            <div className="weather-detail">
              <DropletIcon size={16} />
              <span>{weather.humidity_percent}%</span>
            </div>
            <div className="weather-detail">
              <WindIcon size={16} />
              <span>{weather.wind_speed_kmh.toFixed(0)} km/h</span>
            </div>
          </div>
        </div>
      )}

      {weatherImpact && (
        <div className={`impact-badge impact-${weatherImpact.level}`}>
          {weatherImpact.level === "low" ? "Geringer Wetter-Einfluss" :
           weatherImpact.level === "medium" ? "Mäßiger Wetter-Einfluss" : "Starker Wetter-Einfluss"}
        </div>
      )}

      {timeFeatures && (
        <div className="time-badges">
          <div className="time-badge">
            <ClockIcon size={16} />
            <span>{timeFeatures.hour_of_day}:00 Uhr</span>
          </div>
          {timeFeatures.is_rush_hour && <div className="rush-badge">Rush Hour</div>}
          {timeFeatures.is_weekend && <div className="weekend-badge">Wochenende</div>}
        </div>
      )}

      <div className="swipe-hint">
        <ChevronRightIcon size={16} />
        <span>Wischen für Linien</span>
      </div>
    </div>
  );
}

function PredictionSlide({ prediction, lineStats, onBackToOverview }: {
  prediction: Prediction;
  lineStats?: LineStats;
  onBackToOverview: () => void;
}) {
  const delay = prediction.predicted_delay_minutes;
  const status = getDelayStatus(delay);
  const probability = prediction.classification?.probability_delayed ?? 0;
  const currentDelay = lineStats?.delay_minutes ?? 0;
  const trend = delay !== null ? delay - currentDelay : 0;

  return (
    <div className={`carousel-slide prediction-slide prediction-${status}`}>
      <div className="swipe-hint swipe-hint-back" onClick={onBackToOverview} style={{ cursor: "pointer" }}>
        <ChevronLeftIcon size={16} />
        <span>Zurück zur Übersicht</span>
      </div>
      <div className="prediction-header">
        <VehicleIcon type={prediction.vehicle_type} size={32} />
        <div className="prediction-line-info">
          <span className="prediction-line-name">{prediction.line}</span>
          {prediction.direction && (
            <span className="prediction-direction">{prediction.direction}</span>
          )}
        </div>
      </div>

      <div className="prediction-main">
        <div className={`prediction-delay ${status}`}>
          <span className="delay-number">{delay !== null ? delay.toFixed(1) : "—"}</span>
          <span className="delay-unit">min</span>
        </div>
        <div className="prediction-status">
          {delay !== null && delay < 2 ? "Pünktlich erwartet" :
           delay !== null && delay < 5 ? "Leichte Verspätung" : "Verspätung erwartet"}
        </div>
      </div>

      <div className="prediction-probability">
        <div className="prob-header">
          <span className="prob-label">Wahrscheinlichkeit</span>
          <span className={`prob-value ${status}`}>{(probability * 100).toFixed(0)}%</span>
        </div>
        <div className="prob-bar">
          <div className={`prob-fill prob-${status}`} style={{ width: `${probability * 100}%` }} />
        </div>
      </div>

      {lineStats && (
        <div className="prediction-comparison">
          <div className="comparison-item">
            <span className="comp-label">Aktuell</span>
            <span className="comp-value">{currentDelay.toFixed(1)} min</span>
          </div>
          <div className={`comparison-trend ${trend > 0 ? "trend-up" : "trend-down"}`}>
            {trend > 0 ? <TrendUpIcon size={20} /> : <TrendDownIcon size={20} />}
            <span>{trend > 0 ? "+" : ""}{trend.toFixed(1)}</span>
          </div>
          <div className="comparison-item">
            <span className="comp-label">Prognose</span>
            <span className="comp-value">{delay?.toFixed(1) ?? "—"} min</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function PredictionsScreen({
  predictions,
  weather,
  weatherImpact,
  timeFeatures,
  lineStatsMap,
}: PredictionsScreenProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const totalSlides = predictions.length + 1;

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const handleScroll = () => {
      const slideWidth = carousel.clientWidth;
      const newSlide = Math.round(carousel.scrollLeft / slideWidth);
      setActiveSlide(Math.min(newSlide, totalSlides - 1));
    };

    // Wrap-around when scrolling past boundaries (horizontal scroll only)
    const handleWheel = (e: WheelEvent) => {
      // Only handle horizontal scroll for wrap-around
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      
      const slideWidth = carousel.clientWidth;
      const maxScroll = slideWidth * (totalSlides - 1);
      const isAtEnd = carousel.scrollLeft >= maxScroll - 2;
      const isAtStart = carousel.scrollLeft <= 2;
      
      if (isAtEnd && e.deltaX > 5) {
        e.preventDefault();
        carousel.scrollTo({ left: 0, behavior: "smooth" });
      } else if (isAtStart && e.deltaX < -5) {
        e.preventDefault();
        carousel.scrollTo({ left: maxScroll, behavior: "smooth" });
      }
    };

    carousel.addEventListener("scroll", handleScroll, { passive: true });
    carousel.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      carousel.removeEventListener("scroll", handleScroll);
      carousel.removeEventListener("wheel", handleWheel);
    };
  }, [totalSlides]);

  const scrollToSlide = useCallback((index: number) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    
    let targetIndex = index;
    if (index >= totalSlides) targetIndex = 0;
    if (index < 0) targetIndex = totalSlides - 1;
    
    carousel.scrollTo({ left: targetIndex * carousel.clientWidth, behavior: "smooth" });
    setActiveSlide(targetIndex);
  }, [totalSlides]);

  const navigateCarousel = useCallback((direction: "left" | "right") => {
    if (direction === "right") {
      scrollToSlide(activeSlide >= totalSlides - 1 ? 0 : activeSlide + 1);
    } else {
      scrollToSlide(activeSlide <= 0 ? totalSlides - 1 : activeSlide - 1);
    }
  }, [activeSlide, totalSlides, scrollToSlide]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        navigateCarousel("left");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        navigateCarousel("right");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigateCarousel]);

  if (predictions.length === 0) {
    return (
      <div className="screen card-bg-neutral">
        <h2 className="slide-title">Prognose</h2>
        <p className="text-muted">Keine Vorhersagen verfügbar</p>
      </div>
    );
  }

  return (
    <div className="screen card-bg-neutral">
      <div className="carousel-container" ref={carouselRef}>
        <ContextSlide weather={weather} weatherImpact={weatherImpact} timeFeatures={timeFeatures} />
        {predictions.map((pred) => (
          <PredictionSlide
            key={pred.line}
            prediction={pred}
            lineStats={lineStatsMap.get(pred.line)}        
            onBackToOverview={() => scrollToSlide(0)}
          />
        ))}
      </div>

      <div className="carousel-dots">
        {Array.from({ length: Math.min(totalSlides, 8) }).map((_, i) => (
          <button
            key={i}
            className={`carousel-dot ${activeSlide === i ? "active" : ""}`}
            onClick={() => scrollToSlide(i)}
          />
        ))}
        {totalSlides > 8 && <span className="dots-more">+{totalSlides - 8}</span>}
      </div>
    </div>
  );
}
