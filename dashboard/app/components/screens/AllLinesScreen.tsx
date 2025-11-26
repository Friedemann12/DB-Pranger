"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useJourneysByLine, useJourneyDetail } from "@/hooks/useDelayData";
import { LineStats, Journey, JourneySegment } from "@/lib/api";
import { VehicleIcon, SearchIcon, XIcon, ChevronRightIcon, ChevronLeftIcon, MapPinIcon, ClockIcon, ArrowRightIcon } from "../icons";

interface AllLinesScreenProps {
  lines: LineStats[];
}

function getStatus(avgDelay: number): "good" | "warning" | "critical" {
  if (avgDelay < 2) return "good";
  if (avgDelay < 5) return "warning";
  return "critical";
}

function summarizeSegments(segments: JourneySegment[]): Array<{station: string; delay: number; status: string; time: number}> {
  const stationMap = new Map<string, {delay: number; time: number}>();
  
  segments.forEach(seg => {
    stationMap.set(seg.start_station, {
      delay: seg.delay_minutes,
      time: seg.start_timestamp
    });
  });

  if (segments.length > 0) {
    const lastSeg = segments[segments.length - 1];
    stationMap.set(lastSeg.end_station, {
      delay: lastSeg.delay_minutes,
      time: lastSeg.start_timestamp + 60
    });
  }

  return Array.from(stationMap.entries()).map(([station, data]) => ({
    station,
    delay: data.delay,
    status: data.delay < 2 ? "good" : data.delay < 5 ? "warning" : "critical",
    time: data.time
  }));
}

function OverviewSlide({ lines, searchQuery, setSearchQuery, onLineClick }: {
  lines: LineStats[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onLineClick: (line: LineStats) => void;
}) {
  const filteredLines = searchQuery
    ? lines.filter(l => l.line.toLowerCase().includes(searchQuery.toLowerCase()))
    : lines;

  const grouped = filteredLines.reduce((acc, line) => {
    const type = line.vehicle_type || "OTHER";
    if (!acc[type]) acc[type] = [];
    acc[type].push(line);
    return acc;
  }, {} as Record<string, LineStats[]>);

  const typeOrder = ["U_BAHN", "S_BAHN", "METROBUS", "BUS", "FERRY", "OTHER"];
  const sortedTypes = Object.keys(grouped).sort(
    (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b)
  );

  return (
    <div className="carousel-slide overview-slide">
      <h2 className="slide-title">Alle Linien</h2>
      <p className="slide-subtitle">{lines.length} Linien im Überblick</p>

      <div className="search-container">
        <SearchIcon size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Linie suchen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="search-clear">
            <XIcon size={16} />
          </button>
        )}
      </div>

      <div className="lines-overview">
        {sortedTypes.map((type) => (
          <div key={type} className="line-group">
            <div className="line-group-header">
              <VehicleIcon type={type} size={18} />
              <span className="line-group-name">{type.replace("_", "-")}</span>
              <span className="line-group-count">{grouped[type].length}</span>
            </div>
            <div className="line-pills">
              {grouped[type]
                .sort((a, b) => b.delay_minutes - a.delay_minutes)
                .map((line) => (
                  <button
                    key={line.line}
                    className={`line-pill line-pill-${line.status}`}
                    onClick={() => onLineClick(line)}
                  >
                    <span className="line-pill-name">{line.line}</span>
                    <span className="line-pill-delay">+{line.delay_minutes}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="swipe-hint">
        <ChevronRightIcon size={16} />
        <span>Wischen für Details</span>
      </div>
    </div>
  );
}

function LineSlide({ line, onShowJourneys, onBackToOverview }: {
  line: LineStats;
  onShowJourneys: () => void;
  onBackToOverview: () => void;
}) {
  const status = getStatus(line.delay_minutes);

  return (
    <div className={`carousel-slide line-slide line-slide-${status}`}>
      <div className="swipe-hint swipe-hint-back" onClick={onBackToOverview} style={{ cursor: "pointer" }}>
        <ChevronLeftIcon size={16} />
        <span>Zurück zur Übersicht</span>
      </div>
      <div className="line-header">
        <VehicleIcon type={line.vehicle_type} size={36} />
        <div className="line-info">
          <span className="line-name">{line.line}</span>
          <span className="line-type">{line.vehicle_type?.replace("_", "-") || "Bus"}</span>
        </div>
      </div>

      <div className={`line-delay ${status}`}>
        <span className="delay-number">{line.delay_minutes}</span>
        <span className="delay-unit">min</span>
      </div>

      <div className="line-stats">
        <div className="line-stat">
          <span className="stat-value">{line.max_delay_minutes}</span>
          <span className="stat-label">Max</span>
        </div>
        <div className="line-stat">
          <span className="stat-value">{line.delayed_percentage.toFixed(0)}%</span>
          <span className="stat-label">Verspätet</span>
        </div>
        <div className="line-stat">
          <span className="stat-value">{line.total_journeys}</span>
          <span className="stat-label">Fahrten</span>
        </div>
      </div>

      <button className="view-journeys-btn" onClick={onShowJourneys}>
        <span>Fahrten anzeigen</span>
        <ArrowRightIcon size={18} />
      </button>

    </div>
  );
}

function JourneysModal({ line, onClose }: {
  line: LineStats;
  onClose: () => void;
}) {
  const { journeys, isLoading } = useJourneysByLine(line.line, 50);
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  const formatTime = (timestamp: number | null): string => {
    if (!timestamp) return "—";
    return new Date(timestamp * 1000).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const shortenId = (id: string): string => {
    if (!id) return "#?";
    // Extract subline and Fahrt number for a unique identifier
    // Format: "HHA-U:U3_HHA-U.1.45.6J86IO.N.450.null (subline 45, sdIndex 19, Fahrt 0)"
    const sublineMatch = id.match(/subline\s*(\d+)/i);
    const sdIndexMatch = id.match(/sdIndex\s*(\d+)/i);
    const fahrtMatch = id.match(/Fahrt\s*(\d+)/i);
    
    if (sublineMatch && fahrtMatch) {
      const sdPart = sdIndexMatch ? `.${sdIndexMatch[1]}` : "";
      return `#${sublineMatch[1]}${sdPart}.${fahrtMatch[1]}`;
    }
    
    // If it's just a number or short string, use it directly
    if (id.length <= 12) return `#${id}`;
    
    // Otherwise take last 10 characters (often more unique)
    return `#${id.slice(-10)}`;
  };

  const modalContent = (
    <div 
      className="modal-overlay" 
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onWheel={handleWheel}
    >
      <div ref={modalRef} className="journeys-modal slide-up" onWheel={handleWheel}>
        <div className="modal-header">
          <div className="modal-title-row">
            <VehicleIcon type={line.vehicle_type} size={24} />
            <h2 className="modal-title">{line.line}</h2>
            <span className="modal-subtitle">{journeys.length} Fahrten</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>

        <div className="journeys-list" ref={listRef} onWheel={handleWheel}>
          {isLoading ? (
            <div className="journeys-loading">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton journey-skeleton" />
              ))}
            </div>
          ) : journeys.length === 0 ? (
            <div className="journeys-empty">Keine Fahrten gefunden</div>
          ) : (
            journeys.map((journey) => (
              <JourneyCard
                key={journey.journey_id}
                journey={journey}
                shortenId={shortenId}
                formatTime={formatTime}
                isSelected={selectedJourney?.journey_id === journey.journey_id}
                onClick={() => setSelectedJourney(
                  selectedJourney?.journey_id === journey.journey_id ? null : journey
                )}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );

  // Use portal to render modal at document.body level to escape transform context
  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}

function JourneyCard({ journey, shortenId, formatTime, isSelected, onClick }: {
  journey: Journey;
  shortenId: (id: string) => string;
  formatTime: (ts: number | null) => string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { segments, isLoading } = useJourneyDetail(isSelected ? journey.journey_id : null);
  const status = journey.status;
  const summarized = segments.length > 0 ? summarizeSegments(segments) : [];

  return (
    <div className={`journey-card journey-card-${status} ${isSelected ? "expanded" : ""}`}>
      <button className="journey-card-main" onClick={onClick}>
        <div className="journey-id">{shortenId(journey.journey_id)}</div>
        <div className="journey-route">
          <span className="journey-station">{journey.first_station || "Start"}</span>
          <ArrowRightIcon size={14} className="journey-arrow" />
          <span className="journey-station">{journey.last_station || "Ziel"}</span>
        </div>
        <div className={`journey-delay-badge ${status}`}>
          {journey.delay_minutes > 0 ? "+" : ""}{journey.delay_minutes} min
        </div>
      </button>

      {isSelected && (
        <div className="journey-details">
          {isLoading ? (
            <div className="skeleton h-20" />
          ) : summarized.length > 0 ? (
            <div className="journey-stations">
              {summarized.slice(0, 6).map((item, i) => (
                <div key={i} className="station-row">
                  <div className="station-timeline">
                    <div className={`station-dot ${item.status}`} />
                    {i < Math.min(summarized.length - 1, 5) && <div className="station-line" />}
                  </div>
                  <div className="station-info">
                    <span className="station-name">{item.station}</span>
                    <span className="station-time">{formatTime(item.time)}</span>
                  </div>
                  <div className={`station-delay ${item.status}`}>
                    {item.delay > 0 ? "+" : ""}{item.delay} min
                  </div>
                </div>
              ))}
              {summarized.length > 6 && (
                <div className="stations-more">+{summarized.length - 6} weitere Stationen</div>
              )}
            </div>
          ) : (
            <div className="text-muted text-sm">Keine Daten</div>
          )}
        </div>
      )}
    </div>
  );
}

export function AllLinesScreen({ lines }: AllLinesScreenProps) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showJourneysFor, setShowJourneysFor] = useState<LineStats | null>(null);

  const sortedLines = [...lines].sort((a, b) => b.delay_minutes - a.delay_minutes);
  const totalSlides = sortedLines.length + 1;

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

  const handleLineClick = useCallback((line: LineStats) => {
    const index = sortedLines.findIndex(l => l.line === line.line) + 1;
    scrollToSlide(index);
  }, [sortedLines, scrollToSlide]);

  const navigateCarousel = useCallback((direction: "left" | "right") => {
    if (direction === "right") {
      scrollToSlide(activeSlide >= totalSlides - 1 ? 0 : activeSlide + 1);
    } else {
      scrollToSlide(activeSlide <= 0 ? totalSlides - 1 : activeSlide - 1);
    }
  }, [activeSlide, totalSlides, scrollToSlide]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showJourneysFor) return;
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
  }, [navigateCarousel, showJourneysFor]);

  if (lines.length === 0) {
    return (
      <div className="screen card-bg-neutral">
        <h2 className="slide-title">Alle Linien</h2>
        <p className="text-muted">Keine Linien-Daten verfügbar</p>
      </div>
    );
  }

  return (
    <div className="screen card-bg-neutral">
      <div className="carousel-container" ref={carouselRef}>
        <OverviewSlide
          lines={sortedLines}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onLineClick={handleLineClick}
        />
        {sortedLines.map((line) => (
          <LineSlide
            key={line.line}
            line={line}
            onShowJourneys={() => setShowJourneysFor(line)}
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

      {showJourneysFor && (
        <JourneysModal line={showJourneysFor} onClose={() => setShowJourneysFor(null)} />
      )}
    </div>
  );
}
