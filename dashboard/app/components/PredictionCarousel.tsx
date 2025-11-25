"use client";

import { useRef, useState, useEffect } from "react";
import { Prediction, Weather, WeatherImpact, LineStats } from "@/lib/api";
import { PredictionDetailSlide } from "./PredictionDetailSlide";

interface PredictionCarouselProps {
  predictions: Prediction[];
  weather?: Weather;
  weatherImpact?: WeatherImpact;
  timeFeatures?: {
    hour_of_day: number;
    day_of_week: number;
    is_rush_hour: boolean;
    is_weekend: boolean;
  };
  lineStatsMap?: Map<string, LineStats>;
}

const weatherIcons: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌧️", 53: "🌧️", 55: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "🌨️",
  80: "🌧️", 81: "🌧️", 82: "🌧️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

const dayNames: Record<number, string> = {
  1: "Sonntag", 2: "Montag", 3: "Dienstag", 4: "Mittwoch",
  5: "Donnerstag", 6: "Freitag", 7: "Samstag"
};

export function PredictionCarousel({
  predictions,
  weather,
  weatherImpact,
  timeFeatures,
  lineStatsMap,
}: PredictionCarouselProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  // Total slides = 1 (weather context) + predictions
  const totalSlides = 1 + predictions.length;

  const weatherIcon = weather ? weatherIcons[weather.weather_code] || "🌡️" : "🌡️";

  // Handle scroll
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

  // Scroll to slide
  const scrollToSlide = (index: number) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    carousel.scrollTo({
      left: index * carousel.offsetWidth,
      behavior: "smooth",
    });
  };

  if (predictions.length === 0) {
    return (
      <div className="prediction-carousel-container card-bg-neutral">
        <div className="prediction-carousel">
          <div className="prediction-carousel-slide prediction-empty">
            <span className="text-5xl mb-4">🤖</span>
            <h2 className="display-medium">ML Predictions</h2>
            <p className="text-muted mt-2 text-center">
              Keine Predictions verfügbar.<br />
              Stelle sicher, dass die Modelle trainiert sind.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="prediction-carousel-container card-bg-neutral">
      {/* Horizontal Carousel */}
      <div ref={carouselRef} className="prediction-carousel">
        {/* Slide 0: Weather & Context Summary */}
        <div className="prediction-carousel-slide context-slide">
          <h2 className="context-title">🤖 ML Predictions</h2>
          <p className="context-subtitle">Basierend auf aktuellen Bedingungen</p>

          {/* Weather Card */}
          {weather && (
            <div className="context-weather-card">
              <div className="weather-main">
                <span className="weather-icon-large">{weatherIcon}</span>
                <div className="weather-temp">
                  <span className="temp-value">{weather.temperature_c.toFixed(0)}°</span>
                  <span className="temp-unit">C</span>
                </div>
              </div>
              <div className="weather-details">
                <div className="detail">
                  <span className="detail-icon">💧</span>
                  <span>{weather.precipitation_mm.toFixed(1)} mm</span>
                </div>
                <div className="detail">
                  <span className="detail-icon">💨</span>
                  <span>{weather.wind_speed_kmh.toFixed(0)} km/h</span>
                </div>
                <div className="detail">
                  <span className="detail-icon">☁️</span>
                  <span>{weather.cloud_cover_percent}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Weather Impact */}
          {weatherImpact && (
            <div className={`context-impact impact-${weatherImpact.level}`}>
              <span className="impact-icon">
                {weatherImpact.level === "low" ? "✅" : 
                 weatherImpact.level === "medium" ? "⚠️" : "🚨"}
              </span>
              <div className="impact-info">
                <span className="impact-level">
                  {weatherImpact.level === "low" ? "Geringer" : 
                   weatherImpact.level === "medium" ? "Mittlerer" : "Hoher"} Einfluss
                </span>
                <span className="impact-desc">{weatherImpact.description}</span>
              </div>
            </div>
          )}

          {/* Time Context */}
          {timeFeatures && (
            <div className="context-time">
              <div className="time-badge">
                <span className="time-icon">{timeFeatures.is_rush_hour ? "🚦" : "🕐"}</span>
                <span className="time-text">
                  {timeFeatures.hour_of_day}:00 Uhr, {dayNames[timeFeatures.day_of_week]}
                </span>
              </div>
              {timeFeatures.is_rush_hour && (
                <div className="rush-hour-badge">Rush Hour!</div>
              )}
              {timeFeatures.is_weekend && (
                <div className="weekend-badge">Wochenende</div>
              )}
            </div>
          )}

          {/* Swipe Hint */}
          <div className="swipe-hint-predictions">
            <span>{predictions.length} Predictions →</span>
          </div>
        </div>

        {/* Prediction Detail Slides */}
        {predictions.map((pred, index) => (
          <div key={`${pred.line}-${index}`} className="prediction-carousel-slide">
            <PredictionDetailSlide
              prediction={pred}
              historicalStats={lineStatsMap?.get(pred.line)}
              isFirst={index === 0}
            />
          </div>
        ))}
      </div>

      {/* Pagination Dots */}
      <div className="prediction-carousel-pagination">
        {Array.from({ length: Math.min(totalSlides, 12) }).map((_, i) => (
          <button
            key={i}
            className={`pagination-dot ${activeSlide === i ? "active" : ""} ${i === 0 ? "context-dot" : ""}`}
            onClick={() => scrollToSlide(i)}
            aria-label={i === 0 ? "Kontext" : `Prediction ${i}`}
          />
        ))}
        {totalSlides > 12 && (
          <span className="pagination-more">+{totalSlides - 12}</span>
        )}
      </div>
    </div>
  );
}

