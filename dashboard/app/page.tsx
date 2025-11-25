"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useDashboardData } from "@/hooks/useDelayData";
import { Journey, LineStats } from "@/lib/api";
import { OverviewCard, OverviewCardSkeleton } from "./components/OverviewCard";
import { ThemeToggle } from "./components/ThemeToggle";
import { TimeHeatmap } from "./components/TimeHeatmap";
import { LineHeatmap } from "./components/LineHeatmap";
import { PredictionCarousel } from "./components/PredictionCarousel";
import { LineCardWithCarousel, LineCardSkeleton } from "./components/LineCardWithCarousel";
import { JourneyDetailModal } from "./components/JourneyDetailModal";

export default function Dashboard() {
  const { stats, lines, live, isLoading } = useDashboardData();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const programmaticScrollRef = useRef(false);
  
  // Journey detail modal state
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);

  // Sort lines by delay (worst first for drama)
  const sortedLines = [...(lines.lines || [])].sort(
    (a, b) => b.avg_delay_minutes - a.avg_delay_minutes
  );

  // Create prediction lookup by line
  const predictionsByLine = new Map<string, (typeof live.predictions)[0]>();
  (live.predictions || []).forEach(pred => {
    predictionsByLine.set(pred.line, pred);
  });

  // Create lineStats lookup for predictions
  const lineStatsMap = new Map<string, LineStats>();
  sortedLines.forEach(line => {
    lineStatsMap.set(line.line, line);
  });

  // Total cards: 1 overview + 1 predictions + 1 time heatmap + 1 line heatmap + all lines
  const totalCards = 4 + sortedLines.length;

  // Navigate to a specific index
  const navigateTo = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;
    
    // Wrap around
    let targetIndex = index;
    if (index >= totalCards) targetIndex = 0;
    if (index < 0) targetIndex = totalCards - 1;
    
    // Mark as programmatic scroll
    programmaticScrollRef.current = true;
    
    // Update state
    setActiveIndex(targetIndex);
    
    // Scroll to the card
    const cardHeight = container.clientHeight;
    container.scrollTo({
      top: targetIndex * cardHeight,
      behavior: "smooth"
    });
    
    // Reset flag after scroll animation
    setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 1000);
  }, [totalCards]);

  // Track scroll position - continuously poll for reliable updates
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number;
    let lastScrollTop = container.scrollTop;
    let lastIndex = activeIndex;

    const pollScrollPosition = () => {
      // Skip if programmatic scroll is active
      if (programmaticScrollRef.current) {
        rafId = requestAnimationFrame(pollScrollPosition);
        return;
      }

      const currentScrollTop = container.scrollTop;
      
      // Only update if scroll position actually changed
      if (Math.abs(currentScrollTop - lastScrollTop) > 5) {
        lastScrollTop = currentScrollTop;
        
        const cardHeight = container.clientHeight;
        if (cardHeight === 0) {
          rafId = requestAnimationFrame(pollScrollPosition);
          return;
        }
        
        const newIndex = Math.round(currentScrollTop / cardHeight);
        const clampedIndex = Math.max(0, Math.min(newIndex, totalCards - 1));
        
        if (clampedIndex !== lastIndex) {
          lastIndex = clampedIndex;
          setActiveIndex(clampedIndex);
        }
      }
      
      rafId = requestAnimationFrame(pollScrollPosition);
    };

    // Start polling
    rafId = requestAnimationFrame(pollScrollPosition);
    
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [totalCards, activeIndex]);

  // Loop detection: when at last card and user scrolls down, go to first
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (programmaticScrollRef.current) return;
      
      // If at the last card and scrolling down
      if (e.deltaY > 0 && activeIndex === totalCards - 1) {
        e.preventDefault();
        navigateTo(0);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [activeIndex, totalCards, navigateTo]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // Check if we're inside a horizontal carousel
      const activeElement = document.activeElement as HTMLElement;
      const isInCarousel = activeElement?.closest('.prediction-carousel') || 
                          activeElement?.closest('.journey-carousel') ||
                          activeElement?.closest('.line-carousel');

      // Horizontal navigation for carousels
      if (isInCarousel && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const carousel = activeElement.closest('.prediction-carousel') as HTMLElement ||
                        activeElement.closest('.journey-carousel') as HTMLElement ||
                        activeElement.closest('.line-carousel') as HTMLElement;
        
        if (carousel) {
          e.preventDefault();
          e.stopPropagation();
          
          // Find the currently visible slide
          const slides = carousel.querySelectorAll('[class*="-slide"]');
          const carouselRect = carousel.getBoundingClientRect();
          const carouselCenter = carouselRect.left + carouselRect.width / 2;
          
          let currentSlide: Element | null = null;
          let minDistance = Infinity;
          
          slides.forEach(slide => {
            const slideRect = slide.getBoundingClientRect();
            const slideCenter = slideRect.left + slideRect.width / 2;
            const distance = Math.abs(slideCenter - carouselCenter);
            
            if (distance < minDistance) {
              minDistance = distance;
              currentSlide = slide;
            }
          });
          
          if (currentSlide) {
            const currentIndex = Array.from(slides).indexOf(currentSlide);
            const direction = e.key === "ArrowRight" ? 1 : -1;
            const nextIndex = Math.max(0, Math.min(currentIndex + direction, slides.length - 1));
            const nextSlide = slides[nextIndex];
            
            if (nextSlide) {
              nextSlide.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center"
              });
            }
          } else {
            // Fallback: scroll by viewport width
            const scrollAmount = carousel.clientWidth;
            const scrollDirection = e.key === "ArrowRight" ? scrollAmount : -scrollAmount;
            carousel.scrollBy({
              left: scrollDirection,
              behavior: "smooth"
            });
          }
        }
        return;
      }

      // Vertical navigation for main feed
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        navigateTo(activeIndex + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        navigateTo(activeIndex - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        navigateTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        navigateTo(totalCards - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, totalCards, navigateTo]);

  // Make carousels focusable for keyboard navigation
  useEffect(() => {
    const makeCarouselsFocusable = () => {
      const carousels = document.querySelectorAll('.prediction-carousel, .journey-carousel, .line-carousel');
      carousels.forEach(carousel => {
        if (!carousel.hasAttribute('tabindex')) {
          (carousel as HTMLElement).setAttribute('tabindex', '0');
        }
      });
    };

    // Run after initial render and when activeIndex changes (new cards might be rendered)
    makeCarouselsFocusable();
    const interval = setInterval(makeCarouselsFocusable, 1000);
    
    return () => clearInterval(interval);
  }, [activeIndex]);

  // Handle line click from heatmap
  const handleLineClick = useCallback((line: string) => {
    const lineIndex = sortedLines.findIndex(l => l.line === line);
    if (lineIndex !== -1) {
      // 4 = overview + predictions + time heatmap + line heatmap
      navigateTo(4 + lineIndex);
    }
  }, [sortedLines, navigateTo]);

  // Handle journey click (open detail modal)
  const handleJourneyClick = useCallback((journey: Journey) => {
    setSelectedJourney(journey);
  }, []);

  // Close journey modal
  const handleCloseModal = useCallback(() => {
    setSelectedJourney(null);
  }, []);

  // Loading state
  if (isLoading || !stats.stats) {
    return (
      <div className="feed-container" ref={containerRef}>
        <OverviewCardSkeleton />
        {[...Array(3)].map((_, i) => (
          <LineCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Minimal Header */}
      <header className="minimal-header">
        <div className="flex items-center gap-3">
          <span className="text-xl">🚆</span>
          <span className="font-semibold tracking-tight">DB Pranger</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="live-indicator">
            <span className="live-dot" />
            <span>Live</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Progress Dots */}
      <div className="progress-dots">
        {Array.from({ length: Math.min(totalCards, 12) }).map((_, i) => (
          <button
            key={i}
            className={`progress-dot ${activeIndex === i ? "active" : ""}`}
            onClick={() => navigateTo(i)}
            aria-label={`Zur Karte ${i + 1}`}
          />
        ))}
        {totalCards > 12 && (
          <span className="text-xs text-soft mt-1">+{totalCards - 12}</span>
        )}
      </div>

      {/* Feed Container */}
      <div className="feed-container" ref={containerRef}>
        {/* 1. Overview Card (Index 0) */}
        <OverviewCard
          avgDelay={stats.stats.avg_delay_minutes}
          delayedPercentage={stats.stats.delayed_percentage}
          totalJourneys={stats.stats.total_journeys}
          activeLines={stats.stats.active_lines}
          weather={live.weather}
          weatherImpact={live.weatherImpact}
        />

        {/* 2. Predictions Carousel (Index 1) */}
        <PredictionCarousel
          predictions={live.predictions || []}
          weather={live.weather}
          weatherImpact={live.weatherImpact}
          timeFeatures={live.timeFeatures}
          lineStatsMap={lineStatsMap}
        />

        {/* 3. Time Heatmap (Index 2) */}
        <TimeHeatmap />

        {/* 4. Line Heatmap (Index 3) */}
        <LineHeatmap 
          lines={sortedLines} 
          onLineClick={handleLineClick}
        />

        {/* 5+. Line Cards with integrated Journey Carousel (Index 4+) */}
        {sortedLines.map((line) => (
          <LineCardWithCarousel
            key={line.line}
            lineStats={line}
            prediction={predictionsByLine.get(line.line)}
            onJourneyClick={handleJourneyClick}
          />
        ))}
      </div>

      {/* Scroll Indicator (only on first card) */}
      {activeIndex === 0 && (
        <div className="scroll-indicator">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <span>Scroll</span>
        </div>
      )}

      {/* Journey Detail Modal */}
      <JourneyDetailModal
        journey={selectedJourney}
        onClose={handleCloseModal}
      />
    </>
  );
}
