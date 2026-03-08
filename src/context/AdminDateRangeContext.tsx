import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, subMonths, subYears } from 'date-fns';

export type DateRangePreset = 
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'last90days'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'lastYear'
  | 'allTime'
  | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
  preset: DateRangePreset;
  label: string;
}

interface AdminDateRangeContextType {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  setPreset: (preset: DateRangePreset) => void;
  getDaysBack: () => number;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  refreshKey: number;
  triggerRefresh: () => void;
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
  autoRefreshInterval: number;
  setAutoRefreshInterval: (ms: number) => void;
  lastUpdated: Date | null;
  setLastUpdated: (date: Date) => void;
}

const AdminDateRangeContext = createContext<AdminDateRangeContextType | undefined>(undefined);

const presetLabels: Record<DateRangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7days: 'Last 7 Days',
  last30days: 'Last 30 Days',
  last90days: 'Last 90 Days',
  thisWeek: 'This Week',
  lastWeek: 'Last Week',
  thisMonth: 'This Month',
  lastMonth: 'Last Month',
  thisYear: 'This Year',
  lastYear: 'Last Year',
  allTime: 'All Time',
  custom: 'Custom Range',
};

export function getDateRangeForPreset(preset: DateRangePreset, customFrom?: Date, customTo?: Date): DateRange {
  const today = new Date();
  
  switch (preset) {
    case 'today':
      return {
        from: startOfDay(today),
        to: endOfDay(today),
        preset,
        label: presetLabels[preset],
      };
    case 'yesterday':
      const yesterday = subDays(today, 1);
      return {
        from: startOfDay(yesterday),
        to: endOfDay(yesterday),
        preset,
        label: presetLabels[preset],
      };
    case 'last7days':
      return {
        from: startOfDay(subDays(today, 6)),
        to: endOfDay(today),
        preset,
        label: presetLabels[preset],
      };
    case 'last30days':
      return {
        from: startOfDay(subDays(today, 29)),
        to: endOfDay(today),
        preset,
        label: presetLabels[preset],
      };
    case 'last90days':
      return {
        from: startOfDay(subDays(today, 89)),
        to: endOfDay(today),
        preset,
        label: presetLabels[preset],
      };
    case 'thisWeek':
      return {
        from: startOfWeek(today, { weekStartsOn: 1 }),
        to: endOfWeek(today, { weekStartsOn: 1 }),
        preset,
        label: presetLabels[preset],
      };
    case 'lastWeek':
      const lastWeekStart = startOfWeek(subDays(today, 7), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subDays(today, 7), { weekStartsOn: 1 });
      return {
        from: lastWeekStart,
        to: lastWeekEnd,
        preset,
        label: presetLabels[preset],
      };
    case 'thisMonth':
      return {
        from: startOfMonth(today),
        to: endOfMonth(today),
        preset,
        label: presetLabels[preset],
      };
    case 'lastMonth':
      const lastMonth = subMonths(today, 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
        preset,
        label: presetLabels[preset],
      };
    case 'thisYear':
      return {
        from: startOfYear(today),
        to: endOfDay(today),
        preset,
        label: presetLabels[preset],
      };
    case 'lastYear':
      const lastYear = subYears(today, 1);
      return {
        from: startOfYear(lastYear),
        to: new Date(lastYear.getFullYear(), 11, 31, 23, 59, 59),
        preset,
        label: presetLabels[preset],
      };
    case 'allTime':
      return {
        from: new Date(2020, 0, 1),
        to: endOfDay(today),
        preset,
        label: presetLabels[preset],
      };
    case 'custom':
      return {
        from: customFrom || startOfDay(subDays(today, 29)),
        to: customTo || endOfDay(today),
        preset,
        label: presetLabels[preset],
      };
    default:
      return {
        from: startOfDay(subDays(today, 29)),
        to: endOfDay(today),
        preset: 'last30days',
        label: presetLabels['last30days'],
      };
  }
}

export function AdminDateRangeProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRange>(getDateRangeForPreset('last30days'));
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(60000); // 1 minute default
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const setPreset = useCallback((preset: DateRangePreset) => {
    setDateRange(getDateRangeForPreset(preset));
  }, []);

  const getDaysBack = useCallback(() => {
    const diffTime = Math.abs(dateRange.to.getTime() - dateRange.from.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [dateRange]);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
    setLastUpdated(new Date());
  }, []);

  // Auto-refresh effect
  React.useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      triggerRefresh();
    }, autoRefreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, autoRefreshInterval, triggerRefresh]);

  return (
    <AdminDateRangeContext.Provider
      value={{
        dateRange,
        setDateRange,
        setPreset,
        getDaysBack,
        isLoading,
        setIsLoading,
        refreshKey,
        triggerRefresh,
        autoRefresh,
        setAutoRefresh,
        autoRefreshInterval,
        setAutoRefreshInterval,
        lastUpdated,
        setLastUpdated,
      }}
    >
      {children}
    </AdminDateRangeContext.Provider>
  );
}

export function useAdminDateRange() {
  const context = useContext(AdminDateRangeContext);
  if (context === undefined) {
    throw new Error('useAdminDateRange must be used within an AdminDateRangeProvider');
  }
  return context;
}

export const presetOptions: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'last90days', label: 'Last 90 Days' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'lastWeek', label: 'Last Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'allTime', label: 'All Time' },
];
