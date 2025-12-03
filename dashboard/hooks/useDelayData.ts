"use client";

import useSWR from "swr";
import {
  fetcher,
  API_ENDPOINTS,
  HealthResponse,
  StatsOverview,
  LineStatsResponse,
  DelaysResponse,
  LivePredictionsResponse,
  HeatmapResponse,
  JourneysByLineResponse,
  JourneyDetailResponse,
  SegmentsResponse,
  SegmentSortBy,
} from "@/lib/api";

/**
 * Hook for API health status
 */
export function useHealth() {
  const { data, error, isLoading, mutate } = useSWR<HealthResponse>(
    API_ENDPOINTS.health,
    fetcher,
    {
      refreshInterval: 30000, // Check every 30 seconds
      revalidateOnFocus: true,
    }
  );

  return {
    health: data,
    isHealthy: data?.status === "healthy",
    modelsLoaded: data?.models_loaded ?? false,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

/**
 * Hook for overview statistics
 */
export function useStatsOverview() {
  const { data, error, isLoading, mutate } = useSWR<StatsOverview>(
    API_ENDPOINTS.statsOverview,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true,
    }
  );

  return {
    stats: data,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

/**
 * Hook for line statistics
 */
export function useLineStats() {
  const { data, error, isLoading, mutate } = useSWR<LineStatsResponse>(
    API_ENDPOINTS.statsByLine,
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: true,
    }
  );

  return {
    lines: data?.lines ?? [],
    timestamp: data?.timestamp,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

/**
 * Hook for delay timeline data
 */
export function useDelayTimeline(hours: number = 24, bucketMinutes: number = 60) {
  const { data, error, isLoading, mutate } = useSWR<DelaysResponse>(
    API_ENDPOINTS.delaysOverTime(hours, bucketMinutes),
    fetcher,
    {
      refreshInterval: 120000, // Refresh every 2 minutes
      revalidateOnFocus: true,
    }
  );

  return {
    data: data?.data ?? [],
    hours: data?.hours,
    bucketMinutes: data?.bucket_minutes,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

/**
 * Hook for live predictions with weather
 */
export function useLivePredictions() {
  const { data, error, isLoading, mutate } = useSWR<LivePredictionsResponse>(
    API_ENDPOINTS.livePredictions,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    }
  );

  return {
    predictions: data?.predictions ?? [],
    weather: data?.weather,
    weatherImpact: data?.weather_impact,
    timeFeatures: data?.time_features,
    timestamp: data?.timestamp,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

/**
 * Hook for heatmap data (hour x day_of_week)
 */
export function useHeatmap() {
  const { data, error, isLoading, mutate } = useSWR<HeatmapResponse>(
    API_ENDPOINTS.heatmap,
    fetcher,
    {
      refreshInterval: 300000, // Refresh every 5 minutes
      revalidateOnFocus: true,
    }
  );

  return {
    data: data?.data ?? [],
    timestamp: data?.timestamp,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

/**
 * Hook for journeys by line
 */
export function useJourneysByLine(line: string | null, limit: number = 50) {
  const { data, error, isLoading, mutate } = useSWR<JourneysByLineResponse>(
    line ? API_ENDPOINTS.journeysByLine(line, limit) : null,
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: true,
    }
  );

  return {
    journeys: data?.journeys ?? [],
    total: data?.total ?? 0,
    line: data?.line,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

/**
 * Hook for journey detail with segments
 */
export function useJourneyDetail(journeyId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<JourneyDetailResponse>(
    journeyId ? API_ENDPOINTS.journeyDetail(journeyId) : null,
    fetcher,
    {
      revalidateOnFocus: true,
    }
  );

  return {
    journey: data,
    segments: data?.segments ?? [],
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

/**
 * Hook for segment statistics with coordinates for map
 */
export function useSegmentsStats(limit: number = 100, sortBy: SegmentSortBy = "avg_delay") {
  const { data, error, isLoading, mutate } = useSWR<SegmentsResponse>(
    API_ENDPOINTS.segmentsStats(limit, sortBy),
    fetcher,
    {
      refreshInterval: 60000, // Refresh every 60 seconds
      revalidateOnFocus: false, // Don't revalidate on focus to keep map stable
      dedupingInterval: 60000, // Dedupe requests within 60 seconds
    }
  );

  return {
    segments: data?.segments ?? [],
    total: data?.total ?? 0,
    timestamp: data?.timestamp,
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}

/**
 * Combined hook for all dashboard data
 */
export function useDashboardData() {
  const health = useHealth();
  const stats = useStatsOverview();
  const lines = useLineStats();
  const timeline = useDelayTimeline();
  const live = useLivePredictions();
  const heatmap = useHeatmap();

  const isLoading =
    health.isLoading ||
    stats.isLoading ||
    lines.isLoading ||
    timeline.isLoading ||
    live.isLoading;

  const hasError =
    health.isError || stats.isError || lines.isError || timeline.isError || live.isError;

  const refreshAll = () => {
    health.refresh();
    stats.refresh();
    lines.refresh();
    timeline.refresh();
    live.refresh();
    heatmap.refresh();
  };

  return {
    health,
    stats,
    lines,
    timeline,
    live,
    heatmap,
    isLoading,
    hasError,
    refreshAll,
  };
}

