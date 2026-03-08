/**
 * Enhanced StudentResources Page
 * Browse learning resources with favorites, recent views, and progress tracking
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
  Calendar
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
  getResourceTopics,
} from '@/services/resourceService';
import { useToast } from '@/hooks/use-toast';

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'document' | 'video' | 'link' | 'audio' | 'image';
type TabType = 'all' | 'favorites' | 'recent';

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

const StudentResources = () => {
  const [resources, setResources] = useState<EnhancedResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [topic, setTopic] = useState<string>('all');
  const [topics, setTopics] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resourcesData, topicsData] = await Promise.all([
        getResourcesForStudent(),
        getResourceTopics(),
      ]);
      
      // Load local user data (favorites, progress, history)
      const savedData = localStorage.getItem('mom_student_resources_data');
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
    localStorage.setItem('mom_student_resources_data', JSON.stringify(dataToSave));
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

  const handleOpenResource = (resource: EnhancedResource) => {
    // Update last viewed and progress
    setResources(prev => {
      const updated = prev.map(r => {
        if (r.id === resource.id) {
          // Simulate progress for demo (in real app, this would be tracked by a player/viewer component)
          const newProgress = r.file_type === 'document' || r.file_type === 'link' || r.file_type === 'image' 
            ? 100 // Mark as complete immediately for these types
            : Math.min((r.progress || 0) + 25, 100); // Increment progress for media
            
          return { 
            ...r, 
            last_viewed: Date.now(),
            progress: newProgress
          };
        }
        return r;
      });
      saveLocalData(updated);
      return updated;
    });

    // Open the resource
    if (resource.url) {
      window.open(resource.url, '_blank');
    } else if (resource.file_url) {
      window.open(resource.file_url, '_blank');
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
      // Default sort by newest
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [resources, filter, topic, searchQuery, activeTab]);

  // Stats by type (based on all resources, not filtered)
  const typeStats = useMemo(() => {
    return resources.reduce((acc, r) => {
      acc[r.file_type] = (acc[r.file_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [resources]);

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

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4 flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="mb-6 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Library</h1>
              <p className="text-sm text-muted-foreground">
                Learning materials and resources for your classes
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-8 px-2"
            >
              <Grid className="h-4 w-4 mr-1.5" />
              Grid
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 px-2"
            >
              <List className="h-4 w-4 mr-1.5" />
              List
            </Button>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="bg-card p-3 rounded-lg border shadow-sm flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search resources by title, description, or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 border-none bg-muted/50 focus-visible:ring-1"
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
                    <div className="flex items-center justify-between w-full">
                      <span>{label}</span>
                      {value !== 'all' && typeStats[value] > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">{typeStats[value]}</span>
                      )}
                    </div>
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <TabsList>
              <TabsTrigger value="all" className="gap-2">
                <BookOpen className="h-4 w-4" />
                All Resources
              </TabsTrigger>
              <TabsTrigger value="favorites" className="gap-2">
                <Star className="h-4 w-4" />
                Favorites
              </TabsTrigger>
              <TabsTrigger value="recent" className="gap-2">
                <Clock className="h-4 w-4" />
                Recent
              </TabsTrigger>
            </TabsList>
            
            <div className="text-sm text-muted-foreground hidden sm:block">
              Showing {filteredResources.length} item{filteredResources.length !== 1 ? 's' : ''}
            </div>
          </div>

          <ScrollArea className="flex-1 -mx-4 px-4">
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
                  ) : (
                    <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                  )}
                </div>
                <p className="text-lg font-medium">
                  {activeTab === 'favorites' ? 'No favorites yet' : 
                   activeTab === 'recent' ? 'No recently viewed items' : 
                   'No resources found'}
                </p>
                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                  {searchQuery || filter !== 'all' || topic !== 'all'
                    ? 'Try adjusting your search or filters to find what you\'re looking for.'
                    : activeTab === 'favorites'
                      ? 'Click the star icon on any resource to add it to your favorites for quick access.'
                      : activeTab === 'recent'
                        ? 'Items you open will appear here so you can easily pick up where you left off.'
                        : 'Your teacher hasn\'t shared any resources yet. Check back later!'}
                </p>
                {(searchQuery || filter !== 'all' || topic !== 'all') && (
                  <Button 
                    variant="outline" 
                    className="mt-6"
                    onClick={() => {
                      setSearchQuery('');
                      setFilter('all');
                      setTopic('all');
                    }}
                  >
                    Clear all filters
                  </Button>
                )}
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
                      ) : null}

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
                        {resource.progress !== undefined && resource.progress > 0 && (
                          <div className="mt-auto pt-2">
                            <div className="flex items-center justify-between text-[10px] mb-1.5">
                              <span className={isCompleted ? "text-green-600 font-medium" : "text-muted-foreground"}>
                                {isCompleted ? 'Completed' : 'In progress'}
                              </span>
                              <span className="text-muted-foreground">{resource.progress}%</span>
                            </div>
                            <Progress 
                              value={resource.progress} 
                              className={cn("h-1.5", isCompleted && "bg-green-100 dark:bg-green-900/30")} 
                            />
                          </div>
                        )}
                      </CardContent>
                      
                      <CardFooter className="p-3 px-4 bg-muted/20 border-t flex items-center justify-between mt-auto">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          {resource.last_viewed ? (
                            <>
                              <Clock className="h-3 w-3" />
                              Viewed {formatDistanceToNow(resource.last_viewed, { addSuffix: true })}
                            </>
                          ) : (
                            <>
                              <Calendar className="h-3 w-3" />
                              Added {formatDistanceToNow(new Date(resource.created_at), { addSuffix: true })}
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
                              <><Download className="h-3 w-3" /> View</>
                            )}
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            ) : (
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
                       {resource.file_type === 'image' && (resource.file_url || resource.url) ? (
                          <div className="h-12 w-12 rounded-xl overflow-hidden border shrink-0">
                            <img src={resource.file_url || resource.url} alt={resource.title} className="h-full w-full object-cover" />
                          </div>
                        ) : (resource.file_type === 'document' || resource.file_type === 'pdf') ? (
                          <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border relative overflow-hidden', colorClass)}>
                            {resource.thumbnail_url ? (
                              <img src={resource.thumbnail_url} alt={resource.title} className="h-full w-full object-cover absolute inset-0 opacity-50" />
                            ) : null}
                            <Icon className="h-6 w-6 relative z-10" />
                          </div>
                        ) : resource.file_type === 'video' ? (
                          <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border relative overflow-hidden bg-black/90', colorClass)}>
                             {resource.thumbnail_url ? (
                              <img src={resource.thumbnail_url} alt={resource.title} className="h-full w-full object-cover absolute inset-0 opacity-50" />
                            ) : null}
                            <Play className="h-5 w-5 text-white/90 relative z-10 ml-0.5" />
                          </div>
                        ) : (
                          <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border', colorClass)}>
                            <Icon className="h-6 w-6" />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          <div className="md:col-span-5 lg:col-span-6">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium truncate group-hover:text-primary transition-colors">
                                {resource.title}
                              </p>
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
                          
                          <div className="hidden md:flex md:col-span-3 lg:col-span-2 items-center">
                            {resource.topic ? (
                              <Badge variant="secondary" className="text-[10px] font-normal truncate max-w-full">
                                {resource.topic}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                          
                          <div className="hidden md:block md:col-span-4 lg:col-span-4">
                            {resource.progress !== undefined && resource.progress > 0 ? (
                              <div className="flex items-center gap-3">
                                <Progress 
                                  value={resource.progress} 
                                  className={cn("h-1.5 flex-1", isCompleted && "bg-green-100 dark:bg-green-900/30")} 
                                />
                                <span className="text-xs text-muted-foreground w-8 text-right">
                                  {resource.progress}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {resource.last_viewed 
                                  ? `Viewed ${formatDistanceToNow(resource.last_viewed, { addSuffix: true })}`
                                  : `Added ${formatDistanceToNow(new Date(resource.created_at), { addSuffix: true })}`
                                }
                              </span>
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
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={e => e.stopPropagation()}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenResource(resource); }}>
                                {resource.file_type === 'link' ? (
                                  <><ExternalLink className="h-4 w-4 mr-2" /> Open Link</>
                                ) : resource.file_type === 'video' || resource.file_type === 'audio' ? (
                                  <><Play className="h-4 w-4 mr-2" /> Play Media</>
                                ) : (
                                  <><Download className="h-4 w-4 mr-2" /> Download File</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => copyLink(e, resource)}>
                                <Share2 className="h-4 w-4 mr-2" /> Copy Link
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
};

export default StudentResources;
