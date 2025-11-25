/**
 * API Client for HVV Delay Dashboard
 * 
 * Connects to the FastAPI backend for predictions and statistics.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error(`Failed to fetch ${endpoint}:`, error);
    throw error;
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface HealthResponse {
  status: "healthy" | "unhealthy";
  models_loaded: boolean;
  model_info?: {
    model_dir: string;
    regressor: {
      loaded: boolean;
      metrics?: Record<string, number>;
      training_date?: string;
    };
    classifier: {
      loaded: boolean;
      metrics?: Record<string, number>;
      training_date?: string;
    };
  };
  error?: string;
}

export interface StatsOverview {
  avg_delay_minutes: number;
  max_delay_minutes: number;
  min_delay_minutes: number;
  delayed_percentage: number;
  total_journeys: number;
  total_segments: number;
  active_lines: number;
  lines: Array<{
    name: string;
    vehicle_type: string | null;
    line_type: string | null;
    direction: string | null;
  }>;
  timestamp: string;
}

export interface LineStats {
  line: string;
  vehicle_type: string | null;
  line_type: string | null;
  avg_delay_minutes: number;
  max_delay_minutes: number;
  delayed_percentage: number;
  total_segments: number;
  status: "good" | "warning" | "critical";
}

export interface LineStatsResponse {
  lines: LineStats[];
  timestamp: string;
}

export interface DelayDataPoint {
  timestamp: string;
  avg_delay: number;
  max_delay: number;
  min_delay: number;
  count: number;
}

export interface DelaysResponse {
  data: DelayDataPoint[];
  hours: number;
  bucket_minutes: number;
}

export interface Weather {
  temperature_c: number;
  precipitation_mm: number;
  wind_speed_kmh: number;
  weather_code: number;
  humidity_percent: number;
  cloud_cover_percent: number;
  timestamp: string;
  location: string;
  source: string;
  error?: string;
}

export interface WeatherImpact {
  level: "low" | "medium" | "high";
  score: number;
  description: string;
  factors: string[];
  weather_description: string;
}

export interface WeatherResponse {
  weather: Weather;
  impact: WeatherImpact;
}

export interface Prediction {
  line: string;
  vehicle_type: string | null;
  predicted_delay_minutes: number | null;
  classification: {
    is_delayed: boolean;
    probability_delayed: number;
    probability_on_time: number;
    threshold_minutes: number;
  } | null;
  direction: string | null;
}

export interface LivePredictionsResponse {
  predictions: Prediction[];
  weather: Weather;
  weather_impact: WeatherImpact;
  time_features: {
    hour_of_day: number;
    day_of_week: number;
    is_rush_hour: boolean;
    is_weekend: boolean;
  };
  timestamp: string;
}

// Heatmap Types
export interface HeatmapDataPoint {
  hour: number;
  day_of_week: number;
  day_name: string;
  avg_delay: number;
  max_delay: number;
  count: number;
  delayed_percentage: number;
}

export interface HeatmapResponse {
  data: HeatmapDataPoint[];
  timestamp: string;
}

// Journey Types
export interface Journey {
  journey_id: string;
  line: string;
  direction: string | null;
  vehicle_type: string | null;
  line_type: string | null;
  avg_delay_minutes: number;
  max_delay_minutes: number;
  min_delay_minutes: number;
  segment_count: number;
  first_station: string | null;
  last_station: string | null;
  start_time: number | null;
  end_time: number | null;
  status: "good" | "warning" | "critical";
}

export interface JourneysByLineResponse {
  line: string;
  journeys: Journey[];
  total: number;
  limit: number;
}

export interface JourneySegment {
  start_station: string;
  end_station: string;
  start_timestamp: number;
  delay_minutes: number;
  status: "good" | "warning" | "critical";
}

export interface JourneyDetailResponse {
  journey_id: string;
  line: string;
  direction: string | null;
  vehicle_type: string | null;
  line_type: string | null;
  segments: JourneySegment[];
  total_segments: number;
  avg_delay: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Check API health status
 */
export async function getHealth(): Promise<HealthResponse> {
  return fetchAPI<HealthResponse>("/health");
}

/**
 * Get overall statistics
 */
export async function getStatsOverview(): Promise<StatsOverview> {
  return fetchAPI<StatsOverview>("/stats/overview");
}

/**
 * Get statistics by line
 */
export async function getStatsByLine(): Promise<LineStatsResponse> {
  return fetchAPI<LineStatsResponse>("/stats/by-line");
}

/**
 * Get historical delay data
 */
export async function getDelaysOverTime(
  hours: number = 24,
  bucketMinutes: number = 60
): Promise<DelaysResponse> {
  return fetchAPI<DelaysResponse>(
    `/history/delays?hours=${hours}&bucket_minutes=${bucketMinutes}`
  );
}

/**
 * Get current weather and impact
 */
export async function getWeather(): Promise<WeatherResponse> {
  return fetchAPI<WeatherResponse>("/weather/current");
}

/**
 * Get live predictions
 */
export async function getLivePredictions(): Promise<LivePredictionsResponse> {
  return fetchAPI<LivePredictionsResponse>("/live/current");
}

/**
 * Get heatmap data (hour x day_of_week)
 */
export async function getHeatmapData(): Promise<HeatmapResponse> {
  return fetchAPI<HeatmapResponse>("/stats/heatmap");
}

/**
 * Get journeys for a specific line
 */
export async function getJourneysByLine(
  line: string,
  limit: number = 50
): Promise<JourneysByLineResponse> {
  return fetchAPI<JourneysByLineResponse>(
    `/history/journeys-by-line?line=${encodeURIComponent(line)}&limit=${limit}`
  );
}

/**
 * Get journey detail with segments
 */
export async function getJourneyDetail(
  journeyId: string
): Promise<JourneyDetailResponse> {
  return fetchAPI<JourneyDetailResponse>(
    `/history/journey/${encodeURIComponent(journeyId)}`
  );
}

// ============================================================================
// SWR Fetchers
// ============================================================================

/**
 * Generic fetcher for SWR
 */
export const fetcher = <T>(url: string): Promise<T> => 
  fetchAPI<T>(url);

/**
 * API endpoints for SWR
 */
export const API_ENDPOINTS = {
  health: "/health",
  statsOverview: "/stats/overview",
  statsByLine: "/stats/by-line",
  heatmap: "/stats/heatmap",
  delaysOverTime: (hours = 24, bucket = 60) => 
    `/history/delays?hours=${hours}&bucket_minutes=${bucket}`,
  journeysByLine: (line: string, limit = 50) =>
    `/history/journeys-by-line?line=${encodeURIComponent(line)}&limit=${limit}`,
  journeyDetail: (journeyId: string) =>
    `/history/journey/${encodeURIComponent(journeyId)}`,
  weather: "/weather/current",
  livePredictions: "/live/current",
} as const;

