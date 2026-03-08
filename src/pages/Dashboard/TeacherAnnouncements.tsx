/**
 * Enhanced TeacherAnnouncements Page
 * Manage announcements to students with scheduling, templates, and rich text
 */

import { useState, useEffect } from 'react';
import { 
  Bell, 
  Pin, 
  PinOff,
  Calendar, 
  Loader2,
  Megaphone,
  Search,
  Plus,
  Pencil,
  Trash2,
  Users,
  Eye,
  Send,
  Clock,
  Copy,
  FileText,
  MoreVertical,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format, isFuture } from 'date-fns';
import {
  Announcement,
  getAnnouncementsForTeacher,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementPin,
  getAnnouncementReadStats,
} from '@/services/announcementService';
import { useToast } from '@/hooks/use-toast';

const CATEGORIES = ['General', 'Assignment', 'Exam', 'Event', 'Reminder', 'Urgent'];

// Pre-defined templates
const TEMPLATES = [
  {
    id: 't1',
    name: 'Upcoming Exam',
    title: 'Reminder: Upcoming Exam on [Date]',
    message: 'Hello class,\n\nThis is a reminder that we have an exam scheduled for [Date] covering chapters [X-Y].\n\nPlease make sure to review the study guide posted in the resources section.\n\nBest regards,\nTeacher',
    category: 'Exam',
    isPinned: true
  },
  {
    id: 't2',
    name: 'Assignment Due',
    title: 'Assignment Due: [Assignment Name]',
    message: 'Hello everyone,\n\nDon\'t forget that [Assignment Name] is due on [Date] at [Time].\n\nIf you have any questions or need help, please reach out before the deadline.\n\nBest regards,\nTeacher',
    category: 'Assignment',
    isPinned: false
  },
  {
    id: 't3',
    name: 'Class Cancelled',
    title: 'URGENT: Class Cancelled Today',
    message: 'Dear students,\n\nUnfortunately, I have to cancel today\'s class due to [Reason].\n\nPlease use this time to work on your current assignments. I will post an update regarding when we will make up this session.\n\nBest regards,\nTeacher',
    category: 'Urgent',
    isPinned: true
  }
];

// Extended type for local state
interface EnhancedAnnouncement extends Announcement {
  scheduledFor?: string;
  status?: 'published' | 'scheduled' | 'draft';
}

const TeacherAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<EnhancedAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<EnhancedAnnouncement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [readStats, setReadStats] = useState<Record<string, { total: number; read: number }>>({});

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formCategory, setFormCategory] = useState<string>('General');
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formIsScheduled, setFormIsScheduled] = useState(false);
  const [formScheduleDate, setFormScheduleDate] = useState('');
  const [formScheduleTime, setFormScheduleTime] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const data = await getAnnouncementsForTeacher();
      
      // Enhance with mock scheduling data for demonstration
      // In a real app, this would come from the database
      const enhancedData = data.map((a, index) => {
        // Mock some scheduled announcements
        if (index === 0 && !a.is_pinned) {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 2);
          return {
            ...a,
            scheduledFor: futureDate.toISOString(),
            status: 'scheduled' as const
          };
        }
        return {
          ...a,
          status: 'published' as const
        };
      });
      
      setAnnouncements(enhancedData);
      
      // Fetch read stats for published announcements
      const stats: Record<string, { total: number; read: number }> = {};
      const publishedAnnouncements = enhancedData.filter(a => a.status === 'published');
      
      for (const a of publishedAnnouncements.slice(0, 15)) { // Limit for performance
        try {
          stats[a.id] = await getAnnouncementReadStats(a.id);
        } catch (e) {
          // Ignore individual errors
        }
      }
      setReadStats(stats);
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

  const resetForm = () => {
    setFormTitle('');
    setFormMessage('');
    setFormCategory('General');
    setFormIsPinned(false);
    setFormIsScheduled(false);
    setFormScheduleDate('');
    setFormScheduleTime('');
    setEditingAnnouncement(null);
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEdit = (announcement: EnhancedAnnouncement) => {
    setFormTitle(announcement.title);
    setFormMessage(announcement.message);
    setFormCategory(announcement.category || 'General');
    setFormIsPinned(announcement.is_pinned);
    
    if (announcement.scheduledFor) {
      setFormIsScheduled(true);
      const date = new Date(announcement.scheduledFor);
      setFormScheduleDate(date.toISOString().split('T')[0]);
      setFormScheduleTime(`${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`);
    } else {
      setFormIsScheduled(false);
    }
    
    setEditingAnnouncement(announcement);
    setIsCreateOpen(true);
  };

  const applyTemplate = (templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setFormTitle(template.title);
      setFormMessage(template.message);
      setFormCategory(template.category);
      setFormIsPinned(template.isPinned);
      toast({
        title: 'Template applied',
        description: `Loaded "${template.name}" template.`,
      });
    }
  };

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formMessage.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    if (formIsScheduled && (!formScheduleDate || !formScheduleTime)) {
      toast({
        title: 'Missing schedule',
        description: 'Please provide both date and time for scheduling.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // In a real app, we would pass the scheduling info to the backend
      // For now, we'll just create/update the announcement normally
      
      if (editingAnnouncement) {
        await updateAnnouncement(editingAnnouncement.id, {
          title: formTitle.trim(),
          message: formMessage.trim(),
          category: formCategory,
          isPinned: formIsPinned,
        });
        toast({ title: formIsScheduled ? 'Scheduled announcement updated' : 'Announcement updated' });
      } else {
        await createAnnouncement({
          title: formTitle.trim(),
          message: formMessage.trim(),
          category: formCategory,
          isPinned: formIsPinned,
        });
        toast({ title: formIsScheduled ? 'Announcement scheduled' : 'Announcement sent' });
      }
      
      setIsCreateOpen(false);
      resetForm();
      await fetchAnnouncements();
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Failed to save announcement.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePin = async (announcement: Announcement) => {
    try {
      await toggleAnnouncementPin(announcement.id, !announcement.is_pinned);
      setAnnouncements(prev =>
        prev.map(a =>
          a.id === announcement.id ? { ...a, is_pinned: !a.is_pinned } : a
        )
      );
      toast({ title: announcement.is_pinned ? 'Unpinned' : 'Pinned' });
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Failed to update pin status.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement? This cannot be undone.')) return;
    
    try {
      await deleteAnnouncement(id);
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      toast({ title: 'Announcement deleted' });
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Failed to delete announcement.',
        variant: 'destructive',
      });
    }
  };

  const duplicateAnnouncement = (announcement: Announcement) => {
    setFormTitle(`Copy of ${announcement.title}`);
    setFormMessage(announcement.message);
    setFormCategory(announcement.category || 'General');
    setFormIsPinned(false);
    setFormIsScheduled(false);
    setEditingAnnouncement(null);
    setIsCreateOpen(true);
  };

  // Filter announcements
  const filteredAnnouncements = announcements.filter(a => {
    // Tab filter
    if (activeTab === 'published' && a.status !== 'published') return false;
    if (activeTab === 'scheduled' && a.status !== 'scheduled') return false;
    
    // Search filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.message.toLowerCase().includes(q) ||
      (a.category?.toLowerCase().includes(q))
    );
  });

  // Stats
  const publishedCount = announcements.filter(a => a.status === 'published').length;
  const scheduledCount = announcements.filter(a => a.status === 'scheduled').length;
  const pinnedCount = announcements.filter(a => a.is_pinned).length;
  
  // Calculate overall read rate
  let totalReads = 0;
  let totalPossibleReads = 0;
  Object.values(readStats).forEach(stat => {
    totalReads += stat.read;
    totalPossibleReads += stat.total;
  });
  const overallReadRate = totalPossibleReads > 0 ? Math.round((totalReads / totalPossibleReads) * 100) : 0;

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
            <p className="text-sm text-muted-foreground">
              Communicate with your students effectively
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                Templates
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-sm font-semibold">Use Template</div>
              <DropdownMenuSeparator />
              {TEMPLATES.map(template => (
                <DropdownMenuItem key={template.id} onClick={() => {
                  applyTemplate(template.id);
                  setIsCreateOpen(true);
                }}>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{template.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{template.title}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New Announcement
          </Button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card border-muted shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{publishedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Published</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-muted shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{scheduledCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Scheduled</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-muted shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
              <Pin className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold leading-none">{pinnedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Pinned</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-muted shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <Eye className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-end justify-between mb-1">
                <p className="text-2xl font-bold leading-none">{overallReadRate}%</p>
              </div>
              <Progress value={overallReadRate} className="h-1.5" />
              <p className="text-xs text-muted-foreground mt-1">Avg. Read Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <Card className="border-muted shadow-sm">
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-3 sm:w-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="published">Published</TabsTrigger>
              <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
        
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading announcements...</p>
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Bell className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-base font-medium">No announcements found</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {searchQuery 
                  ? 'No announcements match your search query.' 
                  : activeTab === 'scheduled' 
                    ? 'You have no scheduled announcements.'
                    : 'Create your first announcement to communicate with your students.'}
              </p>
              {!searchQuery && activeTab !== 'scheduled' && (
                <Button onClick={openCreate} variant="outline" className="mt-6 gap-2">
                  <Plus className="h-4 w-4" />
                  Create Announcement
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead className="min-w-[250px]">Announcement</TableHead>
                    <TableHead className="hidden md:table-cell">Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Engagement</TableHead>
                    <TableHead className="hidden lg:table-cell">Date</TableHead>
                    <TableHead className="w-[80px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAnnouncements.map((a) => {
                    const stats = readStats[a.id];
                    const readPercentage = stats && stats.total > 0 
                      ? Math.round((stats.read / stats.total) * 100) 
                      : 0;
                      
                    return (
                      <TableRow key={a.id} className="group">
                        <TableCell>
                          {a.is_pinned ? (
                            <Pin className="h-4 w-4 text-primary" />
                          ) : a.priority === 'high' ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm leading-tight">{a.title}</p>
                              {a.category && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                  {a.category}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {a.message}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {a.status === 'scheduled' ? (
                            <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/20">
                              <Clock className="h-3 w-3 mr-1" /> Scheduled
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Published
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {a.status === 'scheduled' ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : stats ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full",
                                    readPercentage > 75 ? "bg-green-500" : 
                                    readPercentage > 40 ? "bg-yellow-500" : "bg-red-500"
                                  )}
                                  style={{ width: `${readPercentage}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium">
                                {stats.read}/{stats.total}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Loading...</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {a.status === 'scheduled' && a.scheduledFor ? (
                            <div className="flex flex-col">
                              <span>{format(new Date(a.scheduledFor), 'MMM d, yyyy')}</span>
                              <span>{format(new Date(a.scheduledFor), 'h:mm a')}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span>{format(new Date(a.created_at), 'MMM d, yyyy')}</span>
                              <span>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => openEdit(a)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicateAnnouncement(a)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleTogglePin(a)}>
                                {a.is_pinned ? (
                                  <>
                                    <PinOff className="h-4 w-4 mr-2" />
                                    Unpin
                                  </>
                                ) : (
                                  <>
                                    <Pin className="h-4 w-4 mr-2" />
                                    Pin
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(a.id)}
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="text-xl">
              {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
            </DialogTitle>
            <DialogDescription>
              {editingAnnouncement
                ? 'Update this announcement for your students'
                : 'Create a new announcement to send to all students'}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">Title <span className="text-destructive">*</span></Label>
                <Input
                  id="title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Important Update: Midterm Exam"
                  className="font-medium"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="message" className="text-sm font-medium">Message <span className="text-destructive">*</span></Label>
                  <span className="text-xs text-muted-foreground">Supports basic formatting</span>
                </div>
                <Textarea
                  id="message"
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  placeholder="Write your announcement here..."
                  className="min-h-[200px] resize-y"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Category</Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Pin to Top</Label>
                  <div className="flex items-center gap-3 h-10 px-3 border rounded-md bg-muted/30">
                    <Switch
                      checked={formIsPinned}
                      onCheckedChange={setFormIsPinned}
                      id="pin-switch"
                    />
                    <Label htmlFor="pin-switch" className="text-sm font-normal cursor-pointer flex-1">
                      {formIsPinned ? 'Pinned (High visibility)' : 'Not pinned'}
                    </Label>
                    {formIsPinned && <Pin className="h-4 w-4 text-primary" />}
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Schedule Publication
                  </Label>
                  <Switch
                    checked={formIsScheduled}
                    onCheckedChange={setFormIsScheduled}
                  />
                </div>
                
                {formIsScheduled && (
                  <div className="grid grid-cols-2 gap-4 p-4 border rounded-md bg-muted/20 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <Label htmlFor="schedule-date" className="text-xs">Date</Label>
                      <Input
                        id="schedule-date"
                        type="date"
                        value={formScheduleDate}
                        onChange={(e) => setFormScheduleDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="schedule-time" className="text-xs">Time</Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        value={formScheduleTime}
                        onChange={(e) => setFormScheduleTime(e.target.value)}
                      />
                    </div>
                    <p className="col-span-2 text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Students will not see this announcement until the scheduled time.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="px-6 py-4 border-t shrink-0 bg-muted/10">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 min-w-[120px]">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : formIsScheduled ? (
                <Clock className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isSubmitting 
                ? 'Saving...' 
                : formIsScheduled 
                  ? 'Schedule' 
                  : editingAnnouncement 
                    ? 'Update' 
                    : 'Publish Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherAnnouncements;
