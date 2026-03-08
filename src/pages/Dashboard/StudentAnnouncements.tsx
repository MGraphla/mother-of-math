/**
 * Industry-Standard StudentAnnouncements Page
 * Email-client layout with stats, skeleton loading, category colors, teacher avatars,
 * rich-text rendering, prev/next navigation, expiry indicators, and print support.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bell, Pin, Calendar, CheckCircle2, Circle, Megaphone, Search,
  Bookmark, BookmarkCheck, AlertCircle, Clock, Share2,
  ChevronLeft, ChevronRight, MoreVertical, RefreshCw, Printer,
  Inbox, X, ArrowLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  formatDistanceToNow, format, isToday, isYesterday,
  isPast, differenceInHours, differenceInDays,
} from 'date-fns';
import {
  Announcement, getAnnouncementsForStudent, markAnnouncementRead,
} from '@/services/announcementService';
import { useToast } from '@/hooks/use-toast';

// ── Types ───────────────────────────────────────────────────────────────────

interface EnhancedAnnouncement extends Announcement {
  is_bookmarked?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

type QuickFilter = 'all' | 'unread' | 'pinned' | 'bookmarked';
type SortType = 'newest' | 'oldest' | 'priority';

// ── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  math:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  science:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  english:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  general:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  assignment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  exam:       'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  event:      'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  homework:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const getCategoryColor = (category: string | null): string => {
  if (!category) return CATEGORY_COLORS.general;
  const key = category.toLowerCase();
  if (CATEGORY_COLORS[key]) return CATEGORY_COLORS[key];
  const palette = Object.values(CATEGORY_COLORS);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
};

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-rose-500', 'bg-amber-500', 'bg-cyan-500',
];

const getAvatarColor = (id: string): string => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getExpiryInfo = (expiresAt: string | null): { label: string; urgent: boolean } | null => {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (isPast(date)) return { label: 'Expired', urgent: true };
  const hours = differenceInHours(date, new Date());
  if (hours < 24) return { label: `Expires in ${hours}h`, urgent: true };
  const days = differenceInDays(date, new Date());
  return { label: `Expires in ${days}d`, urgent: false };
};

// ── Rich Text Renderer ───────────────────────────────────────────────────────

const formatInline = (text: string) => {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<strong key={m.index} className="font-semibold text-foreground">{m[1]}</strong>);
    else if (m[2]) parts.push(<em key={m.index}>{m[2]}</em>);
    else if (m[3]) parts.push(<code key={m.index} className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{m[3]}</code>);
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? <>{parts}</> : text;
};

const RichTextMessage = ({ text }: { text: string }) => (
  <div className="space-y-3 text-sm leading-relaxed">
    {text.split('\n').map((line, i) => {
      if (!line.trim()) return <div key={i} className="h-1" />;
      if (line.startsWith('# '))  return <h2 key={i} className="text-lg font-bold mt-3 mb-1">{line.slice(2)}</h2>;
      if (line.startsWith('## ')) return <h3 key={i} className="text-base font-semibold mt-2 mb-1">{line.slice(3)}</h3>;
      if (/^[-*•]\s/.test(line))  return (
        <div key={i} className="flex gap-2.5 items-start">
          <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
          <span className="text-foreground/85">{formatInline(line.replace(/^[-*•]\s/, ''))}</span>
        </div>
      );
      const numM = line.match(/^(\d+[.)]\s+)/);
      if (numM) return (
        <div key={i} className="flex gap-2 items-start">
          <span className="text-xs text-primary/60 font-medium mt-0.5 w-5 shrink-0">{numM[1].trim()}</span>
          <span className="text-foreground/85">{formatInline(line.slice(numM[1].length))}</span>
        </div>
      );
      return <p key={i} className="text-foreground/85">{formatInline(line)}</p>;
    })}
  </div>
);

// ── Skeleton List Item ───────────────────────────────────────────────────────

const SkeletonListItem = () => (
  <div className="px-4 py-3.5 border-b border-muted/40">
    <div className="flex items-start gap-3">
      <Skeleton className="h-2.5 w-2.5 rounded-full mt-1.5 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex justify-between pt-0.5">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  </div>
);

// ── Main Component ───────────────────────────────────────────────────────────

const StudentAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<EnhancedAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [sortBy, setSortBy] = useState<SortType>('newest');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<EnhancedAnnouncement | null>(null);
  const [isMobileListVisible, setIsMobileListVisible] = useState(true);

  const { toast } = useToast();

  useEffect(() => { fetchAnnouncements(); }, []);

  const fetchAnnouncements = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const data = await getAnnouncementsForStudent();
      const enhancedData: EnhancedAnnouncement[] = data.map(a => ({
        ...a,
        priority: (a.is_pinned ? 'high' : 'normal') as 'high' | 'normal' | 'low',
        is_bookmarked: false,
      }));

      try {
        const saved = localStorage.getItem('mom_announcement_bookmarks');
        if (saved) {
          const ids = JSON.parse(saved) as string[];
          enhancedData.forEach(a => { a.is_bookmarked = ids.includes(a.id); });
        }
      } catch { /* ignore corrupt localStorage */ }

      setAnnouncements(enhancedData);
      setLastUpdated(new Date());

      if (enhancedData.length > 0 && !selectedAnnouncement) {
        const first = enhancedData.find(a => !a.is_read) ?? enhancedData[0];
        handleSelectAnnouncement(first);
      }
    } catch {
      toast({
        title: 'Failed to load announcements',
        description: 'Check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleSelectAnnouncement = async (ann: EnhancedAnnouncement) => {
    setSelectedAnnouncement(ann);
    setIsMobileListVisible(false);
    if (!ann.is_read) {
      try {
        await markAnnouncementRead(ann.id);
        setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, is_read: true } : a));
        setSelectedAnnouncement(prev => prev?.id === ann.id ? { ...prev, is_read: true } : prev);
      } catch { /* non-critical */ }
    }
  };

  const toggleBookmark = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setAnnouncements(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, is_bookmarked: !a.is_bookmarked } : a);
      const ids = updated.filter(a => a.is_bookmarked).map(a => a.id);
      localStorage.setItem('mom_announcement_bookmarks', JSON.stringify(ids));
      if (selectedAnnouncement?.id === id) {
        setSelectedAnnouncement(updated.find(a => a.id === id) ?? null);
      }
      return updated;
    });
    const isAdding = !announcements.find(a => a.id === id)?.is_bookmarked;
    toast({ title: isAdding ? 'Bookmarked' : 'Bookmark removed', duration: 2000 });
  }, [announcements, selectedAnnouncement, toast]);

  const markAllAsRead = async () => {
    const ids = announcements.filter(a => !a.is_read).map(a => a.id);
    if (!ids.length) return;
    try {
      await Promise.all(ids.map(markAnnouncementRead));
      setAnnouncements(prev => prev.map(a => ({ ...a, is_read: true })));
      setSelectedAnnouncement(prev => prev ? { ...prev, is_read: true } : prev);
      toast({ title: 'All caught up!', description: `${ids.length} announcement${ids.length > 1 ? 's' : ''} marked as read.` });
    } catch {
      toast({ title: 'Error', description: 'Could not mark all as read.', variant: 'destructive' });
    }
  };

  // ── Derived data ────────────────────────────────────────────────────────

  const processedAnnouncements = useMemo(() => {
    return announcements
      .filter(a => {
        if (quickFilter === 'unread')     return !a.is_read;
        if (quickFilter === 'pinned')     return a.is_pinned;
        if (quickFilter === 'bookmarked') return a.is_bookmarked;
        return true;
      })
      .filter(a => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return a.title.toLowerCase().includes(q)
          || a.message.toLowerCase().includes(q)
          || (a.category?.toLowerCase().includes(q) ?? false);
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          const w = { high: 3, normal: 2, low: 1 } as const;
          const diff = (w[b.priority ?? 'normal'] ?? 2) - (w[a.priority ?? 'normal'] ?? 2);
          if (diff !== 0) return diff;
        }
        if (sortBy === 'oldest') return +new Date(a.created_at) - +new Date(b.created_at);
        return +new Date(b.created_at) - +new Date(a.created_at);
      });
  }, [announcements, quickFilter, searchQuery, sortBy]);

  const groupedAnnouncements = useMemo(() => {
    const groups = [
      { label: 'Pinned',    items: [] as EnhancedAnnouncement[] },
      { label: 'Today',     items: [] as EnhancedAnnouncement[] },
      { label: 'Yesterday', items: [] as EnhancedAnnouncement[] },
      { label: 'Earlier',   items: [] as EnhancedAnnouncement[] },
    ];
    processedAnnouncements.forEach(a => {
      if (a.is_pinned) { groups[0].items.push(a); return; }
      const d = new Date(a.created_at);
      if (isToday(d))      groups[1].items.push(a);
      else if (isYesterday(d)) groups[2].items.push(a);
      else                 groups[3].items.push(a);
    });
    return groups.filter(g => g.items.length > 0);
  }, [processedAnnouncements]);

  const unreadCount     = useMemo(() => announcements.filter(a => !a.is_read).length, [announcements]);
  const pinnedCount     = useMemo(() => announcements.filter(a => a.is_pinned).length, [announcements]);
  const bookmarkedCount = useMemo(() => announcements.filter(a => a.is_bookmarked).length, [announcements]);
  const readPercent     = announcements.length
    ? Math.round(((announcements.length - unreadCount) / announcements.length) * 100)
    : 100;

  const currentIndex = selectedAnnouncement
    ? processedAnnouncements.findIndex(a => a.id === selectedAnnouncement.id)
    : -1;

  const navigateTo = (delta: number) => {
    const target = processedAnnouncements[currentIndex + delta];
    if (target) handleSelectAnnouncement(target);
  };

  const handleCopyText = () => {
    if (!selectedAnnouncement) return;
    navigator.clipboard.writeText(`${selectedAnnouncement.title}\n\n${selectedAnnouncement.message}`);
    toast({ title: 'Copied to clipboard', duration: 2000 });
  };

  const handlePrint = () => {
    if (!selectedAnnouncement) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>${selectedAnnouncement.title}</title>
      <style>
        body { font-family: system-ui, sans-serif; max-width: 700px; margin: 40px auto; color: #111; }
        h1 { font-size: 1.4rem; margin-bottom: 0.4rem; }
        .meta { color: #666; font-size: 0.85rem; margin-bottom: 1.5rem; border-bottom: 1px solid #eee; padding-bottom: 1rem; }
        .body { font-size: 1rem; line-height: 1.75; white-space: pre-wrap; }
      </style></head><body>
      <h1>${selectedAnnouncement.title}</h1>
      <div class="meta">${format(new Date(selectedAnnouncement.created_at), 'EEEE, MMMM d, yyyy · h:mm a')}</div>
      <div class="body">${selectedAnnouncement.message.replace(/</g, '&lt;')}</div>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="container max-w-7xl mx-auto px-4 py-6 flex flex-col gap-5 h-[calc(100vh-4rem)]">

        {/* ── Page Header ──────────────────────────────────────────── */}
        <div className="shrink-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20 shrink-0">
                <Megaphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Announcements</h1>
                <p className="text-xs text-muted-foreground">
                  {lastUpdated
                    ? `Updated ${formatDistanceToNow(lastUpdated, { addSuffix: true })}`
                    : 'Important updates from your teachers'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => fetchAnnouncements(true)}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllAsRead} className="h-8 text-xs gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark all read
                </Button>
              )}
            </div>
          </div>

          {/* ── Stats Cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total',      value: announcements.length, icon: Inbox,          accent: 'bg-primary/10 text-primary' },
              { label: 'Unread',     value: unreadCount,          icon: Bell,           accent: 'bg-amber-500/10 text-amber-600' },
              { label: 'Pinned',     value: pinnedCount,          icon: Pin,            accent: 'bg-blue-500/10 text-blue-600' },
              { label: 'Bookmarked', value: bookmarkedCount,      icon: Bookmark,       accent: 'bg-violet-500/10 text-violet-600' },
            ].map(({ label, value, icon: Icon, accent }) => (
              <div
                key={label}
                className="bg-card border border-muted/60 rounded-xl px-4 py-3 flex items-center gap-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
              >
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', accent)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-lg font-bold leading-none tabular-nums">
                    {isLoading ? '—' : value}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Search + Sort ────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <Input
                placeholder="Search announcements…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 bg-muted/40 border-muted focus-visible:ring-1"
              />
            </div>
            <Select value={sortBy} onValueChange={v => setSortBy(v as SortType)}>
              <SelectTrigger className="w-[160px] h-9 bg-muted/40 border-muted text-sm">
                <Clock className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="priority">By Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Content Grid ─────────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">

          {/* Mobile back */}
          {!isMobileListVisible && (
            <div className="lg:hidden col-span-full -mb-2">
              <Button
                variant="ghost" size="sm"
                onClick={() => setIsMobileListVisible(true)}
                className="h-8 text-xs gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to list
              </Button>
            </div>
          )}

          {/* ── Left Pane ──────────────────────────────────────────── */}
          <div className={cn(
            'lg:col-span-4 flex flex-col min-h-0',
            !isMobileListVisible && 'hidden lg:flex',
          )}>
            <Card className="flex-1 flex flex-col overflow-hidden border-muted/60 shadow-sm">

              {/* Pane header: filter tabs + progress */}
              <div className="shrink-0 px-3 pt-3 pb-2.5 border-b bg-muted/20 space-y-2.5">
                {/* Quick filter tabs */}
                <div className="flex items-center gap-1">
                  {(['all', 'unread', 'pinned', 'bookmarked'] as QuickFilter[]).map(f => {
                    const counts: Record<QuickFilter, number> = {
                      all: announcements.length, unread: unreadCount,
                      pinned: pinnedCount,        bookmarked: bookmarkedCount,
                    };
                    return (
                      <button
                        key={f}
                        onClick={() => setQuickFilter(f)}
                        className={cn(
                          'text-[11px] font-medium px-2 py-1 rounded-md transition-colors capitalize flex items-center gap-1',
                          quickFilter === f
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {f}
                        {counts[f] > 0 && (
                          <span className={cn(
                            'text-[10px] font-bold leading-none px-1 py-0.5 rounded',
                            quickFilter === f
                              ? 'bg-white/20 text-primary-foreground'
                              : 'bg-muted text-muted-foreground',
                          )}>
                            {counts[f]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Read progress bar */}
                <div className="flex items-center gap-2">
                  <Progress value={readPercent} className="h-1.5 flex-1" />
                  <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap shrink-0">
                    {announcements.length - unreadCount}/{announcements.length} read
                  </span>
                </div>
              </div>

              {/* List body */}
              <ScrollArea className="flex-1">
                {isLoading ? (
                  <>{Array.from({ length: 5 }).map((_, i) => <SkeletonListItem key={i} />)}</>
                ) : processedAnnouncements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                    <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                      <Inbox className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-semibold">Nothing here</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {quickFilter !== 'all' || searchQuery
                        ? 'Try a different filter or search term'
                        : "You're all caught up!"}
                    </p>
                    {(quickFilter !== 'all' || searchQuery) && (
                      <Button
                        variant="link" size="sm"
                        onClick={() => { setQuickFilter('all'); setSearchQuery(''); }}
                        className="mt-2 text-xs h-7"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    {groupedAnnouncements.map(({ label, items }) => (
                      <div key={label}>
                        <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm px-4 py-1.5 border-b border-muted/40 flex items-center gap-1.5">
                          {label === 'Pinned' && <Pin className="h-3 w-3 text-primary" />}
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            {label}
                          </span>
                          <span className="ml-auto text-[10px] font-semibold text-muted-foreground/50 bg-muted/60 px-1.5 rounded-sm">
                            {items.length}
                          </span>
                        </div>
                        <div className="divide-y divide-muted/30">
                          {items.map(a => (
                            <AnnouncementListItem
                              key={a.id}
                              announcement={a}
                              isSelected={selectedAnnouncement?.id === a.id}
                              onClick={() => handleSelectAnnouncement(a)}
                              onToggleBookmark={e => toggleBookmark(e, a.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </ScrollArea>
            </Card>
          </div>

          {/* ── Right Pane ─────────────────────────────────────────── */}
          <div className={cn(
            'lg:col-span-8 flex flex-col min-h-0',
            isMobileListVisible && 'hidden lg:flex',
          )}>
            <Card className="flex-1 flex flex-col overflow-hidden border-muted/60 shadow-sm">
              {selectedAnnouncement ? (
                <AnnouncementDetail
                  announcement={selectedAnnouncement}
                  currentIndex={currentIndex}
                  total={processedAnnouncements.length}
                  onNavigate={navigateTo}
                  onToggleBookmark={e => toggleBookmark(e, selectedAnnouncement.id)}
                  onCopy={handleCopyText}
                  onPrint={handlePrint}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-muted/[0.03]">
                  <div className="h-20 w-20 rounded-2xl bg-muted/60 border border-muted flex items-center justify-center mb-5">
                    <Megaphone className="h-9 w-9 text-muted-foreground/25" />
                  </div>
                  <h3 className="text-base font-semibold mb-1.5">Select an announcement</h3>
                  <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                    Choose an announcement from the list to read its full content.
                    Pinned items always appear at the top.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

// ── Announcement Detail ─────────────────────────────────────────────────────

interface DetailProps {
  announcement: EnhancedAnnouncement;
  currentIndex: number;
  total: number;
  onNavigate: (delta: number) => void;
  onToggleBookmark: (e: React.MouseEvent) => void;
  onCopy: () => void;
  onPrint: () => void;
}

const AnnouncementDetail = ({
  announcement, currentIndex, total, onNavigate, onToggleBookmark, onCopy, onPrint,
}: DetailProps) => {
  const avatarColor = getAvatarColor(announcement.teacher_id);
  const expiry = getExpiryInfo(announcement.expires_at ?? null);

  return (
    <>
      {/* Header */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b bg-card relative overflow-hidden">
        {/* Priority left accent */}
        {announcement.priority === 'high' && (
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-red-400 to-red-600" />
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {announcement.is_pinned && (
                <Badge className="bg-primary/10 text-primary border border-primary/20 text-[11px] gap-1 py-0.5 font-medium">
                  <Pin className="h-2.5 w-2.5" /> Pinned
                </Badge>
              )}
              {announcement.priority === 'high' && !announcement.is_pinned && (
                <Badge variant="destructive" className="text-[11px] gap-1 py-0.5">
                  <AlertCircle className="h-2.5 w-2.5" /> Important
                </Badge>
              )}
              {announcement.category && (
                <span className={cn(
                  'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                  getCategoryColor(announcement.category),
                )}>
                  {announcement.category}
                </span>
              )}
              {!announcement.is_read && (
                <Badge variant="secondary" className="text-[11px] gap-1 py-0.5">
                  <Circle className="h-2 w-2 fill-primary text-primary" /> New
                </Badge>
              )}
              {expiry && (
                <Badge
                  variant={expiry.urgent ? 'destructive' : 'outline'}
                  className="text-[11px] gap-1 py-0.5"
                >
                  <Clock className="h-2.5 w-2.5" /> {expiry.label}
                </Badge>
              )}
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold tracking-tight leading-snug mb-3">
              {announcement.title}
            </h2>

            {/* Author + meta */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0',
                  avatarColor,
                )}>
                  T
                </div>
                <span className="text-sm font-medium text-foreground/80">Your Teacher</span>
              </div>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                {format(new Date(announcement.created_at), 'MMM d, yyyy')}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {format(new Date(announcement.created_at), 'h:mm a')}
              </span>
              <span className="text-xs text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full">
                {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleBookmark}>
                  {announcement.is_bookmarked
                    ? <BookmarkCheck className="h-4 w-4 text-primary fill-primary/20" />
                    : <Bookmark className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{announcement.is_bookmarked ? 'Remove bookmark' : 'Bookmark'}</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={onCopy}>
                  <Share2 className="h-4 w-4 mr-2" /> Copy text
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onPrint}>
                  <Printer className="h-4 w-4 mr-2" /> Print
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1 bg-muted/[0.03]">
        <CardContent
          key={announcement.id}
          className="p-6 sm:p-8 max-w-3xl animate-in fade-in duration-200"
        >
          <RichTextMessage text={announcement.message} />
        </CardContent>
      </ScrollArea>

      {/* Footer */}
      <div className="shrink-0 border-t bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {announcement.is_read ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span>Read</span>
            </>
          ) : (
            <>
              <Circle className="h-3.5 w-3.5 text-amber-500" />
              <span>Unread</span>
            </>
          )}
          {announcement.updated_at && announcement.updated_at !== announcement.created_at && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <span className="italic">
                Edited {formatDistanceToNow(new Date(announcement.updated_at), { addSuffix: true })}
              </span>
            </>
          )}
        </div>

        {/* Prev / Next */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {currentIndex + 1} / {total}
          </span>
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => onNavigate(-1)}
                  disabled={currentIndex <= 0}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => onNavigate(1)}
                  disabled={currentIndex >= total - 1}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </>
  );
};

// ── List Item ────────────────────────────────────────────────────────────────

interface AnnouncementListItemProps {
  announcement: EnhancedAnnouncement;
  isSelected: boolean;
  onClick: () => void;
  onToggleBookmark: (e: React.MouseEvent) => void;
}

const AnnouncementListItem = ({
  announcement, isSelected, onClick, onToggleBookmark,
}: AnnouncementListItemProps) => {
  const expiry = getExpiryInfo(announcement.expires_at ?? null);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={cn(
        'relative w-full text-left px-4 py-3.5 transition-colors cursor-pointer select-none group outline-none',
        'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset',
        isSelected ? 'bg-primary/[0.06]' : 'hover:bg-muted/50',
        !announcement.is_read && !isSelected && 'bg-primary/[0.02]',
      )}
    >
      {/* Selected edge */}
      {isSelected && <div className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}
      {/* Priority edge */}
      {!isSelected && announcement.priority === 'high' && (
        <div className="absolute inset-y-0 left-0 w-0.5 bg-red-400/70" />
      )}

      <div className="flex items-start gap-3">
        {/* Unread dot */}
        <div className="mt-1.5 shrink-0">
          {!announcement.is_read ? (
            <span className="block h-2 w-2 rounded-full bg-primary" />
          ) : (
            <span className="block h-2 w-2 rounded-full border border-muted-foreground/25" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title + bookmark */}
          <div className="flex items-start gap-2 mb-1">
            <h4 className={cn(
              'text-sm leading-snug flex-1',
              !announcement.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground/70',
            )}>
              {announcement.title}
            </h4>
            <button
              onClick={e => { e.stopPropagation(); onToggleBookmark(e); }}
              className={cn(
                'shrink-0 p-0.5 rounded transition-opacity mt-0.5',
                announcement.is_bookmarked
                  ? 'opacity-100 text-primary'
                  : 'opacity-0 group-hover:opacity-50 text-muted-foreground hover:!opacity-100',
              )}
              aria-label={announcement.is_bookmarked ? 'Remove bookmark' : 'Bookmark'}
            >
              <Bookmark className={cn('h-3.5 w-3.5', announcement.is_bookmarked && 'fill-primary')} />
            </button>
          </div>

          {/* Snippet */}
          <p className={cn(
            'text-xs line-clamp-2 mb-2 leading-relaxed',
            !announcement.is_read ? 'text-muted-foreground' : 'text-muted-foreground/55',
          )}>
            {announcement.message}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {announcement.category && (
              <span className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                getCategoryColor(announcement.category),
              )}>
                {announcement.category}
              </span>
            )}
            {expiry?.urgent && (
              <span className="text-[10px] font-medium text-red-500 flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" /> {expiry.label}
              </span>
            )}
            <span className="ml-auto text-[10px] text-muted-foreground/55 font-medium shrink-0">
              {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentAnnouncements;
