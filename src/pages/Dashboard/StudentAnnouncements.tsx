import { useState, useEffect, useMemo } from 'react';
import { 
  Bell, Pin, Search, CheckCircle2, Circle, Mail, 
  Calendar, Clock, User, Filter, ArrowLeft, MoreVertical, 
  RefreshCw, Bookmark, Share2, Tag, ChevronRight, Inbox,
  AlertCircle
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Announcement, 
  getAnnouncementsForStudent, 
  markAnnouncementRead 
} from '@/services/announcementService';
import { cn } from '@/lib/utils';

// -----------------------------------------------------------------------------
// Constants & Types
// -----------------------------------------------------------------------------

const CATEGORY_STYLES: Record<string, { bg: string, text: string, icon: React.ReactNode }> = {
  general:    { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', icon: <Bell className="w-3 h-3" /> },
  math:       { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: <Tag className="w-3 h-3" /> },
  science:    { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: <Tag className="w-3 h-3" /> },
  english:    { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', icon: <Tag className="w-3 h-3" /> },
  exam:       { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: <Calendar className="w-3 h-3" /> },
  assignment: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', icon: <Clock className="w-3 h-3" /> },
  event:      { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', icon: <Calendar className="w-3 h-3" /> },
  homework:   { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', icon: <Clock className="w-3 h-3" /> },
};

const getCategoryStyle = (cat: string | null) => {
  const key = cat?.toLowerCase() || 'general';
  return CATEGORY_STYLES[key] || CATEGORY_STYLES.general;
};

// -----------------------------------------------------------------------------
// Rich Text Renderer 
// -----------------------------------------------------------------------------

const RichTextDisplay = ({ content }: { content: string }) => {
  if (!content) return null;
  const lines = content.split('\n');
  
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        
        // Headers
        if (line.startsWith('# ')) 
          return <h1 key={i} className="text-2xl font-bold mt-4 mb-2 text-primary">{line.slice(2)}</h1>;
        if (line.startsWith('## ')) 
          return <h2 key={i} className="text-xl font-semibold mt-3 mb-2 text-foreground">{line.slice(3)}</h2>;
        
        // Lists
        if (line.startsWith('- ') || line.startsWith('• ')) 
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-primary/60 mt-1.5">•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
          
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function StudentAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'important'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Fetch Logic
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await getAnnouncementsForStudent();
      
      const processed = data.map(a => ({
        ...a,
        priority: a.is_pinned ? 'high' : a.priority || 'normal'
      }));
      
      setAnnouncements(processed);
      
      // Auto-select logic for desktop
      if (!selectedId && processed.length > 0 && !isMobile) {
         const firstUnread = processed.find(a => !a.is_read);
         const firstPinned = processed.find(a => a.is_pinned);
         setSelectedId(firstUnread?.id || firstPinned?.id || processed[0].id);
      }
    } catch (error) {
      console.error("Failed to load announcements", error);
      toast({
        variant: "destructive", 
        title: "Connection Error", 
        description: "Could not load announcements. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isMobile]); // Re-run fetch if mobile state changes to ensure auto-select logic works if switching to desktop

  // Selection & Read Handling
  const handleSelect = async (announcement: Announcement) => {
    setSelectedId(announcement.id);
    if (isMobile) setIsMobileDetailOpen(true);

    if (!announcement.is_read) {
      setAnnouncements(prev => prev.map(a => 
        a.id === announcement.id ? { ...a, is_read: true } : a
      ));
      
      try {
        await markAnnouncementRead(announcement.id);
        window.dispatchEvent(new Event('announcement-read'));
      } catch (err) {
        console.error("Failed to mark read", err);
      }
    }
  };

  // Filter Pipeline
  const filteredAnnouncements = useMemo(() => {
    let result = announcements;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => 
        a.title.toLowerCase().includes(q) || 
        a.message.toLowerCase().includes(q) ||
        (a.category && a.category.toLowerCase().includes(q))
      );
    }

    if (filter === 'unread') {
      result = result.filter(a => !a.is_read);
    } else if (filter === 'important') {
      result = result.filter(a => a.is_pinned || a.priority === 'high');
    }

    return result.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [announcements, filter, searchQuery]);

  const selectedAnnouncement = useMemo(() => 
    announcements.find(a => a.id === selectedId), 
    [announcements, selectedId]
  );
  
  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm sm:rounded-2xl max-h-[min(100%,calc(100dvh-5.5rem))] lg:my-1 lg:border-border/90 lg:shadow-md">
      
      {/* Top Bar */}
      <div className="flex min-h-[2.85rem] sm:min-h-[3.25rem] items-center justify-between gap-2 border-b border-white/10 bg-primary px-2.5 py-2 text-primary-foreground sm:px-4 sm:py-3.5">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <div className="shrink-0 rounded-lg sm:rounded-xl bg-white/15 p-1.5 sm:p-2 text-primary-foreground">
            <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/70">Messages</p>
            <h1 className="text-sm font-bold leading-tight tracking-tight sm:text-lg">Announcements</h1>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-primary-foreground/80 sm:line-clamp-none sm:text-xs sm:mt-1">
              {announcements.filter(a => !a.is_read).length} unread from your school
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <TooltipProvider>
             <Tooltip>
               <TooltipTrigger asChild>
                 <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 touch-manipulation text-primary-foreground hover:bg-white/15" onClick={() => fetchData()} disabled={isLoading}>
                   <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                 </Button>
               </TooltipTrigger>
               <TooltipContent>Refresh</TooltipContent>
             </Tooltip>
           </TooltipProvider>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* LEFT PANE: List */}
        { (!isMobile || !isMobileDetailOpen) && (
          <div className={cn(
            "flex-col w-full lg:w-96 border-r bg-muted/5 transition-all duration-300 flex",
          )}>
            
            <div className="p-3 space-y-3 border-b bg-background/50 backdrop-blur-sm">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search announcements..." 
                  className="pl-9 h-9 bg-background/60 focus-visible:ring-primary/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Tabs 
                value={filter} 
                onValueChange={(v) => setFilter(v as any)} 
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3 h-8 p-1 bg-muted/50">
                  <TabsTrigger value="all" className="text-xs rounded-sm">All</TabsTrigger>
                  <TabsTrigger value="unread" className="text-xs rounded-sm">Unread</TabsTrigger>
                  <TabsTrigger value="important" className="text-xs rounded-sm">Important</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea className="flex-1">
              <div className="flex flex-col p-2 gap-1">
                <AnimatePresence mode="popLayout">
                  {isLoading && announcements.length === 0 ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="p-4 space-y-3 border rounded-lg m-1">
                            <div className="flex justify-between items-center">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-3 w-12" />
                            </div>
                            <Skeleton className="h-3 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    ))
                  ) : filteredAnnouncements.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }} 
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground h-full min-h-[300px]"
                    >
                      <div className="bg-muted p-4 rounded-full mb-4">
                        <Inbox className="w-8 h-8 opacity-40" />
                      </div>
                      <p className="text-base font-medium text-foreground">All caught up!</p>
                      <p className="text-sm mt-1 opacity-70">No announcements match your filter.</p>
                      {filter !== 'all' && (
                        <Button variant="link" size="sm" onClick={() => setFilter('all')} className="mt-2">
                          View all announcements
                        </Button>
                      )}
                    </motion.div>
                  ) : (
                    filteredAnnouncements.map((item) => {
                       const { bg, text, icon } = getCategoryStyle(item.category);
                       const isSelected = selectedId === item.id;
                       
                       return (
                         <motion.button
                           key={item.id}
                           layoutId={isMobile ? undefined : `card-${item.id}`}
                           onClick={() => handleSelect(item)}
                           whileHover={{ scale: 0.995 }}
                           whileTap={{ scale: 0.98 }}
                           className={cn(
                             "group flex flex-col items-start gap-2.5 p-3.5 text-left rounded-lg transition-all border",
                             "hover:shadow-md hover:border-primary/20 hover:bg-background",
                             isSelected 
                               ? "bg-primary/5 border-primary/30 shadow-sm ring-1 ring-primary/10" 
                               : "bg-card border-transparent border-b-border/40 shadow-sm",
                             !item.is_read && "bg-background border-l-4 border-l-primary pl-2.5"
                           )}
                         >
                            <div className="flex items-start justify-between w-full gap-2">
                               <div className="flex items-center gap-2 min-w-0">
                                 {!item.is_read && (
                                   <span className="h-2 w-2 rounded-full bg-primary shrink-0 animate-pulse" />
                                 )}
                                 <span className={cn(
                                   "text-sm truncate leading-tight",
                                   !item.is_read ? "font-bold text-foreground" : "font-medium text-foreground/80"
                                 )}>
                                   {item.title}
                                 </span>
                               </div>
                               
                               {item.is_pinned && <Pin className="w-3.5 h-3.5 text-orange-500 shrink-0 fill-orange-500/20 rotate-45" />}
                            </div>

                            <p className="text-xs text-muted-foreground line-clamp-2 w-full leading-relaxed">
                              {item.message.replace(/[#*]/g, '').substring(0, 120)}
                            </p>

                            <div className="flex items-center justify-between w-full mt-1 pt-2 border-t border-border/20">
                               <Badge variant="outline" className={cn("text-[10px] px-2 h-5 gap-1.5 border-0 font-normal", bg, text)}>
                                  {icon}
                                  <span className="capitalize">{item.category || 'General'}</span>
                               </Badge>
                               <div className="flex items-center text-[10px] text-muted-foreground/80 font-mono gap-2">
                                  {item.priority === 'high' && (
                                    <span className="text-orange-500 font-bold">!</span>
                                  )}
                                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                               </div>
                            </div>
                         </motion.button>
                       );
                    })
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>
        )}

        {/* RIGHT PANE: Detail */}
        <AnimatePresence mode="wait">
          { (!isMobile || isMobileDetailOpen) && (
             <motion.div 
               key={selectedAnnouncement ? selectedAnnouncement.id : 'empty'}
               initial={isMobile ? { opacity: 0, x: 50 } : { opacity: 0 }}
               animate={{ opacity: 1, x: 0 }}
               exit={isMobile ? { opacity: 0, x: 50 } : { opacity: 0 }}
               transition={{ duration: 0.2 }}
               className={cn(
                 "flex flex-col overflow-hidden bg-background",
                 isMobile
                   ? "fixed inset-0 z-50 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
                   : "flex-1 border-l"
               )}
             >
               { !selectedAnnouncement ? (
                  <EmptyState />
               ) : (
                 <>
                   {/* Detail Header */}
                   <div className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 p-3 shadow-sm backdrop-blur sm:gap-3 sm:p-4">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="-ml-1 h-11 w-11 shrink-0 touch-manipulation lg:hidden" 
                        onClick={() => setIsMobileDetailOpen(false)}
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </Button>
                      
                      <div className="flex-1 min-w-0">
                         <div className="flex flex-wrap items-center gap-2 mb-1">
                            {selectedAnnouncement.is_pinned && (
                               <Badge variant="secondary" className="text-xs border-orange-200 text-orange-700 bg-orange-50 gap-1 rounded-sm shadow-none">
                                  <Pin className="w-3 h-3 fill-orange-700/20" /> Pinned
                               </Badge>
                            )}
                            <Badge 
                              variant="secondary" 
                              className={cn("text-xs font-normal border-0 rounded-sm shadow-none", getCategoryStyle(selectedAnnouncement.category).bg, getCategoryStyle(selectedAnnouncement.category).text)}
                            >
                              {selectedAnnouncement.category || 'Announcement'}
                            </Badge>
                         </div>
                      </div>

                      <div className="flex items-center gap-1">
                         <div className="text-xs text-muted-foreground mr-3 hidden sm:block">
                            {format(new Date(selectedAnnouncement.created_at), "PPP 'at' p")}
                         </div>
                         
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                 <MoreVertical className="w-4 h-4" />
                               </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                               <DropdownMenuItem onClick={() => setIsMobileDetailOpen(false)} className="lg:hidden">Close</DropdownMenuItem>
                               <DropdownMenuSeparator className="lg:hidden" />
                               <DropdownMenuItem onClick={() => {}}>Mark as Unread</DropdownMenuItem>
                            </DropdownMenuContent>
                         </DropdownMenu>
                      </div>
                   </div>

                   {/* Detail Content */}
                   <ScrollArea className="flex-1">
                      <div className="mx-auto max-w-3xl space-y-6 p-3 pb-24 sm:space-y-8 sm:p-8 sm:pb-20">
                         
                         {/* Title & Meta */}
                         <div className="space-y-6">
                            <h1 className="break-words text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl md:text-3xl">
                              {selectedAnnouncement.title}
                            </h1>
                            
                            <Card className="border-border/50 bg-muted/10 shadow-sm">
                               <CardContent className="flex items-center gap-4 p-4">
                                  <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                    <AvatarImage src={`https://ui-avatars.com/api/?name=Teacher&background=random`} />
                                    <AvatarFallback>TC</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                     <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold">Teacher</p>
                                        {selectedAnnouncement.expires_at && !isPast(new Date(selectedAnnouncement.expires_at)) && (
                                          <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200 gap-1">
                                             <Clock className="w-3 h-3" />
                                             Expires {format(new Date(selectedAnnouncement.expires_at), 'MMM d')}
                                          </Badge>
                                        )}
                                     </div>
                                     <p className="text-xs text-muted-foreground">
                                       To: <span className="font-medium text-foreground">{selectedAnnouncement.target_class_name || 'All Learner'}</span> • {selectedAnnouncement.target_grade_level || 'General'}
                                     </p>
                                  </div>
                               </CardContent>
                            </Card>
                         </div>
                         
                         <Separator />

                         {/* Main Body */}
                         <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-foreground/90 selection:bg-primary/20">
                            <RichTextDisplay content={selectedAnnouncement.message} />
                         </div>

                         {/* Footer - "Marked as Read" Indicator */}
                         <div className="flex justify-end pt-8 mt-8 border-t">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center text-primary/80 text-sm font-medium opacity-70 cursor-help">
                                     <CheckCircle2 className="w-4 h-4 mr-2" />
                                     Marked as Read
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>Item is marked as read automatically.</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                         </div>

                      </div>
                   </ScrollArea>
                 </>
               )}
             </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full text-center p-8 text-muted-foreground/50 bg-muted/5">
       <div className="w-24 h-24 bg-muted/30 rounded-full flex items-center justify-center mb-6 ring-8 ring-muted/10 animate-in zoom-in-50 duration-500">
          <Mail className="w-12 h-12 opacity-40 text-primary" />
       </div>
       <h3 className="text-xl font-semibold text-foreground mb-2">Select an announcement</h3>
       <p className="text-sm max-w-xs opacity-70 leading-relaxed">
          Select an item from the list to view full details.
       </p>
    </div>
  );
}
