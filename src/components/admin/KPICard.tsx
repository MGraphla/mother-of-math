import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

interface SparklineDataPoint {
  value: number;
  date?: string;
}

interface KPICardProps {
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'stable';
  sparklineData?: SparklineDataPoint[];
  icon?: React.ReactNode;
  format?: 'number' | 'currency' | 'percent';
  className?: string;
  onClick?: () => void;
  colorScheme?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  loading?: boolean;
}

const formatValue = (value: number | string, format?: string): string => {
  if (typeof value === 'string') return value;
  
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      return new Intl.NumberFormat('en-US').format(value);
  }
};

const getColorScheme = (scheme: string, trend?: string) => {
  const schemes = {
    default: {
      bg: 'bg-white dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      text: 'text-gray-900 dark:text-white',
      sparkline: '#6366f1',
    },
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      text: 'text-emerald-900 dark:text-emerald-100',
      sparkline: '#10b981',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-900 dark:text-amber-100',
      sparkline: '#f59e0b',
    },
    danger: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-900 dark:text-red-100',
      sparkline: '#ef4444',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-900 dark:text-blue-100',
      sparkline: '#3b82f6',
    },
  };
  
  return schemes[scheme as keyof typeof schemes] || schemes.default;
};

const TrendIndicator: React.FC<{ change?: number; trend?: 'up' | 'down' | 'stable' }> = ({ change, trend }) => {
  const determinedTrend = trend || (change ? (change > 0 ? 'up' : change < 0 ? 'down' : 'stable') : 'stable');
  const displayChange = change !== undefined ? Math.abs(change) : null;
  
  return (
    <div className={cn(
      'flex items-center gap-1 text-sm font-medium',
      determinedTrend === 'up' && 'text-emerald-600 dark:text-emerald-400',
      determinedTrend === 'down' && 'text-red-600 dark:text-red-400',
      determinedTrend === 'stable' && 'text-gray-500 dark:text-gray-400',
    )}>
      {determinedTrend === 'up' && <ArrowUpIcon className="h-4 w-4" />}
      {determinedTrend === 'down' && <ArrowDownIcon className="h-4 w-4" />}
      {determinedTrend === 'stable' && <MinusIcon className="h-4 w-4" />}
      {displayChange !== null && (
        <span>{displayChange.toFixed(1)}%</span>
      )}
    </div>
  );
};

const Sparkline: React.FC<{ data: SparklineDataPoint[]; color: string }> = ({ data, color }) => {
  if (!data || data.length < 2) return null;
  
  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 8px',
            }}
            labelStyle={{ display: 'none' }}
            formatter={(value: number) => [value.toLocaleString(), '']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2" />
    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2" />
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
  </div>
);

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  change,
  changeLabel,
  trend,
  sparklineData,
  icon,
  format = 'number',
  className,
  onClick,
  colorScheme = 'default',
  loading = false,
}) => {
  const colors = getColorScheme(colorScheme, trend);
  
  return (
    <Card
      className={cn(
        'transition-all duration-200 border',
        colors.bg,
        colors.border,
        onClick && 'cursor-pointer hover:shadow-lg hover:scale-[1.02]',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {icon && (
                  <div className="text-gray-500 dark:text-gray-400">
                    {icon}
                  </div>
                )}
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {title}
                </p>
              </div>
              <p className={cn('text-2xl font-bold', colors.text)}>
                {formatValue(value, format)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <TrendIndicator change={change} trend={trend} />
                {changeLabel && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {changeLabel}
                  </span>
                )}
              </div>
            </div>
            {sparklineData && sparklineData.length > 1 && (
              <Sparkline data={sparklineData} color={colors.sparkline} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Grid container for KPI cards
interface KPIGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

export const KPIGrid: React.FC<KPIGridProps> = ({ children, columns = 4, className }) => {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  };
  
  return (
    <div className={cn('grid gap-4', gridCols[columns], className)}>
      {children}
    </div>
  );
};

export default KPICard;
