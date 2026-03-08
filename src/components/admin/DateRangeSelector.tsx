import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, RefreshCw, CheckIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  useAdminDateRange, 
  presetOptions, 
  getDateRangeForPreset,
  type DateRangePreset 
} from '@/context/AdminDateRangeContext';

interface DateRangeSelectorProps {
  className?: string;
  showRefresh?: boolean;
  showAutoRefresh?: boolean;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  className,
  showRefresh = true,
  showAutoRefresh = true,
}) => {
  const {
    dateRange,
    setDateRange,
    setPreset,
    triggerRefresh,
    isLoading,
    autoRefresh,
    setAutoRefresh,
    lastUpdated,
  } = useAdminDateRange();

  const [customDateOpen, setCustomDateOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<Date | undefined>(dateRange.from);
  const [customTo, setCustomTo] = useState<Date | undefined>(dateRange.to);

  const handlePresetSelect = (preset: DateRangePreset) => {
    setPreset(preset);
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      setDateRange({
        from: customFrom,
        to: customTo,
        preset: 'custom',
        label: `${format(customFrom, 'MMM d')} - ${format(customTo, 'MMM d, yyyy')}`,
      });
      setCustomDateOpen(false);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Date Range Preset Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-w-[180px] justify-start">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange.label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          {presetOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handlePresetSelect(option.value)}
              className="flex items-center justify-between"
            >
              {option.label}
              {dateRange.preset === option.value && (
                <CheckIcon className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCustomDateOpen(true)}>
            Custom Range...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Custom Date Range Popover */}
      <Popover open={customDateOpen} onOpenChange={setCustomDateOpen}>
        <PopoverTrigger className="hidden" />
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">From</p>
              <Calendar
                mode="single"
                selected={customFrom}
                onSelect={setCustomFrom}
                disabled={(date) => date > new Date() || (customTo ? date > customTo : false)}
                initialFocus
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">To</p>
              <Calendar
                mode="single"
                selected={customTo}
                onSelect={setCustomTo}
                disabled={(date) => date > new Date() || (customFrom ? date < customFrom : false)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCustomDateOpen(false)}>
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleCustomApply}
                disabled={!customFrom || !customTo}
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Refresh Button */}
      {showRefresh && (
        <Button
          variant="outline"
          size="icon"
          onClick={triggerRefresh}
          disabled={isLoading}
          title="Refresh data"
        >
          <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        </Button>
      )}

      {/* Auto Refresh Toggle */}
      {showAutoRefresh && (
        <Button
          variant={autoRefresh ? 'default' : 'outline'}
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
          className="gap-2"
        >
          <RefreshCw className={cn('h-3 w-3', autoRefresh && 'animate-spin')} />
          {autoRefresh ? 'Auto' : 'Manual'}
        </Button>
      )}

      {/* Last Updated */}
      {lastUpdated && (
        <span className="text-xs text-gray-500 dark:text-gray-400 hidden md:inline">
          Updated {format(lastUpdated, 'HH:mm:ss')}
        </span>
      )}
    </div>
  );
};

export default DateRangeSelector;
