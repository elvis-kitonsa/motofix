import { useQuery, UseQueryResult } from '@tanstack/react-query';
import {
  fetchDashboardStats,
  fetchRevenueChart,
  fetchLiveStats,
  fetchMapData,
  fetchRecentActivity,
  DashboardStats,
  RevenueData,
  LiveStats,
  MapData,
  ActiveRequestPin,
} from '@/lib/api';

export function useDashboardStats(
  refetchInterval: number = 45000
): UseQueryResult<DashboardStats, Error> {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval,
    staleTime: 30000,
    retry: 2,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),
  });
}

export function useRevenueChart(
  days: number = 30,
  refetchInterval: number = 60000
): UseQueryResult<RevenueData[], Error> {
  return useQuery({
    queryKey: ['revenue-chart', days],
    queryFn: () => fetchRevenueChart(days),
    refetchInterval,
    staleTime: 45000,
    retry: 2,
    retryDelay: (i) => Math.min(1000 * 2 ** i, 30000),
  });
}

export function useLiveStats(
  refetchInterval: number = 20000
): UseQueryResult<LiveStats, Error> {
  return useQuery({
    queryKey: ['live-stats'],
    queryFn: fetchLiveStats,
    refetchInterval,
    staleTime: 10000,
    retry: 2,
  });
}

export function useMapData(
  refetchInterval: number = 30000
): UseQueryResult<MapData, Error> {
  return useQuery({
    queryKey: ['map-data'],
    queryFn: fetchMapData,
    refetchInterval,
    staleTime: 20000,
    retry: 1,
  });
}

export function useRecentActivity(
  refetchInterval: number = 25000
): UseQueryResult<ActiveRequestPin[], Error> {
  return useQuery({
    queryKey: ['recent-activity'],
    queryFn: fetchRecentActivity,
    refetchInterval,
    staleTime: 15000,
    retry: 2,
  });
}
