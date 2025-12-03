"use client";

import { useState, useEffect } from "react";
import { LineStats, StatsOverview } from "@/lib/api";
import { VehicleIcon, TrendUpIcon, AlertCircleIcon, ClockIcon } from "../icons";

interface ShameboardScreenProps {
  lines: LineStats[];
  stats: StatsOverview;
}

function TrophyIcon({ place, size = 32 }: { place: 1 | 2 | 3; size?: number }) {
  const colors = {
    1: "#FFD700",
    2: "#C0C0C0", 
    3: "#CD7F32"
  };
  
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors[place]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function SkullIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <path d="M8 20v2h8v-2" />
      <path d="m12.5 17-.5-1-.5 1h1z" fill="currentColor" />
      <path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20" />
    </svg>
  );
}

function RankingCard({ line, rank, isAnimating }: { 
  line: LineStats; 
  rank: number; 
  isAnimating: boolean;
}) {
  const isTopThree = rank <= 3;
  
  return (
    <div 
      className={`ranking-card ranking-${rank <= 3 ? rank : "other"} ${isAnimating ? "animate-rank" : ""}`}
      style={{ animationDelay: `${rank * 0.1}s` }}
    >
      <div className="rank-badge">
          <span className="rank-number">#{rank}</span>
        </div>
      
      <div className="rank-content">
        <div className="rank-header">
          <VehicleIcon type={line.vehicle_type} size={24} />
          <span className="rank-line-name">{line.line}</span>
        </div>
        
        <div className={`rank-delay status-${line.status}`}>
          <span className="rank-delay-value">+{line.delay_minutes}</span>
          <span className="rank-delay-unit">min</span>
        </div>
        
        <div className="rank-stats">
          <span className="rank-stat">
            <AlertCircleIcon size={14} />
            {line.delayed_percentage.toFixed(0)}% verspätet
          </span>
          <span className="rank-stat">
            Max: {line.max_delay_minutes} min
          </span>
        </div>
      </div>
    </div>
  );
}

export function ShameboardScreen({ lines, stats }: ShameboardScreenProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const worstLines = lines.slice(0, 5);
  const champion = worstLines[0];
  
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const totalDelayMinutes = lines.reduce((sum, l) => sum + l.delay_minutes * l.total_journeys, 0);
  const avgDelayAcrossAll = totalDelayMinutes / Math.max(lines.reduce((sum, l) => sum + l.total_journeys, 0), 1);

  return (
    <div className="screen shameboard-screen">
      <div className="shameboard-header">
        <SkullIcon size={32} />
        <h2 className="shameboard-title">Hall of Shame</h2>
      </div>

      {champion && (
        <div className="champion-card-wrapper">
          <div className={`champion-card ${isAnimating ? "animate-champion" : ""}`}>
            <div className="champion-badge">WORST PERFORMER</div>
            <div className="champion-line">
              <VehicleIcon type={champion.vehicle_type} size={36} />
              <span className="champion-name">{champion.line}</span>
            </div>
            <div className="champion-delay">
              <span className="champion-value">+{champion.delay_minutes}</span>
              <span className="champion-unit">min</span>
            </div>
            <div className="champion-shame-text">
              {champion.delayed_percentage.toFixed(0)}% aller Fahrten verspätet
            </div>
          </div>
        </div>
      )}

      <div className="ranking-list">
        {worstLines.slice(1).map((line, idx) => (
          <RankingCard 
            key={line.line} 
            line={line} 
            rank={idx + 2} 
            isAnimating={isAnimating}
          />
        ))}
      </div>

      <div className="shameboard-stats">
        <div className="shame-stat">
          <span className="shame-stat-value">{stats.total_journeys.toLocaleString()}</span>
          <span className="shame-stat-label">Fahrten analysiert</span>
        </div>
        <div className="shame-stat">
          <span className="shame-stat-value">{avgDelayAcrossAll.toFixed(1)} min</span>
          <span className="shame-stat-label">Durchschnitt gesamt</span>
        </div>
        <div className="shame-stat">
          <span className="shame-stat-value text-critical">{stats.delayed_percentage.toFixed(0)}%</span>
          <span className="shame-stat-label">verspätet</span>
        </div>
      </div>
    </div>
  );
}

