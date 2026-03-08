/**
 * Enhanced StudentAnnouncements Page
 * Shows announcements from teachers to students with bookmarks, priority, and rich text
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Bell, 
  Pin, 
  Calendar, 
  CheckCircle2, 
  Circle,
  Loader2,
  Megaphone,
  Search,
  Filter,
  Bookmark,
  BookmarkCheck,
  AlertCircle,
  Clock,
  Share2,
  ChevronDown,
  ChevronUp,
  MoreVertical
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import {
  Announcement,
  getAnnouncementsForStudent,
  markAnnouncementRead,
} from '@/services/announcementService';
import { useToast } from '@/hooks/use-toast';

// Extended type for local state
interface EnhancedAnnouncement extends Announcement {
  is_bookmarked?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

type FilterType = 'all' | 'unread' | 'read' | 'pinned' | 'bookmarked' | 'high-priority';
type SortType = 'newest' | 'oldest' | 'priority';

const StudentAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<EnhancedAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('newest');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<EnhancedAnnouncement | null>(null);
  const [isMobileListVisible, setIsMobileListVisible] = useState(true);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchAnnouncements();
    
    // Load bookmarks from local storage
    const savedBookmarks = localStorage.getItem('mom_announcement_bookmarks');
    if (savedBookmarks) {
      try {
        const bookmarkIds = JSON.parse(savedBookmarks);
        setAnnouncements(prev => prev.map(a => ({
          ...a,
          is_bookmarked: bookmarkIds.includes(a.id)
        })));
      } catch (e) {
        console.error('Failed to parse bookmarks', e);
      }
    }
  }, []);

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const data = await getAnnouncementsForStudent();
      
      // Enhance with mock priority for demonstration (in a real app, this would come from DB)
      const enhancedData = data.map((a, index) => ({
        ...a,
        priority: a.is_pinned ? 'high' : (index % 5 === 0 ? 'low' : 'normal') as any
      }));
      
      // Apply saved bookmarks
      const savedBookmarks = localStorage.getItem('mom_announcement_bookmarks');
      if (savedBookmarks) {
        try {
          const bookmarkIds = JSON.parse(savedBookmarks);
          enhancedData.forEach(a => {
            a.is_bookmarked = bookmarkIds.includes(a.id);
          });
        } catch (e) {}
      }
      
      setAnnouncements(enhancedData);
      
      // Auto-select first unread or first announcement
      if (enhancedData.length > 0 && !selectedAnnouncement) {
        const firstUnread = enhancedData.find(a => !a.is_read);
        if (firstUnread) {
          handleSelectAnnouncement(firstUnread);
        } else {
          handleSelectAnnouncement(enhancedData[0]);
        }
      }
    } catch (e) {
      console.error('Error fetching announcements:', e);
      toast({
        title: 'Error',
        description: 'Failed to load announcements.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAnnouncement = async (announcement: EnhancedAnnouncement) => {
    setSelectedAnnouncement(announcement);
    setIsMobileListVisible(false);
    
    // Mark as read if not already
    if (!announcement.is_read) {
      try {
        await markAnnouncementRead(announcement.id);
        setAnnouncements(prev =>
          prev.map(a =>
            a.id === announcement.id ? { ...a, is_read: true } : a
          )
        );
      } catch (e) {
        console.error('Error marking as read:', e);
      }
    }
  };

  const toggleBookmark = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    setAnnouncements(prev => {
      const updated = prev.map(a => 
        a.id === id ? { ...a, is_bookmarked: !a.is_bookmarked } : a
      );
      
      // Save to local storage
      const bookmarkedIds = updated.filter(a => a.is_bookmarked).map(a => a.id);
      localStorage.setItem('mom_announcement_bookmarks', JSON.stringify(bookmarkedIds));
      
      // Update selected if it's the one being toggled
      if (selectedAnnouncement?.id === id) {
        setSelectedAnnouncement(updated.find(a => a.id === id) || null);
      }
      
      return updated;
    });
    
    const isBookmarking = !announcements.find(a => a.id === id)?.is_bookmarked;
    toast({
      title: isBookmarking ? 'Announcement bookmarked' : 'Bookmark removed',
      duration: 2000,
    });
  };

  const markAllAsRead = async () => {
    const unreadIds = announcements.filter(a => !a.is_read).map(a => a.id);
    if (unreadIds.length === 0) return;
    
    try {
      // In a real app, we'd have a bulk endpoint
      await Promise.all(unreadIds.map(id => markAnnouncementRead(id)));
      
      setAnnouncements(prev => prev.map(a => ({ ...a, is_read: true })));
      if (selectedAnnouncement) {
        setSelectedAnnouncement({ ...selectedAnnouncement, is_read: true });
      }
      
      toast({
        title: 'All caught up!',
        description: 'Marked all announcements as read.',
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Failed to mark all as read.',
        variant: 'destructive',
      });
    }
  };

  // Filter and sort announcements
  const processedAnnouncements = useMemo(() => {
    let result = announcements
      .filter(a => {
        if (filter === 'unread') return !a.is_read;
        if (filter === 'read') return a.is_read;
        if (filter === 'pinned') return a.is_pinned;
        if (filter === 'bookmarked') return a.is_bookmarked;
        if (filter === 'high-priority') return a.priority === 'high';
        return true;
      })
      .filter(a => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.message.toLowerCase().includes(q) ||
          (a.category && a.category.toLowerCase().includes(q))
        );
      });

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'priority') {
        const priorityWeight = { high: 3, normal: 2, low: 1 };
        const weightA = priorityWeight[a.priority || 'normal'];
        const weightB = priorityWeight[b.priority || 'normal'];
        if (weightA !== weightB) return weightB - weightA;
        // Fallback to newest
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });

    return result;
  }, [announcements, filter, searchQuery, sortBy]);

  // Group by date for display
  const groupedAnnouncements = useMemo(() => {
    const groups: Record<string, EnhancedAnnouncement[]> = {
      'Pinned': [],
      'Today': [],
      'Yesterday': [],
      'Earlier': []
    };

    processedAnnouncements.forEach(a => {
      if (a.is_pinned) {
        groups['Pinned'].push(a);
      } else {
        const date = new Date(a.created_at);
        if (isToday(date)) {
          groups['Today'].push(a);
        } else if (isYesterday(date)) {
          groups['Yesterday'].push(a);
        } else {
          groups['Earlier'].push(a);
        }
      }
    });

    return groups;
  }, [processedAnnouncements]);

  const unreadCount = announcements.filter(a => !a.is_read).length;

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4 h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="mb-6 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Megaphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
              <p className="text-sm text-muted-foreground">
                Important updates and information from your teachers
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge className="bg-primary text-primary-foreground px-3 py-1 text-sm">
                {unreadCount} unread
              </Badge>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="hidden sm:flex"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 bg-card p-3 rounded-lg border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 border-none bg-muted/50 focus-visible:ring-1"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <SelectTrigger className="w-[140px] border-none bg-muted/50">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Messages</SelectItem>
                <SelectItem value="unread">Unread Only</SelectItem>
                <SelectItem value="read">Read Only</SelectItem>
                <SelectItem value="pinned">Pinned</SelectItem>
                <SelectItem value="bookmarked">Bookmarked</SelectItem>
                <SelectItem value="high-priority">High Priority</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortType)}>
              <SelectTrigger className="w-[140px] border-none bg-muted/50">
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="priority">By Priority</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        {/* Mobile Back Button (only visible on small screens when viewing detail) */}
        {!isMobileListVisible && (
          <Button 
            variant="ghost" 
            className="lg:hidden mb-2 self-start"
            onClick={() => setIsMobileListVisible(true)}
          >
            <ChevronDown className="h-4 w-4 mr-2 rotate-90" />
            Back to list
          </Button>
        )}

        {/* Announcements List */}
        <div className={cn(
          "lg:col-span-4 xl:col-span-4 flex flex-col h-full",
          !isMobileListVisible && "hidden lg:flex"
        )}>
          <Card className="flex-1 flex flex-col overflow-hidden border-muted shadow-sm">
            <CardHeader className="py-3 px-4 bg-muted/30 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Inbox
                </CardTitle>
                <Badge variant="secondary" className="text-xs font-normal">
                  {processedAnnouncements.length}
                </Badge>
              </div>
            </CardHeader>
            
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading announcements...</p>
                </div>
              ) : processedAnnouncements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Bell className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-base font-medium">No announcements found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {filter !== 'all' || searchQuery 
                      ? 'Try adjusting your filters or search query' 
                      : "You're all caught up! Check back later."}
                  </p>
                  {(filter !== 'all' || searchQuery) && (
                    <Button 
                      variant="link" 
                      onClick={() => { setFilter('all'); setSearchQuery(''); }}
                      className="mt-4"
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="pb-4">
                  {Object.entries(groupedAnnouncements).map(([groupName, items]) => {
                    if (items.length === 0) return null;
                    
                    return (
                      <div key={groupName} className="mb-2">
                        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 py-2 border-y border-muted/50 flex items-center gap-2">
                          {groupName === 'Pinned' && <Pin className="h-3.5 w-3.5 text-primary" />}
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {groupName}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60 ml-auto">
                            {items.length}
                          </span>
                        </div>
                        <div className="divide-y divide-muted/50">
                          {items.map((a) => (
                            <AnnouncementListItem
                              key={a.id}
                              announcement={a}
                              isSelected={selectedAnnouncement?.id === a.id}
                              onClick={() => handleSelectAnnouncement(a)}
                              onToggleBookmark={(e) => toggleBookmark(e, a.id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>

        {/* Announcement Detail */}
        <div className={cn(
          "lg:col-span-8 xl:col-span-8 flex flex-col h-full",
          isMobileListVisible && "hidden lg:flex"
        )}>
          <Card className="flex-1 flex flex-col overflow-hidden shadow-md border-primary/10">
            {selectedAnnouncement ? (
              <>
                <CardHeader className="pb-4 border-b bg-card relative overflow-hidden">
                  {/* Decorative background element for high priority */}
                  {selectedAnnouncement.priority === 'high' && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full -z-10" />
                  )}
                  
                  <div className="flex items-start justify-between gap-4 z-10">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {selectedAnnouncement.is_pinned && (
                          <Badge variant="default" className="bg-primary/20 text-primary hover:bg-primary/30 border-none text-xs gap-1">
                            <Pin className="h-3 w-3" /> Pinned
                          </Badge>
                        )}
                        {selectedAnnouncement.priority === 'high' && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertCircle className="h-3 w-3" /> Important
                          </Badge>
                        )}
                        {selectedAnnouncement.category && (
                          <Badge variant="outline" className="text-xs bg-background">
                            {selectedAnnouncement.category}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs font-normal ml-auto sm:ml-0">
                          From: Teacher
                        </Badge>
                      </div>
                      
                      <CardTitle className="text-2xl leading-tight mb-2">
                        {selectedAnnouncement.title}
                      </CardTitle>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(selectedAnnouncement.created_at), 'EEEE, MMMM d, yyyy')}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {format(new Date(selectedAnnouncement.created_at), 'h:mm a')}
                        </span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                          {formatDistanceToNow(new Date(selectedAnnouncement.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={(e) => toggleBookmark(e, selectedAnnouncement.id)}
                              className={selectedAnnouncement.is_bookmarked ? "text-primary" : "text-muted-foreground"}
                            >
                              {selectedAnnouncement.is_bookmarked ? (
                                <BookmarkCheck className="h-5 w-5 fill-primary/20" />
                              ) : (
                                <Bookmark className="h-5 w-5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {selectedAnnouncement.is_bookmarked ? 'Remove bookmark' : 'Bookmark'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            navigator.clipboard.writeText(`${selectedAnnouncement.title}\n\n${selectedAnnouncement.message}`);
                            toast({ title: 'Copied to clipboard' });
                          }}>
                            <Share2 className="h-4 w-4 mr-2" />
                            Copy text
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                
                <ScrollArea className="flex-1 bg-muted/10">
                  <CardContent className="p-6 sm:p-8">
                    <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert">
                      {/* Render message with basic formatting support */}
                      {selectedAnnouncement.message.split('\n\n').map((paragraph, i) => (
                        <p key={i} className="whitespace-pre-wrap leading-relaxed mb-4 last:mb-0 text-foreground/90">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </CardContent>
                </ScrollArea>
                
                <CardFooter className="border-t bg-card p-4 flex justify-between items-center text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Marked as read</span>
                  </div>
                  {selectedAnnouncement.updated_at && selectedAnnouncement.updated_at !== selectedAnnouncement.created_at && (
                    <span className="italic text-xs">
                      Edited {formatDistanceToNow(new Date(selectedAnnouncement.updated_at), { addSuffix: true })}
                    </span>
                  )}
                </CardFooter>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-muted/10">
                <div className="h-24 w-24 rounded-full bg-background shadow-sm flex items-center justify-center mb-6 border border-muted">
                  <Megaphone className="h-10 w-10 text-primary/40" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Select an announcement</h3>
                <p className="text-muted-foreground max-w-md">
                  Choose an announcement from the list on the left to read its full contents. 
                  Important updates will be pinned to the top.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

// ── List Item Component ────────────────────────────

interface AnnouncementListItemProps {
  announcement: EnhancedAnnouncement;
  isSelected: boolean;
  onClick: () => void;
  onToggleBookmark: (e: React.MouseEvent) => void;
}

const AnnouncementListItem = ({ 
  announcement, 
  isSelected, 
  onClick,
  onToggleBookmark
}: AnnouncementListItemProps) => {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'w-full text-left px-4 py-3.5 transition-all relative group cursor-pointer select-none',
        isSelected ? 'bg-primary/5' : 'hover:bg-muted/50',
        !announcement.is_read && !isSelected && 'bg-primary/[0.02]'
      )}
    >
      {/* Selection indicator line */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
      )}
      
      <div className="flex items-start gap-3">
        <div className="pt-1 shrink-0">
          {!announcement.is_read ? (
            <div className="relative">
              <Circle className="h-3 w-3 text-primary fill-primary" />
              <span className="absolute -inset-1 rounded-full bg-primary/20 animate-ping" />
            </div>
          ) : (
            <CheckCircle2 className="h-3 w-3 text-muted-foreground/40" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className={cn(
              'text-sm leading-tight pr-2',
              !announcement.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground/80',
              announcement.priority === 'high' && 'text-red-600 dark:text-red-400'
            )}>
              {announcement.title}
            </h4>
            
            <div className="flex items-center gap-1 shrink-0">
              {announcement.priority === 'high' && !announcement.is_pinned && (
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
              )}
              <div 
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBookmark();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleBookmark();
                  }
                }}
                className={cn(
                  "p-1 rounded-md transition-opacity cursor-pointer",
                  announcement.is_bookmarked ? "opacity-100" : "opacity-0 group-hover:opacity-100 hover:bg-muted"
                )}
              >
                <Bookmark className={cn(
                  "h-3.5 w-3.5", 
                  announcement.is_bookmarked ? "fill-primary text-primary" : "text-muted-foreground"
                )} />
              </div>
            </div>
          </div>
          
          <p className={cn(
            "text-xs line-clamp-2 mb-2",
            !announcement.is_read ? "text-muted-foreground" : "text-muted-foreground/70"
          )}>
            {announcement.message}
          </p>
          
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-2">
              {announcement.category && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {announcement.category}
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground/70 font-medium">
              {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentAnnouncements;
