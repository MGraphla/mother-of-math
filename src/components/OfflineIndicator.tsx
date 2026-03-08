/**
 * Enhanced OfflineIndicator Component
 * Shows offline status, queues actions, provides sync progress & retry functionality
 */

import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Check, 
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Clock,
  Zap,
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh,
  Eye,
  RotateCcw,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ── Types ────────────────────────────────────────

interface QueuedAction {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retries: number;
  lastError?: string;
  status: 'pending' | 'processing' | 'failed' | 'completed';
}

interface SyncProgress {
  current: number;
  total: number;
  currentAction?: string;
}

type NetworkQuality = 'offline' | 'poor' | 'moderate' | 'good' | 'excellent';

interface OfflineContextType {
  isOnline: boolean;
  networkQuality: NetworkQuality;
  queuedActions: QueuedAction[];
  queueAction: (type: string, data: any) => void;
  clearQueue: () => void;
  removeAction: (id: string) => void;
  retryAction: (id: string) => Promise<void>;
  processQueue: () => Promise<void>;
  syncProgress: SyncProgress | null;
  lastSyncTime: Date | null;
  isSyncing: boolean;
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  networkQuality: 'good',
  queuedActions: [],
  queueAction: () => {},
  clearQueue: () => {},
  removeAction: () => {},
  retryAction: async () => {},
  processQueue: async () => {},
  syncProgress: null,
  lastSyncTime: null,
  isSyncing: false,
});

export const useOffline = () => useContext(OfflineContext);

// ── Constants ────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 10000]; // Exponential backoff delays
const STORAGE_KEY = 'mom_offline_queue';
const LAST_SYNC_KEY = 'mom_last_sync';

// ── Offline Provider ────────────────────────────

interface OfflineProviderProps {
  children: ReactNode;
  onProcessAction?: (action: QueuedAction) => Promise<boolean>;
}

export const OfflineProvider = ({ children, onProcessAction }: OfflineProviderProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('good');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const saved = localStorage.getItem(LAST_SYNC_KEY);
    return saved ? new Date(saved) : null;
  });
  
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const { toast } = useToast();
  const processingRef = useRef(false);

  // ─ Network quality detection ─────────────────────
  useEffect(() => {
    const checkNetworkQuality = () => {
      const connection = (navigator as any).connection;
      if (!navigator.onLine) {
        setNetworkQuality('offline');
        return;
      }
      
      if (connection) {
        const { effectiveType, downlink, rtt } = connection;
        
        if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 0.5) {
          setNetworkQuality('poor');
        } else if (effectiveType === '3g' || downlink < 2) {
          setNetworkQuality('moderate');
        } else if (downlink < 10) {
          setNetworkQuality('good');
        } else {
          setNetworkQuality('excellent');
        }
      } else {
        setNetworkQuality(navigator.onLine ? 'good' : 'offline');
      }
    };

    checkNetworkQuality();
    
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', checkNetworkQuality);
    }
    
    const interval = setInterval(checkNetworkQuality, 30000);
    
    return () => {
      if (connection) {
        connection.removeEventListener('change', checkNetworkQuality);
      }
      clearInterval(interval);
    };
  }, []);

  // ─ Online/offline events ─────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNetworkQuality('good');
      toast({
        title: "You're back online",
        description: queuedActions.filter(a => a.status !== 'completed').length > 0 
          ? `${queuedActions.filter(a => a.status !== 'completed').length} queued action(s) ready to sync`
          : 'Connection restored',
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setNetworkQuality('offline');
      toast({
        title: "You're offline",
        description: "Your actions will be saved and synced when you reconnect.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queuedActions, toast]);

  // ─ Persist queue to localStorage ─────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queuedActions));
  }, [queuedActions]);

  // ─ Auto-process queue when coming back online ────
  useEffect(() => {
    if (isOnline && queuedActions.some(a => a.status === 'pending') && !processingRef.current) {
      processQueue();
    }
  }, [isOnline]);

  // ─ Queue an action ───────────────────────────────
  const queueAction = useCallback((type: string, data: any) => {
    const action: QueuedAction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
    };
    setQueuedActions(prev => [...prev, action]);
    
    toast({
      title: 'Action queued',
      description: isOnline ? 'Will sync shortly' : 'Will sync when back online',
    });
  }, [isOnline, toast]);

  // ─ Clear all queue ───────────────────────────────
  const clearQueue = useCallback(() => {
    setQueuedActions([]);
    localStorage.removeItem(STORAGE_KEY);
    toast({
      title: 'Queue cleared',
      description: 'All pending actions have been removed.',
    });
  }, [toast]);

  // ─ Remove single action ──────────────────────────
  const removeAction = useCallback((id: string) => {
    setQueuedActions(prev => prev.filter(a => a.id !== id));
  }, []);

  // ─ Retry single action ───────────────────────────
  const retryAction = useCallback(async (id: string) => {
    if (!onProcessAction) return;
    
    const action = queuedActions.find(a => a.id === id);
    if (!action) return;
    
    setQueuedActions(prev => prev.map(a => 
      a.id === id ? { ...a, status: 'processing' as const } : a
    ));
    
    try {
      const success = await onProcessAction(action);
      if (success) {
        setQueuedActions(prev => prev.map(a => 
          a.id === id ? { ...a, status: 'completed' as const, lastError: undefined } : a
        ));
        toast({
          title: 'Action synced',
          description: `${action.type} completed successfully.`,
        });
      } else {
        setQueuedActions(prev => prev.map(a => 
          a.id === id 
            ? { ...a, status: 'failed' as const, retries: a.retries + 1, lastError: 'Sync failed' } 
            : a
        ));
      }
    } catch (e) {
      setQueuedActions(prev => prev.map(a => 
        a.id === id 
          ? { ...a, status: 'failed' as const, retries: a.retries + 1, lastError: String(e) } 
          : a
      ));
    }
  }, [queuedActions, onProcessAction, toast]);

  // ─ Process all pending queue ─────────────────────
  const processQueue = useCallback(async () => {
    if (!onProcessAction || processingRef.current) return;
    
    const pending = queuedActions.filter(a => a.status === 'pending' || (a.status === 'failed' && a.retries < MAX_RETRIES));
    if (pending.length === 0) return;
    
    processingRef.current = true;
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: pending.length });
    
    let processed = 0;
    const results: { id: string; success: boolean }[] = [];
    
    for (const action of pending) {
      setSyncProgress({ 
        current: processed, 
        total: pending.length,
        currentAction: action.type 
      });
      
      // Update status to processing
      setQueuedActions(prev => prev.map(a => 
        a.id === action.id ? { ...a, status: 'processing' as const } : a
      ));
      
      try {
        // Apply retry delay if this is a retry
        if (action.retries > 0) {
          const delay = RETRY_DELAYS[Math.min(action.retries - 1, RETRY_DELAYS.length - 1)];
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const success = await onProcessAction(action);
        results.push({ id: action.id, success });
        
        // Update action status
        setQueuedActions(prev => prev.map(a => 
          a.id === action.id 
            ? { 
                ...a, 
                status: success ? 'completed' as const : 'failed' as const,
                retries: success ? a.retries : a.retries + 1,
                lastError: success ? undefined : 'Sync failed'
              } 
            : a
        ));
      } catch (e) {
        results.push({ id: action.id, success: false });
        setQueuedActions(prev => prev.map(a => 
          a.id === action.id 
            ? { ...a, status: 'failed' as const, retries: a.retries + 1, lastError: String(e) } 
            : a
        ));
      }
      
      processed++;
    }
    
    // Clean up completed actions after a delay
    setTimeout(() => {
      setQueuedActions(prev => prev.filter(a => a.status !== 'completed'));
    }, 2000);
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    // Update last sync time
    const now = new Date();
    setLastSyncTime(now);
    localStorage.setItem(LAST_SYNC_KEY, now.toISOString());
    
    setSyncProgress(null);
    setIsSyncing(false);
    processingRef.current = false;
    
    if (successCount > 0 || failCount > 0) {
      toast({
        title: 'Sync complete',
        description: failCount > 0 
          ? `${successCount} synced, ${failCount} failed. Retry failed actions manually.`
          : `${successCount} action(s) synced successfully.`,
        variant: failCount > 0 ? 'default' : 'default',
      });
    }
  }, [queuedActions, onProcessAction, toast]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        networkQuality,
        queuedActions,
        queueAction,
        clearQueue,
        removeAction,
        retryAction,
        processQueue,
        syncProgress,
        lastSyncTime,
        isSyncing,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};

// ── Network Quality Icon ────────────────────────

const NetworkQualityIcon = ({ quality, className }: { quality: NetworkQuality; className?: string }) => {
  switch (quality) {
    case 'offline':
      return <WifiOff className={cn("text-destructive", className)} />;
    case 'poor':
      return <SignalLow className={cn("text-red-500", className)} />;
    case 'moderate':
      return <SignalMedium className={cn("text-yellow-500", className)} />;
    case 'good':
      return <SignalHigh className={cn("text-green-500", className)} />;
    case 'excellent':
      return <Zap className={cn("text-primary", className)} />;
    default:
      return <Signal className={className} />;
  }
};

// ── Offline Banner (Enhanced) ────────────────────

interface OfflineBannerProps {
  className?: string;
}

export const OfflineBanner = ({ className }: OfflineBannerProps) => {
  const { isOnline, queuedActions, processQueue, syncProgress, isSyncing, networkQuality } = useOffline();
  const [expanded, setExpanded] = useState(false);
  
  const pendingCount = queuedActions.filter(a => a.status !== 'completed').length;

  if (isOnline && pendingCount === 0 && !isSyncing) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
        'rounded-lg shadow-lg border backdrop-blur-sm',
        'animate-in slide-in-from-bottom-4 duration-300',
        isOnline ? 'bg-yellow-500/90 border-yellow-400' : 'bg-red-500/90 border-red-400',
        'text-white',
        className
      )}
    >
      {/* Main banner */}
      <div className="px-4 py-2 flex items-center gap-3">
        {isSyncing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-medium">
                Syncing... {syncProgress?.currentAction && `(${syncProgress.currentAction})`}
              </p>
              {syncProgress && (
                <Progress 
                  value={(syncProgress.current / syncProgress.total) * 100} 
                  className="h-1 mt-1 bg-white/20"
                />
              )}
            </div>
            <span className="text-xs opacity-80">
              {syncProgress?.current}/{syncProgress?.total}
            </span>
          </>
        ) : isOnline ? (
          <>
            <CloudOff className="h-4 w-4" />
            <span className="text-sm font-medium">
              {pendingCount} pending action{pendingCount !== 1 ? 's' : ''}
            </span>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs gap-1 bg-white/20 hover:bg-white/30 text-white"
              onClick={() => processQueue()}
            >
              <RefreshCw className="h-3 w-3" />
              Sync now
            </Button>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">You're offline</span>
            {pendingCount > 0 && (
              <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                {pendingCount} queued
              </Badge>
            )}
          </>
        )}
        
        {pendingCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-white hover:bg-white/20"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
        )}
      </div>
      
      {/* Expanded queue view */}
      {expanded && pendingCount > 0 && (
        <div className="border-t border-white/20 px-4 py-2 max-h-48 overflow-auto">
          {queuedActions.filter(a => a.status !== 'completed').map(action => (
            <div key={action.id} className="flex items-center gap-2 py-1 text-sm">
              <span className={cn(
                "h-2 w-2 rounded-full",
                action.status === 'pending' && 'bg-muted-foreground',
                action.status === 'processing' && 'bg-primary animate-pulse',
                action.status === 'failed' && 'bg-destructive'
              )} />
              <span className="flex-1 truncate">{action.type}</span>
              {action.status === 'failed' && (
                <span className="text-xs opacity-70">Failed ({action.retries}x)</span>
              )}
              <span className="text-xs opacity-70">
                {new Date(action.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Status Badge (Enhanced) ────────────────────

interface OfflineStatusBadgeProps {
  className?: string;
  showOnline?: boolean;
  showQuality?: boolean;
}

export const OfflineStatusBadge = ({ className, showOnline = false, showQuality = false }: OfflineStatusBadgeProps) => {
  const { isOnline, queuedActions, networkQuality } = useOffline();
  const pendingCount = queuedActions.filter(a => a.status !== 'completed').length;

  if (isOnline && !showOnline && pendingCount === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={isOnline ? 'outline' : 'destructive'}
            className={cn(
              'gap-1.5 text-xs cursor-default',
              isOnline && networkQuality === 'excellent' && 'border-primary text-primary',
              isOnline && networkQuality === 'good' && 'border-green-500 text-green-600',
              isOnline && networkQuality === 'moderate' && 'border-yellow-500 text-yellow-600',
              isOnline && networkQuality === 'poor' && 'border-red-500 text-red-600',
              className
            )}
          >
            {showQuality ? (
              <NetworkQualityIcon quality={networkQuality} className="h-3 w-3" />
            ) : isOnline ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            {isOnline ? (showQuality ? networkQuality : 'Online') : 'Offline'}
            {pendingCount > 0 && (
              <span className="ml-1 opacity-70">
                ({pendingCount})
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isOnline ? `Network: ${networkQuality}` : 'No internet connection'}</p>
          {pendingCount > 0 && <p>{pendingCount} action(s) pending sync</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ── Connection Status Indicator (Enhanced) ────────

interface ConnectionStatusProps {
  className?: string;
}

export const ConnectionStatus = ({ className }: ConnectionStatusProps) => {
  const { isOnline, queuedActions, networkQuality, lastSyncTime } = useOffline();
  const pendingCount = queuedActions.filter(a => a.status !== 'completed').length;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('relative cursor-default', className)}>
            <div
              className={cn(
                'h-2.5 w-2.5 rounded-full transition-all',
                networkQuality === 'offline' && 'bg-red-500 animate-pulse',
                networkQuality === 'poor' && 'bg-red-400',
                networkQuality === 'moderate' && 'bg-yellow-500',
                networkQuality === 'good' && 'bg-green-500',
                networkQuality === 'excellent' && 'bg-primary',
              )}
            />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-yellow-500 rounded-full animate-pulse" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-xs space-y-1">
            <p className="font-medium">
              {isOnline ? `Online (${networkQuality})` : 'Offline'}
            </p>
            {pendingCount > 0 && (
              <p className="text-muted-foreground">{pendingCount} pending sync</p>
            )}
            {lastSyncTime && (
              <p className="text-muted-foreground">
                Last sync: {lastSyncTime.toLocaleTimeString()}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ── Queue Manager Sheet (New) ──────────────────

interface QueueManagerProps {
  children: ReactNode;
}

export const QueueManager = ({ children }: QueueManagerProps) => {
  const { 
    queuedActions, 
    processQueue, 
    clearQueue, 
    removeAction, 
    retryAction,
    isSyncing,
    lastSyncTime,
    isOnline
  } = useOffline();
  
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const pendingActions = queuedActions.filter(a => a.status !== 'completed');
  const failedActions = queuedActions.filter(a => a.status === 'failed');

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusIcon = (status: QueuedAction['status']) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'processing': return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'completed': return <Check className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          {children}
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Sync Queue
            </SheetTitle>
            <SheetDescription>
              Manage your pending and failed actions
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{pendingActions.length}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-500">{failedActions.length}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs font-medium truncate">
                  {lastSyncTime ? lastSyncTime.toLocaleTimeString() : '-'}
                </p>
                <p className="text-xs text-muted-foreground">Last Sync</p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                className="flex-1" 
                onClick={() => processQueue()}
                disabled={pendingActions.length === 0 || isSyncing || !isOnline}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync All
              </Button>
              <Button 
                variant="outline"
                onClick={() => setClearDialogOpen(true)}
                disabled={queuedActions.length === 0}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Queue list */}
            <ScrollArea className="h-[400px] pr-4">
              {queuedActions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Check className="h-10 w-10 mb-2 opacity-50" />
                  <p className="text-sm">All synced!</p>
                  <p className="text-xs">No pending actions</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {queuedActions.map(action => (
                    <div 
                      key={action.id}
                      className={cn(
                        "border rounded-lg p-3 space-y-2",
                        action.status === 'failed' && 'border-red-300 bg-red-50 dark:bg-red-900/10',
                        action.status === 'completed' && 'border-green-300 bg-green-50 dark:bg-green-900/10 opacity-60'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {getStatusIcon(action.status)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{action.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(action.timestamp)}
                          </p>
                          {action.lastError && (
                            <p className="text-xs text-red-500 mt-1 truncate">
                              {action.lastError}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          {action.status === 'failed' && action.retries < MAX_RETRIES && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => retryAction(action.id)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeAction(action.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      
                      {action.retries > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <RotateCcw className="h-3 w-3" />
                          <span>Retry {action.retries}/{MAX_RETRIES}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Clear confirmation dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear sync queue?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {queuedActions.length} pending action(s). 
              This cannot be undone and the changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={clearQueue}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// ── Sync Status Card (Enhanced) ──────────────────

interface SyncStatusCardProps {
  className?: string;
}

export const SyncStatusCard = ({ className }: SyncStatusCardProps) => {
  const { 
    isOnline, 
    queuedActions, 
    processQueue, 
    clearQueue,
    syncProgress,
    isSyncing,
    lastSyncTime,
    networkQuality
  } = useOffline();
  
  const pendingCount = queuedActions.filter(a => a.status === 'pending').length;
  const failedCount = queuedActions.filter(a => a.status === 'failed').length;
  
  if (pendingCount === 0 && failedCount === 0 && !isSyncing) return null;

  return (
    <div
      className={cn(
        'border rounded-lg p-4',
        isOnline && !isSyncing && 'bg-muted/50 border-muted-foreground/20',
        isSyncing && 'bg-primary/5 border-primary/20',
        !isOnline && 'bg-destructive/5 border-destructive/20',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
          isOnline && !isSyncing && 'bg-muted',
          isSyncing && 'bg-primary/10',
          !isOnline && 'bg-destructive/10'
        )}>
          {isSyncing ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : isOnline ? (
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          ) : (
            <WifiOff className="h-5 w-5 text-destructive" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">
            {isSyncing ? 'Syncing...' : isOnline ? 'Pending Actions' : 'Offline Mode'}
          </h4>
          
          {isSyncing && syncProgress ? (
            <div className="mt-2">
              <Progress 
                value={(syncProgress.current / syncProgress.total) * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {syncProgress.current}/{syncProgress.total} 
                {syncProgress.currentAction && ` • ${syncProgress.currentAction}`}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isOnline 
                  ? `${pendingCount} pending${failedCount > 0 ? `, ${failedCount} failed` : ''}`
                  : 'Your changes will be saved locally'}
              </p>
              
              {lastSyncTime && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last sync: {lastSyncTime.toLocaleTimeString()}
                </p>
              )}
              
              {isOnline && (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1"
                    onClick={() => processQueue()}
                    disabled={isSyncing}
                  >
                    <Cloud className="h-3 w-3" />
                    Sync now
                  </Button>
                  
                  <QueueManager>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      View queue
                    </Button>
                  </QueueManager>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Network quality indicator */}
        <NetworkQualityIcon quality={networkQuality} className="h-4 w-4" />
      </div>
    </div>
  );
};

export default OfflineProvider;
