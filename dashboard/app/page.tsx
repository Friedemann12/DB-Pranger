"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDashboardData } from "@/hooks/useDelayData";
import { LineStats } from "@/lib/api";
import { OverviewScreen, OverviewScreenSkeleton, PredictionsScreen, HeatmapScreen, AllLinesScreen } from "./components/screens";
import { ShameboardScreen } from "./components/screens/ShameboardScreen";
import { ThemeToggle } from "./components/ThemeToggle";
import { TrainIcon } from "./components/icons";

const TOTAL_SCREENS = 5;
const SCROLL_THRESHOLD = 80;
const MIN_LOCK_TIME = 75; // Minimum lock after navigation
const QUIET_TIME = 20; // Time without events to unlock

export default function Dashboard() {
  const { stats, lines, live, isLoading } = useDashboardData();
  const [activeScreen, setActiveScreen] = useState(0);
  const accumulatedDelta = useRef(0);
  const scrollLocked = useRef(false);
  const lockStartTime = useRef(0);
  const unlockTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sortedLines = [...(lines.lines || [])].sort(
    (a, b) => b.delay_minutes - a.delay_minutes
  );

  const lineStatsMap = new Map<string, LineStats>();
  sortedLines.forEach(line => lineStatsMap.set(line.line, line));

  const scheduleUnlock = useCallback(() => {
    if (unlockTimeout.current) clearTimeout(unlockTimeout.current);
    
    const elapsed = Date.now() - lockStartTime.current;
    const remainingMinLock = Math.max(0, MIN_LOCK_TIME - elapsed);
    const delay = remainingMinLock + QUIET_TIME;
    
    unlockTimeout.current = setTimeout(() => {
      scrollLocked.current = false;
      accumulatedDelta.current = 0;
    }, delay);
  }, []);

  const navigateTo = useCallback((direction: "up" | "down" | number) => {
    if (scrollLocked.current && typeof direction !== "number") return;
    
    scrollLocked.current = true;
    lockStartTime.current = Date.now();
    accumulatedDelta.current = 0;
    
    if (unlockTimeout.current) clearTimeout(unlockTimeout.current);
    scheduleUnlock();

    if (typeof direction === "number") {
      setActiveScreen(direction);
      return;
    }

    setActiveScreen((prev) => {
      if (direction === "down") {
        return prev >= TOTAL_SCREENS - 1 ? 0 : prev + 1;
      } else {
        return prev <= 0 ? TOTAL_SCREENS - 1 : prev - 1;
      }
    });
  }, [scheduleUnlock]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      const isInModal = target.closest(".modal-overlay");
      const isInScrollableList = target.closest(".journeys-list");
      const isInCarousel = target.closest(".carousel-container");
      
      // Let modals and scrollable lists handle their own scrolling
      if (isInModal || isInScrollableList) return;
      
      // In carousels: let horizontal scroll through, capture vertical for page nav
      if (isInCarousel && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        return; // Horizontal scroll in carousel - don't interfere
      }
      
      e.preventDefault();
      
      if (scrollLocked.current) {
        // Extend lock while momentum continues
        scheduleUnlock();
        return;
      }

      accumulatedDelta.current += e.deltaY;

      if (Math.abs(accumulatedDelta.current) >= SCROLL_THRESHOLD) {
        navigateTo(accumulatedDelta.current > 0 ? "down" : "up");
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (unlockTimeout.current) clearTimeout(unlockTimeout.current);
    };
  }, [navigateTo, scheduleUnlock]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const isHorizontalNav = e.key === "ArrowLeft" || e.key === "ArrowRight";
      if (isHorizontalNav) return;

      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        navigateTo("down");
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        navigateTo("up");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigateTo]);

  if (isLoading || !stats.stats) {
    return (
      <div className="dashboard">
        <Header />
        <main className="screen-container">
          <OverviewScreenSkeleton />
        </main>
        <ProgressDots activeScreen={0} totalScreens={TOTAL_SCREENS} onDotClick={() => {}} />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Header />

      <main className="screen-container">
        <div
          className="screens-wrapper"
          style={{ transform: `translateY(-${activeScreen * 100}vh)` }}
        >
          <OverviewScreen
            avgDelay={stats.stats.delay_minutes}
            delayedPercentage={stats.stats.delayed_percentage}
            totalJourneys={stats.stats.total_journeys}
            activeLines={stats.stats.active_lines}
            weather={live.weather}
            weatherImpact={live.weatherImpact}
          />
          <PredictionsScreen
            predictions={live.predictions || []}
            weather={live.weather}
            weatherImpact={live.weatherImpact}
            timeFeatures={live.timeFeatures}
            lineStatsMap={lineStatsMap}
          />
          <HeatmapScreen />
          <AllLinesScreen lines={sortedLines} />
          <ShameboardScreen lines={sortedLines} stats={stats.stats} />
        </div>
      </main>

      <ProgressDots
        activeScreen={activeScreen}
        totalScreens={TOTAL_SCREENS}
        onDotClick={navigateTo}
      />

      {activeScreen === 0 && <ScrollIndicator />}
    </div>
  );
}

function Header() {
  return (
    <header className="header">
      <div className="header-brand">
        <TrainIcon size={22} />
        <span className="header-title">DB Pranger</span>
      </div>
      <div className="header-actions">
        <div className="live-indicator">
          <span className="live-dot" />
          <span>Live</span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}

function ProgressDots({ activeScreen, totalScreens, onDotClick }: {
  activeScreen: number;
  totalScreens: number;
  onDotClick: (index: number) => void;
}) {
  return (
    <div className="progress-dots">
      {Array.from({ length: totalScreens }).map((_, i) => (
        <button
          key={i}
          className={`progress-dot ${activeScreen === i ? "active" : ""}`}
          onClick={() => onDotClick(i)}
          aria-label={`Screen ${i + 1}`}
        />
      ))}
    </div>
  );
}

function ScrollIndicator() {
  return (
    <div className="scroll-indicator">
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
      <span>Scroll</span>
    </div>
  );
}
