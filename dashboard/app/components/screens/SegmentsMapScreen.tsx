"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useSegmentsStats } from "@/hooks/useDelayData";
import { SegmentData, SegmentSortBy } from "@/lib/api";
import { RouteIcon, AlertCircleIcon } from "../icons";

const HAMBURG_CENTER: [number, number] = [10.0, 53.55];
const HAMBURG_ZOOM = 11;
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const SORT_OPTIONS: { value: SegmentSortBy; label: string }[] = [
  { value: "avg_delay", label: "Ø Verspätung" },
  { value: "max_delay", label: "Max Verspätung" },
  { value: "total_delay", label: "Summierte Verspätung" },
];

function getStatusColor(status: string): string {
  switch (status) {
    case "good": return "#22c55e";
    case "warning": return "#eab308";
    case "critical": return "#ef4444";
    default: return "#6b7280";
  }
}

function formatDelay(value: number, sortBy: SegmentSortBy): string {
  if (sortBy === "total_delay") {
    if (value >= 60) {
      return `${(value / 60).toFixed(1)}h`;
    }
  }
  return `${value.toFixed(1)} min`;
}

export function SegmentsMapScreen() {
  // Filter-State (nur client-seitig!)
  const [segmentCount, setSegmentCount] = useState(10);
  const [sortBy, setSortBy] = useState<SegmentSortBy>("avg_delay");
  
  // Daten laden - IMMER 100 Segmente, sortiert nach avg_delay
  // Wird nur alle 60 Sekunden aktualisiert
  const { segments: allSegments, isLoading, isError } = useSegmentsStats(100, "avg_delay");
  
  // Map-State
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<SegmentData | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Client-seitige Sortierung und Filterung
  const displaySegments = useMemo(() => {
    // Nur Segmente mit gültigen Koordinaten
    const withCoords = allSegments.filter(
      (s) => s.start_lat && s.start_lon && s.end_lat && s.end_lon
    );
    
    // Client-seitig sortieren
    const sorted = [...withCoords].sort((a, b) => {
      switch (sortBy) {
        case "max_delay":
          return b.max_delay - a.max_delay;
        case "total_delay":
          return b.total_delay - a.total_delay;
        default: // avg_delay
          return b.avg_delay - a.avg_delay;
      }
    });
    
    // Auf gewünschte Anzahl begrenzen
    return sorted.slice(0, segmentCount);
  }, [allSegments, sortBy, segmentCount]);

  // Map initialisieren
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: HAMBURG_CENTER,
      zoom: HAMBURG_ZOOM,
      pitch: 40,
      bearing: -10,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  const handleSegmentClick = useCallback(
    (e: maplibregl.MapLayerMouseEvent) => {
      const idx = e.features?.[0]?.properties?.index;
      if (idx !== undefined && displaySegments[idx]) {
        setSelectedSegment(displaySegments[idx]);
      }
    },
    [displaySegments]
  );

  const handleMouseEnter = useCallback(() => {
    mapRef.current?.getCanvas().style.setProperty("cursor", "pointer");
  }, []);

  const handleMouseLeave = useCallback(() => {
    mapRef.current?.getCanvas().style.setProperty("cursor", "");
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || displaySegments.length === 0) return;

    if (map.getLayer("segments")) map.removeLayer("segments");
    if (map.getLayer("segments-glow")) map.removeLayer("segments-glow");
    if (map.getSource("segments-data")) map.removeSource("segments-data");

    const features = displaySegments.map((seg, i) => ({
      type: "Feature" as const,
      properties: {
        index: i,
        status: seg.status,
        delay: seg.avg_delay,
        startStation: seg.start_station,
        endStation: seg.end_station,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [seg.start_lon!, seg.start_lat!],
          [seg.end_lon!, seg.end_lat!],
        ],
      },
    }));

    map.addSource("segments-data", {
      type: "geojson",
      data: { type: "FeatureCollection", features },
    });

    map.addLayer({
      id: "segments-glow",
      type: "line",
      source: "segments-data",
      paint: {
        "line-color": [
          "match",
          ["get", "status"],
          "good",
          "#22c55e",
          "warning",
          "#eab308",
          "critical",
          "#ef4444",
          "#6b7280",
        ],
        "line-width": 12,
        "line-opacity": 0.3,
        "line-blur": 4,
      },
    });

    map.addLayer({
      id: "segments",
      type: "line",
      source: "segments-data",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": [
          "match",
          ["get", "status"],
          "good",
          "#22c55e",
          "warning",
          "#eab308",
          "critical",
          "#ef4444",
          "#6b7280",
        ],
        "line-width": ["interpolate", ["linear"], ["get", "delay"], 0, 3, 5, 5, 10, 8],
        "line-opacity": 0.9,
      },
    });

    map.on("click", "segments", handleSegmentClick);
    map.on("mouseenter", "segments", handleMouseEnter);
    map.on("mouseleave", "segments", handleMouseLeave);

    return () => {
      map.off("click", "segments", handleSegmentClick);
      map.off("mouseenter", "segments", handleMouseEnter);
      map.off("mouseleave", "segments", handleMouseLeave);
    };
  }, [mapReady, displaySegments, handleSegmentClick, handleMouseEnter, handleMouseLeave]);

  // Segment auswählen und hinzoomen
  const selectSegment = (seg: SegmentData) => {
    setSelectedSegment(seg);
    setPanelOpen(false);
    
    if (mapRef.current && seg.start_lon && seg.end_lon) {
      mapRef.current.flyTo({
        center: [(seg.start_lon + seg.end_lon) / 2, (seg.start_lat! + seg.end_lat!) / 2],
        zoom: 14,
        pitch: 50,
        duration: 1000,
      });
    }
  };

  // Delay-Wert je nach Sortierung
  const getDelayValue = (seg: SegmentData): number => {
    switch (sortBy) {
      case "max_delay": return seg.max_delay;
      case "total_delay": return seg.total_delay;
      default: return seg.avg_delay;
    }
  };

  return (
    <div className="map-screen-container">
      {/* Map - IMMER rendern, nie unmounten! */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Loading Overlay */}
      {isLoading && !mapReady && (
        <div className="map-loading">
          <div className="spinner" />
          <span>Lade Kartendaten...</span>
        </div>
      )}

      {/* Error Overlay */}
      {isError && (
        <div className="map-error">
          <AlertCircleIcon size={40} />
          <p>Fehler beim Laden der Daten</p>
        </div>
      )}

      {/* Overlay: Titel */}
      <div className="map-overlay-title">
        <RouteIcon size={20} />
        <span>Strecken-Verspätungen</span>
      </div>

      {/* Overlay: Filter Controls */}
      <div className="map-overlay-controls">
        {/* Sortierung Dropdown */}
        <div className="control-group">
          <label>Sortiert nach:</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as SegmentSortBy)}
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Anzahl Slider */}
        <div className="control-group">
          <label>Segmente: {segmentCount}</label>
          <input
            type="range"
            min="1"
            max="100"
            value={segmentCount}
            onChange={(e) => setSegmentCount(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Overlay: Legende */}
      <div className="map-overlay-legend">
        <span><i style={{ background: "#22c55e" }} /> &lt;2 min</span>
        <span><i style={{ background: "#eab308" }} /> 2-5 min</span>
        <span><i style={{ background: "#ef4444" }} /> &gt;5 min</span>
      </div>

      {/* Overlay: Ausgewähltes Segment */}
      {selectedSegment && (
        <div className="map-overlay-selected">
          <button className="close" onClick={() => setSelectedSegment(null)}>×</button>
          <div className="route">
            {selectedSegment.start_station} → {selectedSegment.end_station}
          </div>
          <div className="stats">
            <div>
              <strong style={{ color: getStatusColor(selectedSegment.status) }}>
                {selectedSegment.avg_delay.toFixed(1)}
              </strong>
              <small>Ø min</small>
            </div>
            <div>
              <strong>{selectedSegment.max_delay}</strong>
              <small>max</small>
            </div>
            <div>
              <strong>{selectedSegment.total_trips}</strong>
              <small>Fahrten</small>
            </div>
          </div>
          <div className="lines">
            {selectedSegment.lines.slice(0, 5).map((l) => (
              <span key={l} className="badge">{l}</span>
            ))}
          </div>
        </div>
      )}

      {/* Bottom: Toggle Panel */}
      <button className="map-panel-toggle" onClick={() => setPanelOpen(!panelOpen)}>
        Top {segmentCount} Verspätungen {panelOpen ? "▼" : "▲"}
      </button>

      {/* Bottom: Panel */}
      {panelOpen && (
        <div className="map-panel">
          {displaySegments.map((seg, i) => (
            <button
              key={`${seg.start_station_key}-${seg.end_station_key}`}
              className={`map-panel-item ${seg.status}`}
              onClick={() => selectSegment(seg)}
            >
              <span className="rank">#{i + 1}</span>
              <span className="name">{seg.start_station} → {seg.end_station}</span>
              <span className="delay" style={{ color: getStatusColor(seg.status) }}>
                {formatDelay(getDelayValue(seg), sortBy)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
