"use client";

import { useRef, useState, useEffect } from "react";
import { Journey } from "@/lib/api";
import { JourneySlide } from "./JourneySlide";

interface JourneyCarouselProps {
  line: string;
  journeys: Journey[];
  vehicleType: string | null;
  onJourneyClick: (journey: Journey) => void;
  isLoading?: boolean;
}

const vehicleIcons: Record<string, string> = {
  U_BAHN: "🚇",
  METROBUS: "🚌",
  BUS: "🚌",
  S_BAHN: "🚆",
  TRAIN: "🚆",
  FERRY: "⛴️",
};

export function JourneyCarousel({
  line,
  journeys,
  vehicleType,
  onJourneyClick,
  isLoading,
}: JourneyCarouselProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const icon = vehicleIcons[vehicleType || "BUS"] || "🚌";

  // Handle scroll to update active index
  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const handleScroll = () => {
      const scrollPos = carousel.scrollLeft;
      const slideWidth = carousel.offsetWidth * 0.85; // 85% width per slide
      const newIndex = Math.round(scrollPos / slideWidth);
      setActiveIndex(Math.min(newIndex, journeys.length - 1));
    };

    carousel.addEventListener("scroll", handleScroll, { passive: true });
    return () => carousel.removeEventListener("scroll", handleScroll);
  }, [journeys.length]);

  // Mouse/Touch drag handlers for smooth carousel experience
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (carouselRef.current?.offsetLeft || 0));
    setScrollLeft(carouselRef.current?.scrollLeft || 0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (carouselRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 1.5;
    if (carouselRef.current) {
      carouselRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Scroll to specific slide
  const scrollToSlide = (index: number) => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const slideWidth = carousel.offsetWidth * 0.85;
    carousel.scrollTo({
      left: index * slideWidth,
      behavior: "smooth",
    });
  };

  if (isLoading) {
    return (
      <div className="journey-carousel-container">
        <div className="journey-carousel-header">
          <div className="skeleton w-16 h-6" />
          <div className="skeleton w-24 h-4" />
        </div>
        <div className="journey-carousel">
          <div className="skeleton journey-slide-skeleton" />
        </div>
      </div>
    );
  }

  if (journeys.length === 0) {
    return (
      <div className="journey-carousel-container">
        <div className="journey-carousel-header">
          <span className="text-xl">{icon}</span>
          <span className="font-semibold">{line}</span>
        </div>
        <div className="text-center py-6 text-muted text-sm">
          Keine Fahrten gefunden
        </div>
      </div>
    );
  }

  return (
    <div className="journey-carousel-container">
      {/* Header */}
      <div className="journey-carousel-header">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-lg font-semibold">{line}</span>
        </div>
        <span className="text-sm text-muted">
          {journeys.length} Fahrt{journeys.length !== 1 ? "en" : ""}
        </span>
      </div>

      {/* Carousel */}
      <div
        ref={carouselRef}
        className={`journey-carousel ${isDragging ? "grabbing" : ""}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {journeys.map((journey, index) => (
          <JourneySlide
            key={journey.journey_id}
            journey={journey}
            isActive={index === activeIndex}
            onClick={() => onJourneyClick(journey)}
          />
        ))}
      </div>

      {/* Pagination Dots */}
      {journeys.length > 1 && (
        <div className="journey-carousel-dots">
          {journeys.slice(0, Math.min(10, journeys.length)).map((_, index) => (
            <button
              key={index}
              className={`carousel-dot ${index === activeIndex ? "active" : ""}`}
              onClick={() => scrollToSlide(index)}
              aria-label={`Fahrt ${index + 1}`}
            />
          ))}
          {journeys.length > 10 && (
            <span className="text-xs text-muted ml-1">
              +{journeys.length - 10}
            </span>
          )}
        </div>
      )}

      {/* Swipe hint (first slide only) */}
      {activeIndex === 0 && journeys.length > 1 && (
        <div className="carousel-swipe-hint">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span>Swipe für mehr Fahrten</span>
        </div>
      )}
    </div>
  );
}

