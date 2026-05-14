/**
 * Enhanced StudentResources Page
 * Browse learning resources with favorites, recent views, progress tracking, AI recommendations,
 * and built-in file previews (PDF, Word, Images, Video).
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  FileText, 
  Video, 
  Link as LinkIcon, 
  Download,
  ExternalLink,
  Loader2,
  Search,
  Filter,
  Folder,
  File,
  Image as ImageIcon,
  Music,
  Play,
  Grid,
  List,
  Star,
  Clock,
  CheckCircle2,
  MoreVertical,
  Share2,
  Calendar,
  Sparkles,
  Maximize2,
  X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  Resource,
  getResourcesForStudent,
  getStudentResourceTopics,
  incrementResourceView,
  incrementResourceDownload,
} from '@/services/resourceService';
import { getStudentSession } from "@/services/studentService";
import { getStudentWorksByToken } from "@/lib/supabase";
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'document' | 'video' | 'link' | 'audio' | 'image';
type TabType = 'all' | 'recommended' | 'favorites' | 'recent';

// Extended type for local state
interface EnhancedResource extends Resource {
  is_favorite?: boolean;
  last_viewed?: number;
  progress?: number; // 0-100
}

const FILTERS: { value: FilterType; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All Types', icon: Folder },
  { value: 'document', label: 'Documents', icon: FileText },
  { value: 'video', label: 'Videos', icon: Video },
  { value: 'link', label: 'Links', icon: LinkIcon },
  { value: 'audio', label: 'Audio', icon: Music },
  { value: 'image', label: 'Images', icon: ImageIcon },
];

const parseAiFeedbackTopics = (text: string): string[] => {
  if (!text) return [];
  const topics: string[] = [];
  const lowerText = text.toLowerCase();
  // Simple heuristic: extract capitalized words in "Error Type" section or just look for common math terms
  const mathTerms = ['algebra', 'geometry', 'calculus', 'fraction', 'decimal', 'equation', 'graph', 'function', 'probability', 'statistics', 'trigonometry'];
  mathTerms.forEach(term => {
    if (lowerText.includes(term)) topics.push(term);
  });
  return topics;
};

const StudentResources = () => {
  const [resources, setResources] = useState<EnhancedResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [topic, setTopic] = useState<string>('all');
  const [topics, setTopics] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [recommendedTerms, setRecommendedTerms] = useState<Set<string>>(new Set());
  
  // Preview State
  const [previewResource, setPreviewResource] = useState<EnhancedResource | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const session = getStudentSession();
      if (!session) return;

      const [resourcesData, topicsData, worksData] = await Promise.all([
        getResourcesForStudent(),
        getStudentResourceTopics(),
        getStudentWorksByToken(session.access_token, session.full_name)
      ]);
      
      // Load local user data (favorites, progress, history)
      const savedData = localStorage.getItem(`mom_student_resources_data_${session.id}`);
      let localData: Record<string, { is_favorite?: boolean, last_viewed?: number, progress?: number }> = {};
      
      if (savedData) {
        try {
          localData = JSON.parse(savedData);
        } catch (e) {
          console.error('Failed to parse local resource data', e);
        }
      }
      
      // Enhance resources with local data
      const enhancedData = resourcesData.map(r => ({
        ...r,
        is_favorite: localData[r.id]?.is_favorite || false,
        last_viewed: localData[r.id]?.last_viewed,
        progress: localData[r.id]?.progress || 0
      }));
      
      setResources(enhancedData);
      setTopics(topicsData);

      // Analyze student works to find recommended topics
      const terms = new Set<string>();
      worksData.forEach(w => {
        if (w.subject) terms.add(w.subject.toLowerCase());
        if (w.feedback) {
           const extracted = parseAiFeedbackTopics(w.feedback);
           extracted.forEach(t => terms.add(t));
        }
      });
      setRecommendedTerms(terms);

    } catch (e) {
      console.error('Error fetching resources:', e);
      toast({
        title: 'Error',
        description: 'Failed to load resources.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveLocalData = (updatedResources: EnhancedResource[]) => {
    const session = getStudentSession();
    if (!session) return;
    
    const dataToSave: Record<string, any> = {};
    updatedResources.forEach(r => {
      if (r.is_favorite || r.last_viewed || r.progress) {
        dataToSave[r.id] = {
          is_favorite: r.is_favorite,
          last_viewed: r.last_viewed,
          progress: r.progress
        };
      }
    });
    localStorage.setItem(`mom_student_resources_data_${session.id}`, JSON.stringify(dataToSave));
  };

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    setResources(prev => {
      const updated = prev.map(r => 
        r.id === id ? { ...r, is_favorite: !r.is_favorite } : r
      );
      saveLocalData(updated);
      
      const isFavoriting = updated.find(r => r.id === id)?.is_favorite;
      toast({
        title: isFavoriting ? 'Added to favorites' : 'Removed from favorites',
        duration: 2000,
      });
      
      return updated;
    });
  };

  const updateProgress = (id: string, newProgress: number) => {
    setResources(prev => {
      const updated = prev.map(r => 
        r.id === id ? { ...r, progress: Math.min(newProgress, 100) } : r
      );
      saveLocalData(updated);
      return updated;
    });
  };

  const handleOpenResource = (resource: EnhancedResource) => {
    // 1. Update last viewed and progress
    setResources(prev => {
      const updated = prev.map(r => {
        if (r.id === resource.id) {
          return { 
            ...r, 
            last_viewed: Date.now(),
            // Auto-complete simple types on open
            progress: (r.file_type === 'document' || r.file_type === 'link' || r.file_type === 'image') && r.progress !== 100 ? 100 : r.progress
          };
        }
        return r;
      });
      saveLocalData(updated);
      return updated;
    });

    // 2. Determine if we can preview it in-app
    const fileUrl = resource.file_url || resource.url;
    if (!fileUrl) return;

    // Check if it's a file type we can preview
    const isImage = resource.file_type === 'image';
    const isVideo = resource.file_type === 'video';
    const isPdf = resource.file_type === 'pdf' || (resource.file_type === 'document' && fileUrl.toLowerCase().endsWith('.pdf'));
    const isOffice = resource.file_type === 'document' && (
      fileUrl.toLowerCase().endsWith('.docx') || 
      fileUrl.toLowerCase().endsWith('.doc') || 
      fileUrl.toLowerCase().endsWith('.pptx') || 
      fileUrl.toLowerCase().endsWith('.ppt') || 
      fileUrl.toLowerCase().endsWith('.xlsx')
    );
    // Youtube link check (basic)
    const isYoutube = resource.file_type === 'video' && (fileUrl.includes('youtube.com') || fileUrl.includes('youtu.be'));

    if (isImage || isVideo || isPdf || isOffice || isYoutube) {
      void incrementResourceView(resource.id);
      setPreviewResource(resource);
    } else {
      void incrementResourceDownload(resource.id);
      window.open(fileUrl, '_blank');
    }
  };

  const copyLink = (e: React.MouseEvent, resource: EnhancedResource) => {
    e.stopPropagation();
    const link = resource.url || resource.file_url;
    if (link) {
      navigator.clipboard.writeText(link);
      toast({ title: 'Link copied to clipboard' });
    }
  };

  // Filter and sort resources
  const filteredResources = useMemo(() => {
    let result = resources
      .filter(r => {
        // Tab filters
        if (activeTab === 'favorites' && !r.is_favorite) return false;
        if (activeTab === 'recent' && !r.last_viewed) return false;
        if (activeTab === 'recommended') {
          if (!r.topic && !r.title) return false;
          const content = ((r.topic || '') + ' ' + (r.title || '')).toLowerCase();
          let isRecommended = false;
          recommendedTerms.forEach(term => {
             if (content.includes(term)) isRecommended = true;
          });
          return isRecommended;
        }

        // Type and topic filters
        if (filter !== 'all' && r.file_type !== filter) return false;
        if (topic !== 'all' && r.topic !== topic) return false;
        return true;
      })
      .filter(r => {
        // Search filter
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          (r.description?.toLowerCase().includes(q)) ||
          (r.topic?.toLowerCase().includes(q))
        );
      });

    // Sort based on active tab
    if (activeTab === 'recent') {
      result.sort((a, b) => (b.last_viewed || 0) - (a.last_viewed || 0));
    } else {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [resources, filter, topic, searchQuery, activeTab, recommendedTerms]);

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'document': return FileText;
      case 'video': return Video;
      case 'link': return LinkIcon;
      case 'audio': return Music;
      case 'image': return ImageIcon;
      default: return File;
    }
  };

  const getResourceColor = (type: string) => {
    return 'text-primary bg-primary/10 border-primary/20';
  };

  // --------------------------------------------------------------------------
  // Preview Rendering Logic
  // --------------------------------------------------------------------------
  const renderPreviewContent = (resource: EnhancedResource) => {
    const url = resource.file_url || resource.url;
    if (!url) return <div className="p-8 text-center">No URL found</div>;

    const lowerUrl = url.toLowerCase();

    // 1. PDF
    if (resource.file_type === 'pdf' || lowerUrl.endsWith('.pdf')) {
       return (
         <iframe 
           src={url} 
           className="w-full h-[80vh] rounded-md border-0 bg-white"
           title="PDF Preview"
         />
       );
    }
    
    // 2. Office Documents (Word, PPT, Excel)
    if (resource.file_type === 'document' || 
        lowerUrl.endsWith('.doc') || lowerUrl.endsWith('.docx') || 
        lowerUrl.endsWith('.ppt') || lowerUrl.endsWith('.pptx') || 
        lowerUrl.endsWith('.xlsx')) {
       // Use Microsoft Office Online Viewer
       const encodedUrl = encodeURIComponent(url);
       return (
         <iframe 
           src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`}
           className="w-full h-[80vh] rounded-md border-0 bg-white"
           title="Document Preview"
         />
       );
    }

    // 3. Images
    if (resource.file_type === 'image') {
       return (
         <div className="flex items-center justify-center bg-black/5 h-[80vh] rounded-md overflow-hidden">
            <img src={url} alt={resource.title} className="max-w-full max-h-full object-contain" />
         </div>
       );
    }

    // 4. Video / Audio
    if (resource.file_type === 'video') {
       if (url.includes('youtube.com') || url.includes('youtu.be')) {
          // Extract video ID (naive impl)
          let videoId = '';
          if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
          else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1];
          
          if (videoId) {
            return (
              <iframe 
                src={`https://www.youtube.com/embed/${videoId}`}
                className="w-full h-[80vh] rounded-md border-0"
                allowFullScreen
                title="Video Preview"
              />
            );
          }
       }
       return (
         <div className="flex items-center justify-center bg-black h-[80vh] rounded-md">
            <video src={url} controls className="max-w-full max-h-full" />
         </div>
       );
    }

    if (resource.file_type === 'audio') {
      return (
        <div className="flex items-center justify-center bg-muted h-[40vh] rounded-md p-10">
           <audio src={url} controls className="w-full max-w-lg" />
        </div>
      );
   }

    // Fallback
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <FileText className="h-16 w-16 text-muted-foreground/30" />
        <p>Preview not available for this file type.</p>
        <Button
          onClick={() => {
            void incrementResourceDownload(resource.id);
            window.open(url, '_blank');
          }}
        >
          <ExternalLink className="mr-2 h-4 w-4" /> 
          Open in New Tab
        </Button>
      </div>
    );
  };


  return (
    <div className="container mx-auto flex min-h-0 w-full min-w-0 max-w-6xl flex-1 flex-col px-2 py-3 xs:px-3 sm:px-4 sm:py-6 max-h-[min(100%,calc(100dvh-4rem))] sm:max-h-none">
      {/* Header */}
      <div className="mb-3 shrink-0 sm:mb-6">
        <div className="relative mb-3 overflow-x-hidden rounded-xl bg-primary px-3 py-4 text-primary-foreground shadow-lg sm:mb-6 sm:rounded-2xl sm:px-5 sm:py-6">
          <div className="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/10" />
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/20 sm:h-12 sm:w-12">
                <BookOpen className="h-5 w-5 text-primary-foreground sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/70">Study materials</p>
                <h1 className="mt-0.5 text-lg font-bold tracking-tight sm:text-2xl leading-tight">Resource library</h1>
                <p className="mt-1 max-w-xl text-xs text-primary-foreground/85 sm:text-sm hidden sm:block">
                  Open files your teacher shared, watch videos, and download what you need. Use search and filters below.
                </p>
              </div>
            </div>
          
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/15 p-1 sm:gap-2">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className={cn("h-9 min-h-9 touch-manipulation px-2 sm:h-8", viewMode === 'grid' ? "bg-white text-primary" : "text-primary-foreground hover:bg-white/10")}
            >
              <Grid className="mr-1.5 h-4 w-4" />
              <span className="hidden xs:inline">Grid</span>
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={cn("h-9 min-h-9 touch-manipulation px-2 sm:h-8", viewMode === 'list' ? "bg-white text-primary" : "text-primary-foreground hover:bg-white/10")}
            >
              <List className="mr-1.5 h-4 w-4" />
              <span className="hidden xs:inline">List</span>
            </Button>
          </div>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-2 shadow-sm sm:p-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search title, topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-10 border-none bg-muted/50 pl-9 focus-visible:ring-1 sm:min-h-9 sm:placeholder:text-muted-foreground"
            />
          </div>
          
          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <SelectTrigger className="w-full sm:w-[160px] border-none bg-muted/50">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {FILTERS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    <span>{label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger className="w-full sm:w-[160px] border-none bg-muted/50">
                <Folder className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Topic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Topics</SelectItem>
                {topics.length > 0 && <Separator className="my-1" />}
                {topics.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2 overflow-x-auto pb-2 sm:mb-4 [-webkit-overflow-scrolling:touch]">
            <TabsList className="inline-flex h-auto min-h-10 w-max max-w-full flex-nowrap justify-start gap-1 overflow-x-auto p-1">
              <TabsTrigger value="all" className="shrink-0 gap-1.5 px-3 py-2 text-xs sm:gap-2 sm:text-sm">
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                All
              </TabsTrigger>
              <TabsTrigger value="recommended" className="shrink-0 gap-1.5 px-3 py-2 text-xs sm:gap-2 sm:text-sm">
                <Sparkles className="h-3.5 w-3.5 text-amber-500 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">For You</span>
                <span className="xs:hidden">You</span>
              </TabsTrigger>
              <TabsTrigger value="favorites" className="shrink-0 gap-1.5 px-3 py-2 text-xs sm:gap-2 sm:text-sm">
                <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="sm:hidden">Favs</span>
                <span className="hidden sm:inline">Favorites</span>
              </TabsTrigger>
              <TabsTrigger value="recent" className="shrink-0 gap-1.5 px-3 py-2 text-xs sm:gap-2 sm:text-sm">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Recent
              </TabsTrigger>
            </TabsList>
            
            <div className="text-sm text-muted-foreground hidden lg:block">
              Showing {filteredResources.length} item{filteredResources.length !== 1 ? 's' : ''}
            </div>
          </div>

          <ScrollArea className="-mx-2 flex-1 px-2 sm:-mx-4 sm:px-4 [&>[data-radix-scroll-area-viewport]]:pb-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading your library...</p>
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                  {activeTab === 'favorites' ? (
                    <Star className="h-10 w-10 text-muted-foreground/40" />
                  ) : activeTab === 'recent' ? (
                    <Clock className="h-10 w-10 text-muted-foreground/40" />
                  ) : activeTab === 'recommended' ? (
                    <Sparkles className="h-10 w-10 text-muted-foreground/40" />
                  ) : (
                    <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                  )}
                </div>
                <p className="text-lg font-medium">
                  {activeTab === 'favorites' ? 'No favorites yet' : 
                   activeTab === 'recent' ? 'No recently viewed items' : 
                   activeTab === 'recommended' ? 'No specific recommendations yet' :
                   'No resources found'}
                </p>
                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                   {activeTab === 'recommended' ? "Complete more assignments to get personalized recommendations here." : 
                    "Try adjusting your filters or search terms."}
                </p>
                <Button 
                   variant="outline" 
                   className="mt-6"
                   onClick={() => {
                      setSearchQuery('');
                      setFilter('all');
                      setTopic('all');
                      setActiveTab('all');
                   }}
                 >
                   Clear filters
                 </Button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
                {filteredResources.map((resource) => {
                  const Icon = getResourceIcon(resource.file_type);
                  const colorClass = getResourceColor(resource.file_type);
                  const isCompleted = resource.progress === 100;
                  
                  const hasPreview = (resource.file_type === 'image' && (resource.file_url || resource.url)) || 
                                     ((resource.file_type === 'document' || resource.file_type === 'pdf' || resource.file_type === 'video') && resource.thumbnail_url);

                  return (
                    <Card
                      key={resource.id}
                      className="group cursor-pointer hover:shadow-md transition-all duration-200 flex flex-col h-full border-muted/60 hover:border-primary/30 overflow-hidden"
                      onClick={() => handleOpenResource(resource)}
                    >
                      {resource.file_type === 'image' && (resource.file_url || resource.url) ? (
                        <div className="w-full aspect-video bg-muted relative overflow-hidden border-b">
                          <img src={resource.file_url || resource.url} alt={resource.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          <div className="absolute top-2 right-2 z-10">
                            <button 
                              onClick={(e) => toggleFavorite(e, resource.id)}
                              className={cn(
                                "p-1.5 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm transition-all",
                                resource.is_favorite ? "opacity-100" : "opacity-0 group-hover:opacity-100 hover:bg-muted"
                              )}
                            >
                              <Star className={cn(
                                "h-3.5 w-3.5", 
                                resource.is_favorite ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground"
                              )} />
                            </button>
                          </div>
                        </div>
                      ) : (resource.file_type === 'document' || resource.file_type === 'pdf') ? (
                        <div className={cn("w-full aspect-video relative overflow-hidden border-b flex items-center justify-center", colorClass)}>
                          {resource.thumbnail_url ? (
                            <img src={resource.thumbnail_url} alt={resource.title} className="w-full h-full object-cover absolute inset-0 opacity-40 transition-transform group-hover:scale-105" />
                          ) : null}
                          <Icon className="h-12 w-12 relative z-10 opacity-80" />
                          <div className="absolute top-2 right-2 z-10">
                            <button 
                              onClick={(e) => toggleFavorite(e, resource.id)}
                              className={cn(
                                "p-1.5 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm transition-all",
                                resource.is_favorite ? "opacity-100" : "opacity-0 group-hover:opacity-100 hover:bg-muted"
                              )}
                            >
                              <Star className={cn(
                                "h-3.5 w-3.5", 
                                resource.is_favorite ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground"
                              )} />
                            </button>
                          </div>
                        </div>
                      ) : resource.file_type === 'video' ? (
                        <div className="w-full aspect-video bg-black/90 relative overflow-hidden border-b flex items-center justify-center">
                          {resource.thumbnail_url ? (
                            <img src={resource.thumbnail_url} alt={resource.title} className="w-full h-full object-cover absolute inset-0 opacity-50 transition-transform group-hover:scale-105" />
                          ) : null}
                          <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center relative z-10">
                            <Icon className="h-6 w-6 text-white ml-1" />
                          </div>
                          <div className="absolute top-2 right-2 z-10">
                            <button 
                              onClick={(e) => toggleFavorite(e, resource.id)}
                              className={cn(
                                "p-1.5 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm transition-all",
                                resource.is_favorite ? "opacity-100" : "opacity-0 group-hover:opacity-100 hover:bg-muted"
                              )}
                            >
                              <Star className={cn(
                                "h-3.5 w-3.5", 
                                resource.is_favorite ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground"
                              )} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={cn("w-full aspect-video relative overflow-hidden border-b flex items-center justify-center", colorClass)}>
                          <Icon className="h-12 w-12 relative z-10 opacity-80" />
                           <div className="absolute top-2 right-2 z-10">
                            <button 
                              onClick={(e) => toggleFavorite(e, resource.id)}
                              className={cn(
                                "p-1.5 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm transition-all",
                                resource.is_favorite ? "opacity-100" : "opacity-0 group-hover:opacity-100 hover:bg-muted"
                              )}
                            >
                              <Star className={cn(
                                "h-3.5 w-3.5", 
                                resource.is_favorite ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground"
                              )} />
                            </button>
                          </div>
                        </div>
                      )}

                      <CardHeader className={cn("p-4 pb-3 relative", hasPreview ? "pt-3" : "")}>
                        {!hasPreview && (
                          <div className="absolute top-3 right-3 z-10 flex gap-1">
                            <button 
                              onClick={(e) => toggleFavorite(e, resource.id)}
                              className={cn(
                                "p-1.5 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm transition-all",
                                resource.is_favorite ? "opacity-100" : "opacity-0 group-hover:opacity-100 hover:bg-muted"
                              )}
                            >
                              <Star className={cn(
                                "h-3.5 w-3.5", 
                                resource.is_favorite ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground"
                              )} />
                            </button>
                          </div>
                        )}
                        
                        <div className="flex items-start gap-3">
                          {!hasPreview && (
                            <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border', colorClass)}>
                              <Icon className="h-6 w-6" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 pt-1">
                            {resource.topic && (
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 truncate">
                                {resource.topic}
                              </p>
                            )}
                            <CardTitle className="text-sm font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                              {resource.title}
                            </CardTitle>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="p-4 pt-0 flex-1 flex flex-col">
                        {resource.description ? (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">
                            {resource.description}
                          </p>
                        ) : (
                          <div className="flex-1" />
                        )}
                        
                        {/* Progress indicator */}
                        {resource.progress !== undefined && (
                          <div className="mt-auto pt-2 space-y-1.5">
                             <div className="flex items-center justify-between text-[10px]">
                               <span className={cn(isCompleted ? "text-green-600 font-medium" : "text-muted-foreground")}>
                                 {isCompleted ? 'Completed' : 'Status'}
                               </span>
                               <span className="text-muted-foreground">{resource.progress}%</span>
                             </div>
                             <Progress 
                               value={resource.progress} 
                               className={cn("h-1.5", isCompleted && "bg-green-100")} 
                               indicatorClassName={cn(isCompleted && "bg-green-500")}
                             />
                             {/* Manual toggle for completeness */}
                             {!isCompleted && (
                               <Button 
                                 variant="outline" 
                                 size="sm" 
                                 className="w-full h-6 text-[10px] mt-1"
                                 onClick={(e) => { e.stopPropagation(); updateProgress(resource.id, 100); }}
                               >
                                 Mark as Done
                               </Button>
                             )}
                          </div>
                        )}
                      </CardContent>
                      
                      <CardFooter className="p-3 px-4 bg-muted/20 border-t flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          {resource.last_viewed ? (
                            <>
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(resource.last_viewed, { addSuffix: true })}
                            </>
                          ) : (
                            <>
                              <Calendar className="h-3 w-3" />
                              {formatDistanceToNow(new Date(resource.created_at), { addSuffix: true })}
                            </>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={(e) => copyLink(e, resource)}
                                >
                                  <Share2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy link</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <Button 
                            variant="default" 
                            size="sm" 
                            className="h-7 text-xs px-2.5 gap-1.5 shadow-sm"
                          >
                            {resource.file_type === 'link' ? (
                              <><ExternalLink className="h-3 w-3" /> Open</>
                            ) : resource.file_type === 'video' || resource.file_type === 'audio' ? (
                              <><Play className="h-3 w-3" /> Play</>
                            ) : (
                              <><Maximize2 className="h-3 w-3" /> View</>
                            )}
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            ) : (
              // List View
              <div className="bg-card border rounded-lg shadow-sm overflow-hidden mb-6">
                <div className="divide-y">
                  {filteredResources.map((resource) => {
                    const Icon = getResourceIcon(resource.file_type);
                    const colorClass = getResourceColor(resource.file_type);
                    const isCompleted = resource.progress === 100;
                    
                    return (
                      <div
                        key={resource.id}
                        className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors group"
                        onClick={() => handleOpenResource(resource)}
                      >
                       <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border', colorClass)}>
                          <Icon className="h-6 w-6" />
                        </div>
                        
                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          <div className="md:col-span-12 lg:col-span-5">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium truncate group-hover:text-primary transition-colors">
                                {resource.title}
                              </p>
                              {activeTab === 'recommended' && (
                                <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-amber-100 text-amber-700 hover:bg-amber-100/80">Recommended</Badge>
                              )}
                              {isCompleted && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                              )}
                            </div>
                            {resource.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {resource.description}
                              </p>
                            )}
                          </div>
                          
                          <div className="hidden lg:flex lg:col-span-3 items-center">
                            {resource.topic ? (
                              <Badge variant="secondary" className="text-[10px] font-normal truncate max-w-full">
                                {resource.topic}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            onClick={(e) => toggleFavorite(e, resource.id)}
                            className={cn(
                              "p-2 rounded-full transition-all",
                              resource.is_favorite ? "opacity-100" : "opacity-0 group-hover:opacity-100 hover:bg-muted"
                            )}
                          >
                            <Star className={cn(
                              "h-4 w-4", 
                              resource.is_favorite ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground"
                            )} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </ScrollArea>
        </Tabs>

        {/* Preview Dialog */}
        <Dialog open={!!previewResource} onOpenChange={(open) => !open && setPreviewResource(null)}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
             
             {/* Header */}
             <div className="flex items-center justify-between p-4 px-6 border-b bg-muted/20">
               <div className="flex items-center gap-3 overflow-hidden">
                 <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border bg-background")}>
                    {previewResource && (
                       (() => {
                          const Icon = getResourceIcon(previewResource.file_type); 
                          return <Icon className="h-5 w-5 text-primary" />;
                       })()
                    )}
                 </div>
                 <div className="min-w-0">
                    <h3 className="text-base font-semibold truncate leading-tight">{previewResource?.title}</h3>
                    <p className="text-xs text-muted-foreground truncate max-w-[300px]">{previewResource?.description || previewResource?.topic}</p>
                 </div>
               </div>
               
               <div className="flex items-center gap-2">
                 {previewResource?.url || previewResource?.file_url ? (
                   <Button
                     size="sm"
                     variant="outline"
                     onClick={() => {
                       if (!previewResource) return;
                       void incrementResourceDownload(previewResource.id);
                       window.open(previewResource.url || previewResource.file_url!, '_blank');
                     }}
                   >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                   </Button>
                 ) : null}
               </div>
             </div>

             {/* Content */}
             <div className="flex-1 bg-muted/10 p-4 md:p-6 overflow-hidden flex flex-col">
                {previewResource && renderPreviewContent(previewResource)}
             </div>

          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default StudentResources;
