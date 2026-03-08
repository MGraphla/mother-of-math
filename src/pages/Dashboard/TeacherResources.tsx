/**
 * Enhanced TeacherResources Page
 * Upload and manage learning resources with bulk upload, drag-drop, and folder organization
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  BookOpen, 
  FileText, 
  Video, 
  Link as LinkIcon, 
  Upload,
  Loader2,
  Search,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  File,
  Image as ImageIcon,
  Music,
  Folder,
  X,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Grid,
  List,
  Star,
  Eye,
  Download,
  Play
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  Resource,
  getResourcesForTeacher,
  createResource,
  updateResource,
  deleteResource,
  uploadResourceFile,
  detectFileType,
  getResourceTopics,
} from '@/services/resourceService';
import { useToast } from '@/hooks/use-toast';

type ResourceType = 'link' | 'file' | 'bulk';
type ViewMode = 'grid' | 'list';

const TOPICS = [
  'Addition',
  'Subtraction',
  'Multiplication',
  'Division',
  'Fractions',
  'Decimals',
  'Geometry',
  'Algebra',
  'Word Problems',
  'Other',
];

// Extended type for bulk upload
interface BulkFile {
  id: string;
  file: File;
  title: string;
  topic: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const TeacherResources = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [existingTopics, setExistingTopics] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form state
  const [resourceType, setResourceType] = useState<ResourceType>('file');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTopic, setFormTopic] = useState<string>('');
  const [formUrl, setFormUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Bulk upload state
  const [bulkFiles, setBulkFiles] = useState<BulkFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  
  // Preview modal state
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resourcesData, topicsData] = await Promise.all([
        getResourcesForTeacher(),
        getResourceTopics(),
      ]);
      setResources(resourcesData);
      setExistingTopics(topicsData);
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

  const resetForm = () => {
    setResourceType('file');
    setFormTitle('');
    setFormDescription('');
    setFormTopic('');
    setFormUrl('');
    setSelectedFile(null);
    setUploadProgress(0);
    setEditingResource(null);
    setBulkFiles([]);
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEdit = (resource: Resource) => {
    setResourceType(resource.url ? 'link' : 'file');
    setFormTitle(resource.title);
    setFormDescription(resource.description || '');
    setFormTopic(resource.topic || '');
    setFormUrl(resource.url || '');
    setEditingResource(resource);
    setIsCreateOpen(true);
  };

  // Single file handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!formTitle) {
        setFormTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  // Drag and drop handling
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      
      if (resourceType === 'file') {
        // Single file mode - take first file
        setSelectedFile(files[0]);
        if (!formTitle) {
          setFormTitle(files[0].name.replace(/\.[^/.]+$/, ''));
        }
      } else if (resourceType === 'bulk') {
        // Bulk mode - add all files
        addBulkFiles(files);
      }
    }
  }, [resourceType, formTitle]);

  // Bulk file handling
  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addBulkFiles(Array.from(e.target.files));
    }
  };

  const addBulkFiles = (files: File[]) => {
    const newBulkFiles: BulkFile[] = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      title: file.name.replace(/\.[^/.]+$/, ''),
      topic: formTopic || '', // Default to currently selected topic
      progress: 0,
      status: 'pending'
    }));
    
    setBulkFiles(prev => [...prev, ...newBulkFiles]);
  };

  const removeBulkFile = (id: string) => {
    setBulkFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateBulkFileTopic = (id: string, topic: string) => {
    setBulkFiles(prev => prev.map(f => f.id === id ? { ...f, topic } : f));
  };

  const updateBulkFileTitle = (id: string, title: string) => {
    setBulkFiles(prev => prev.map(f => f.id === id ? { ...f, title } : f));
  };

  const handleSubmit = async () => {
    // Handle Bulk Upload
    if (resourceType === 'bulk') {
      if (bulkFiles.length === 0) {
        toast({
          title: 'No files',
          description: 'Please add files to upload.',
          variant: 'destructive',
        });
        return;
      }

      const pendingFiles = bulkFiles.filter(f => f.status === 'pending' || f.status === 'error');
      if (pendingFiles.length === 0) {
        setIsCreateOpen(false);
        return;
      }

      setIsSubmitting(true);
      let successCount = 0;

      for (const bulkFile of pendingFiles) {
        // Update status to uploading
        setBulkFiles(prev => prev.map(f => 
          f.id === bulkFile.id ? { ...f, status: 'uploading', progress: 10 } : f
        ));

        try {
          if (!profile?.id) throw new Error("User not authenticated");
          
          // Upload file
          const fileUrl = await uploadResourceFile(bulkFile.file, profile.id);
          
          setBulkFiles(prev => prev.map(f => 
            f.id === bulkFile.id ? { ...f, progress: 80 } : f
          ));
          
          const fileType = detectFileType(bulkFile.file.name, bulkFile.file.type);

          // Create resource record
          await createResource({
            title: bulkFile.title.trim(),
            topic: bulkFile.topic || undefined,
            fileUrl: fileUrl,
            fileType: fileType as Resource['file_type'],
          });

          // Update status to success
          setBulkFiles(prev => prev.map(f => 
            f.id === bulkFile.id ? { ...f, status: 'success', progress: 100 } : f
          ));
          
          successCount++;
        } catch (e: any) {
          console.error(`Error uploading ${bulkFile.file.name}:`, e);
          // Update status to error
          setBulkFiles(prev => prev.map(f => 
            f.id === bulkFile.id ? { ...f, status: 'error', error: e.message || 'Upload failed' } : f
          ));
        }
      }

      setIsSubmitting(false);
      
      if (successCount > 0) {
        toast({ title: `Successfully uploaded ${successCount} resource(s)` });
        await fetchData();
        
        // If all succeeded, close dialog
        if (successCount === pendingFiles.length) {
          setTimeout(() => {
            setIsCreateOpen(false);
            resetForm();
          }, 1000);
        }
      }
      return;
    }

    // Handle Single File / Link
    if (!formTitle.trim()) {
      toast({
        title: 'Missing title',
        description: 'Please enter a title for the resource.',
        variant: 'destructive',
      });
      return;
    }

    if (resourceType === 'link' && !formUrl.trim()) {
      toast({
        title: 'Missing URL',
        description: 'Please enter a URL for the link.',
        variant: 'destructive',
      });
      return;
    }

    if (resourceType === 'file' && !selectedFile && !editingResource) {
      toast({
        title: 'Missing file',
        description: 'Please select a file to upload.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let fileUrl: string | undefined;
      let fileType: string = 'link';

      // Upload file if selected
      if (selectedFile && profile?.id) {
        setUploadProgress(10);
        fileUrl = await uploadResourceFile(selectedFile, profile.id);
        fileType = detectFileType(selectedFile.name, selectedFile.type);
        setUploadProgress(80);
      } else if (resourceType === 'link') {
        // Detect link type (video, etc.)
        const url = formUrl.toLowerCase();
        if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com')) {
          fileType = 'video';
        }
      }

      if (editingResource) {
        await updateResource(editingResource.id, {
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          topic: formTopic || undefined,
          fileUrl: resourceType === 'link' ? formUrl.trim() : fileUrl,
          fileType: fileType as Resource['file_type'],
        });
        toast({ title: 'Resource updated' });
      } else {
        await createResource({
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          topic: formTopic || undefined,
          fileUrl: resourceType === 'link' ? formUrl.trim() : (fileUrl || ''),
          fileType: fileType as Resource['file_type'],
        });
        toast({ title: 'Resource added' });
      }

      setUploadProgress(100);
      setIsCreateOpen(false);
      resetForm();
      await fetchData();
    } catch (e) {
      console.error('Error saving resource:', e);
      toast({
        title: 'Error',
        description: 'Failed to save resource.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this resource? This cannot be undone.')) return;

    try {
      await deleteResource(id);
      setResources(prev => prev.filter(r => r.id !== id));
      toast({ title: 'Resource deleted' });
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Failed to delete resource.',
        variant: 'destructive',
      });
    }
  };

  // Filter resources
  const filteredResources = resources
    .filter(r => {
      if (topicFilter !== 'all' && r.topic !== topicFilter) return false;
      return true;
    })
    .filter(r => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q)) ||
        (r.topic?.toLowerCase().includes(q))
      );
    });

  // Group resources by topic for folder view
  const resourcesByTopic = filteredResources.reduce((acc, resource) => {
    const topic = resource.topic || 'Uncategorized';
    if (!acc[topic]) acc[topic] = [];
    acc[topic].push(resource);
    return acc;
  }, {} as Record<string, Resource[]>);

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
    return 'text-primary bg-primary/10';
  };

  // Generate initials from title (e.g., "Algebra Basics" -> "AB")
  const getInitials = (title: string): string => {
    const words = title.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return title.substring(0, 2).toUpperCase();
  };

  // Generate a consistent color based on the title/topic
  const getPlaceholderColor = (seed: string): string => {
    const colors = [
      'bg-gradient-to-br from-violet-500 to-purple-600',
      'bg-gradient-to-br from-blue-500 to-cyan-500',
      'bg-gradient-to-br from-emerald-500 to-teal-500',
      'bg-gradient-to-br from-orange-500 to-amber-500',
      'bg-gradient-to-br from-pink-500 to-rose-500',
      'bg-gradient-to-br from-indigo-500 to-blue-600',
      'bg-gradient-to-br from-fuchsia-500 to-pink-500',
      'bg-gradient-to-br from-cyan-500 to-blue-500',
    ];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Get color class for file type icons
  const getFileTypeColor = (type: string): string => {
    switch (type) {
      case 'pdf':
      case 'document': return 'bg-red-100 text-red-600';
      case 'video': return 'bg-purple-100 text-purple-600';
      case 'image': return 'bg-blue-100 text-blue-600';
      case 'audio': return 'bg-amber-100 text-amber-600';
      case 'link': return 'bg-green-100 text-green-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  // Calculate average rating
  const getAverageRating = (r: Resource): number => {
    if (r.rating_count === 0) return 0;
    return r.rating_sum / r.rating_count;
  };

  // Render star rating
  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={cn(
              "h-3 w-3",
              i < fullStars 
                ? "fill-amber-400 text-amber-400" 
                : i === fullStars && hasHalf 
                  ? "fill-amber-400/50 text-amber-400" 
                  : "text-gray-300"
            )}
          />
        ))}
      </div>
    );
  };

  // Check if resource is previewable
  const isPreviewable = (r: Resource): boolean => {
    const type = r.file_type;
    const url = r.file_url || r.url || '';
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    return type === 'pdf' || type === 'video' || type === 'image' || isYouTube;
  };

  // Get YouTube embed URL
  const getYouTubeEmbedUrl = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (match) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
    return null;
  };

  // Stats
  const totalResources = resources.length;
  const typeStats = resources.reduce((acc, r) => {
    acc[r.file_type] = (acc[r.file_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Resource Manager</h1>
            <p className="text-sm text-muted-foreground">
              Upload and organize learning materials for your students
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/50 p-1 rounded-lg mr-2">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="h-8 px-2"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 px-2"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <UploadCloud className="h-4 w-4" />
            Upload Resources
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalResources}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{typeStats.document || 0}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Video className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{typeStats.video || 0}</p>
                <p className="text-xs text-muted-foreground">Videos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <LinkIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{typeStats.link || 0}</p>
                <p className="text-xs text-muted-foreground">Links</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Folder className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{existingTopics.length}</p>
                <p className="text-xs text-muted-foreground">Topics</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <Select value={topicFilter} onValueChange={setTopicFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-card">
            <Folder className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filter by topic" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Topics</SelectItem>
            <Separator className="my-1" />
            {existingTopics.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resources Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredResources.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">No resources found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              {searchQuery || topicFilter !== 'all' 
                ? "Try adjusting your search or filters to find what you're looking for."
                : "Upload files or add links to share learning materials with your students."}
            </p>
            {!(searchQuery || topicFilter !== 'all') && (
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Add First Resource
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'list' ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead className="hidden md:table-cell">Topic</TableHead>
                  <TableHead className="hidden sm:table-cell">Added</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResources.map((r) => {
                  const Icon = getResourceIcon(r.file_type);
                  const colorClass = getResourceColor(r.file_type);
                  return (
                    <TableRow key={r.id} className="group">
                      <TableCell>
                        {r.file_type === 'image' && (r.file_url || r.url) ? (
                          <div className="h-10 w-10 rounded-lg overflow-hidden border border-muted shrink-0">
                            <img src={r.file_url || r.url} alt={r.title} className="h-full w-full object-cover" />
                          </div>
                        ) : r.file_type === 'document' || r.file_type === 'pdf' ? (
                          <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0 relative overflow-hidden', colorClass)}>
                            {r.thumbnail_url ? (
                              <img src={r.thumbnail_url} alt={r.title} className="h-full w-full object-cover absolute inset-0 opacity-50" />
                            ) : null}
                            <Icon className="h-5 w-5 relative z-10" />
                          </div>
                        ) : (
                          <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', colorClass)}>
                            <Icon className="h-5 w-5" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium group-hover:text-primary transition-colors">{r.title}</p>
                          {r.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {r.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {r.topic ? (
                          <Badge variant="secondary" className="font-normal">{r.topic}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(r.url || r.file_url) && (
                              <DropdownMenuItem onClick={() => window.open(r.url || r.file_url, '_blank')}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openEdit(r)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(r.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        // Grid View grouped by Topic
        <div className="space-y-8">
          {Object.entries(resourcesByTopic).map(([topic, topicResources]) => (
            <div key={topic} className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Folder className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold">{topic}</h3>
                <Badge variant="secondary" className="ml-2">{topicResources.length}</Badge>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {topicResources.map((r) => {
                  const Icon = getResourceIcon(r.file_type);
                  const avgRating = getAverageRating(r);
                  const canPreview = isPreviewable(r);
                  
                  return (
                    <Card 
                      key={r.id} 
                      className="group hover:shadow-lg transition-all border-muted/60 overflow-hidden flex flex-col cursor-pointer"
                      onClick={() => canPreview && setPreviewResource(r)}
                    >
                      {/* Smart Thumbnail Area */}
                      <div className="w-full aspect-video relative overflow-hidden border-b">
                        {r.thumbnail_url ? (
                          // Show actual thumbnail if exists
                          <img 
                            src={r.thumbnail_url} 
                            alt={r.title} 
                            className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                          />
                        ) : r.file_type === 'image' && (r.file_url || r.url) ? (
                          // For images, show the image itself
                          <img 
                            src={r.file_url || r.url || ''} 
                            alt={r.title} 
                            className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                          />
                        ) : (
                          // Auto-generate colored placeholder with initials
                          <div className={cn(
                            "w-full h-full flex flex-col items-center justify-center",
                            getPlaceholderColor(r.topic || r.title)
                          )}>
                            <span className="text-3xl font-bold text-white/90 mb-1">
                              {getInitials(r.title)}
                            </span>
                            <span className="text-xs text-white/70 uppercase tracking-wider">
                              {r.file_type}
                            </span>
                          </div>
                        )}
                        
                        {/* File Type Badge */}
                        <div className={cn(
                          "absolute top-2 left-2 rounded-md p-1.5 shadow-sm flex items-center gap-1",
                          getFileTypeColor(r.file_type)
                        )}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        
                        {/* Preview Overlay */}
                        {canPreview && (
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                              {r.file_type === 'video' ? (
                                <Play className="h-7 w-7 text-white ml-1" />
                              ) : (
                                <Eye className="h-7 w-7 text-white" />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Card Content */}
                      <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                        <div className="flex-1 min-w-0 pr-2">
                          <CardTitle className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                            {r.title}
                          </CardTitle>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 -mr-2 -mt-1 shrink-0 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            {canPreview && (
                              <DropdownMenuItem onClick={() => setPreviewResource(r)}>
                                <Eye className="h-4 w-4 mr-2" /> Preview
                              </DropdownMenuItem>
                            )}
                            {(r.url || r.file_url) && (
                              <DropdownMenuItem onClick={() => window.open(r.url || r.file_url, '_blank')}>
                                <ExternalLink className="h-4 w-4 mr-2" /> Open in New Tab
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openEdit(r)}>
                              <Pencil className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(r.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardHeader>
                      
                      <CardContent className="p-4 pt-0 flex-1">
                        {r.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {r.description}
                          </p>
                        )}
                      </CardContent>
                      
                      {/* Stats Footer */}
                      <CardFooter className="p-4 pt-2 border-t bg-muted/30 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {/* Downloads */}
                          <div className="flex items-center gap-1">
                            <Download className="h-3.5 w-3.5" />
                            <span>{r.download_count || 0}</span>
                          </div>
                          
                          {/* Rating */}
                          {r.rating_count > 0 ? (
                            <div className="flex items-center gap-1">
                              {renderStars(avgRating)}
                              <span className="ml-0.5">({r.rating_count})</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-muted-foreground/60">
                              {renderStars(0)}
                            </div>
                          )}
                        </div>
                        
                        <span className="text-[10px] text-muted-foreground/70 truncate">
                          {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                        </span>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewResource} onOpenChange={(open) => !open && setPreviewResource(null)}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] p-0 overflow-hidden">
          {previewResource && (
            <>
              <DialogHeader className="p-4 pb-2 border-b">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-lg">{previewResource.title}</DialogTitle>
                    {previewResource.description && (
                      <DialogDescription className="mt-1 line-clamp-2">
                        {previewResource.description}
                      </DialogDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Stats in modal */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
                      <div className="flex items-center gap-1">
                        <Download className="h-4 w-4" />
                        <span>{previewResource.download_count || 0}</span>
                      </div>
                      {previewResource.rating_count > 0 && (
                        <div className="flex items-center gap-1">
                          {renderStars(getAverageRating(previewResource))}
                          <span>({previewResource.rating_count})</span>
                        </div>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(previewResource.file_url || previewResource.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              
              {/* Preview Content */}
              <div className="w-full bg-muted/50 flex items-center justify-center relative" style={{ height: 'calc(90vh - 120px)' }}>
                {previewResource.file_type === 'pdf' || previewResource.file_type === 'document' ? (
                  // PDF & Document Embed using Google Viewer
                  <div className="w-full h-full flex flex-col">
                    <iframe
                      src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewResource.file_url || previewResource.url || '')}&embedded=true`}
                      className="w-full flex-1 border-0"
                      title={previewResource.title}
                    />
                    <div className="bg-background border-t p-2 text-center text-xs text-muted-foreground flex justify-center gap-4">
                      <span>Having trouble viewing?</span>
                      <a 
                        href={previewResource.file_url || previewResource.url || ''} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        Download / Open Directly <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ) : previewResource.file_type === 'video' ? (
                  // Video Player
                  (() => {
                    const url = previewResource.file_url || previewResource.url || '';
                    const youtubeEmbed = getYouTubeEmbedUrl(url);
                    if (youtubeEmbed) {
                      return (
                        <iframe
                          src={youtubeEmbed}
                          className="w-full h-full border-0"
                          title={previewResource.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      );
                    }
                    return (
                      <video
                        src={url}
                        controls
                        className="max-w-full max-h-full"
                        autoPlay
                      >
                        Your browser does not support the video tag.
                      </video>
                    );
                  })()
                ) : previewResource.file_type === 'image' ? (
                  // Image Preview
                  <img
                    src={previewResource.file_url || previewResource.url || ''}
                    alt={previewResource.title}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  // Fallback
                  <div className="flex flex-col items-center justify-center text-muted-foreground p-8">
                    <File className="h-16 w-16 mb-4 opacity-50" />
                    <p className="text-sm">Preview not available for this file type</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => window.open(previewResource.file_url || previewResource.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open File
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingResource ? 'Edit Resource' : 'Upload Resources'}
            </DialogTitle>
            <DialogDescription>
              {editingResource
                ? 'Update resource details'
                : 'Upload files or add links to share with students'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Resource Type Toggle */}
            {!editingResource && (
              <Tabs value={resourceType} onValueChange={(v) => setResourceType(v as ResourceType)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="file" className="gap-2">
                    <File className="h-4 w-4" /> Single File
                  </TabsTrigger>
                  <TabsTrigger value="bulk" className="gap-2">
                    <UploadCloud className="h-4 w-4" /> Bulk Upload
                  </TabsTrigger>
                  <TabsTrigger value="link" className="gap-2">
                    <LinkIcon className="h-4 w-4" /> Web Link
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {/* Common Topic Selector (used for all types) */}
            <div className="space-y-2">
              <Label>Topic / Folder</Label>
              <Select value={formTopic} onValueChange={setFormTopic}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a topic to organize this resource" />
                </SelectTrigger>
                <SelectContent>
                  {TOPICS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Single File / Link Form */}
            {(resourceType === 'file' || resourceType === 'link') && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Resource title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional description..."
                    className="min-h-[80px]"
                  />
                </div>

                {resourceType === 'link' ? (
                  <div className="space-y-2">
                    <Label htmlFor="url">URL *</Label>
                    <Input
                      id="url"
                      type="url"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>File *</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.mp4,.mp3,.wav,.jpg,.jpeg,.png,.gif,.webp"
                    />
                    
                    <div 
                      className={cn(
                        "border-2 border-dashed rounded-lg p-6 transition-colors text-center",
                        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                        selectedFile ? "bg-muted/30 border-solid" : ""
                      )}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      {selectedFile ? (
                        <div className="flex items-center gap-3 text-left">
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <File className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
                            <UploadCloud className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium">Click to upload or drag and drop</p>
                          <p className="text-xs text-muted-foreground">PDF, Word, Video, Audio, Images (max 50MB)</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                )}
              </div>
            )}

            {/* Bulk Upload Form */}
            {resourceType === 'bulk' && !editingResource && (
              <div className="space-y-4">
                <input
                  ref={bulkFileInputRef}
                  type="file"
                  multiple
                  onChange={handleBulkFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.mp4,.mp3,.wav,.jpg,.jpeg,.png,.gif,.webp"
                />
                
                <div 
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 transition-colors text-center",
                    isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => bulkFileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-2 cursor-pointer">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                      <FolderPlus className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium">Select multiple files or drag and drop</p>
                    <p className="text-xs text-muted-foreground">Upload entire folders of content at once</p>
                  </div>
                </div>

                {bulkFiles.length > 0 && (
                  <div className="space-y-3 mt-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Files to upload ({bulkFiles.length})</h4>
                      <Button variant="ghost" size="sm" onClick={() => setBulkFiles([])} className="h-8 text-xs">
                        Clear All
                      </Button>
                    </div>
                    
                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                      {bulkFiles.map((file) => (
                        <div key={file.id} className="bg-muted/30 border rounded-lg p-3 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <File className="h-5 w-5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <Input 
                                  value={file.title} 
                                  onChange={(e) => updateBulkFileTitle(file.id, e.target.value)}
                                  className="h-7 text-sm font-medium bg-transparent border-transparent hover:border-input focus-visible:ring-1 px-1 -ml-1"
                                  disabled={file.status === 'uploading' || file.status === 'success'}
                                />
                                <p className="text-xs text-muted-foreground px-1">
                                  {(file.file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              {file.status === 'pending' && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeBulkFile(file.id)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                              {file.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                              {file.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                              {file.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Select 
                              value={file.topic} 
                              onValueChange={(v) => updateBulkFileTopic(file.id, v)}
                              disabled={file.status === 'uploading' || file.status === 'success'}
                            >
                              <SelectTrigger className="h-7 text-xs w-[140px]">
                                <SelectValue placeholder="Topic" />
                              </SelectTrigger>
                              <SelectContent>
                                {TOPICS.map((t) => (
                                  <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            
                            {file.status !== 'pending' && (
                              <div className="flex-1 flex items-center gap-2">
                                <Progress value={file.progress} className={cn("h-1.5", file.status === 'success' && "bg-green-100")} />
                                {file.error && <span className="text-[10px] text-destructive truncate">{file.error}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : resourceType === 'bulk' ? (
                <UploadCloud className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {editingResource ? 'Update' : resourceType === 'bulk' ? `Upload ${bulkFiles.filter(f => f.status === 'pending').length} Files` : 'Save Resource'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherResources;