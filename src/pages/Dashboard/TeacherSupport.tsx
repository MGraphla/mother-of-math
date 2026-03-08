import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  TicketIcon,
  Plus,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  RefreshCw,
  Send,
  HelpCircle,
  ChevronRight,
  Calendar,
  Tag,
  Search,
  Filter,
  ArrowUpDown,
  ThumbsUp,
  ThumbsDown,
  Star,
  Lightbulb,
  Book,
  FileText,
  Paperclip,
  Image,
  Zap,
  AlertTriangle,
  Circle,
  Eye,
  Copy,
  Check,
  Sparkles,
  Timer,
  TrendingUp,
  User,
  Mail,
  History,
  Inbox,
  Archive,
  MoreHorizontal,
  ChevronDown,
  ListFilter,
  ExternalLink,
  Loader2,
  Headphones,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { createSupportTicket, getUserSupportTickets, getTicketResponses, addTicketResponse } from '@/services/adminService';
import type { SupportTicket, TicketResponse } from '@/types/admin';
import { format, formatDistanceToNow, parseISO, differenceInHours, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

// ============================================================
// TYPES & CONSTANTS
// ============================================================

type TabValue = 'all' | 'open' | 'resolved';
type SortField = 'created_at' | 'updated_at' | 'priority';
type SortOrder = 'asc' | 'desc';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface HelpArticle {
  id: string;
  title: string;
  description: string;
  link: string;
  icon: React.ElementType;
}

const priorityConfig = {
  urgent: { color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 dark:bg-red-950', icon: Zap },
  high: { color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 dark:bg-orange-950', icon: AlertTriangle },
  medium: { color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50 dark:bg-blue-950', icon: Circle },
  low: { color: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-900', icon: Circle },
};

const statusConfig = {
  open: { color: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50 dark:bg-yellow-950', icon: Inbox, label: 'Open' },
  in_progress: { color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50 dark:bg-blue-950', icon: Clock, label: 'In Progress' },
  waiting_response: { color: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50 dark:bg-purple-950', icon: MessageSquare, label: 'Waiting for Reply' },
  resolved: { color: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 dark:bg-green-950', icon: CheckCircle2, label: 'Resolved' },
  closed: { color: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-900', icon: XCircle, label: 'Closed' },
};

const categories = [
  { value: 'general', label: 'General Question', icon: HelpCircle },
  { value: 'technical', label: 'Technical Issue', icon: AlertCircle },
  { value: 'account', label: 'Account Problem', icon: User },
  { value: 'feature_request', label: 'Feature Request', icon: Lightbulb },
  { value: 'bug_report', label: 'Bug Report', icon: AlertTriangle },
  { value: 'billing', label: 'Billing', icon: FileText },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
];

const priorities = [
  { value: 'low', label: 'Low', description: 'General questions, no rush', color: 'bg-gray-400' },
  { value: 'medium', label: 'Medium', description: 'Normal priority issues', color: 'bg-blue-500' },
  { value: 'high', label: 'High', description: 'Important, needs attention soon', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', description: 'Critical, blocking work', color: 'bg-red-500' },
];

const faqs: FAQ[] = [
  {
    id: '1',
    question: 'How do I reset my students password?',
    answer: 'Navigate to the Students page, find the student, click the menu button and select "Reset Password". A temporary password will be generated that the student can change on their next login.',
    category: 'account',
  },
  {
    id: '2',
    question: 'How do I create assignments for my class?',
    answer: 'Go to the Assignments page and click "Create Assignment". You can set the title, description, due date, and attach any relevant materials. Assign it to specific students or the entire class.',
    category: 'general',
  },
  {
    id: '3',
    question: 'How does the AI grading work?',
    answer: 'Our AI grading system analyzes student submissions for mathematical accuracy, problem-solving approach, and written explanations. You can review and adjust AI-generated grades before finalizing them.',
    category: 'technical',
  },
  {
    id: '4',
    question: 'Can I export student progress reports?',
    answer: 'Yes! Go to the Progress Reports page and click "Export". You can export individual student reports or class-wide analytics in PDF or CSV format.',
    category: 'general',
  },
  {
    id: '5',
    question: 'How do I contact a parent?',
    answer: 'Navigate to the Students page, click on a student, and youll see the parent contact information. You can send messages directly through the platform or use their email address.',
    category: 'general',
  },
];

const helpArticles: HelpArticle[] = [
  { id: '1', title: 'Getting Started Guide', description: 'Learn the basics of using the platform', link: '#', icon: Book },
  { id: '2', title: 'Managing Students', description: 'Add, edit, and organize your students', link: '#', icon: User },
  { id: '3', title: 'Creating Effective Assignments', description: 'Best practices for assignments', link: '#', icon: FileText },
  { id: '4', title: 'Understanding Analytics', description: 'Make sense of student performance data', link: '#', icon: TrendingUp },
];

// ============================================================
// HELPER COMPONENTS
// ============================================================

const PriorityBadge: React.FC<{ priority: string; size?: 'sm' | 'md' }> = ({ priority, size = 'md' }) => {
  const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium;
  const Icon = config.icon;
  return (
    <Badge className={cn(config.bg, config.text, 'border-0', size === 'sm' ? 'text-xs px-1.5 py-0' : '')}>
      <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      {priority}
    </Badge>
  );
};

const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.open;
  const Icon = config.icon;
  return (
    <Badge className={cn(config.bg, config.text, 'border-0', size === 'sm' ? 'text-xs px-1.5 py-0' : '')}>
      <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      {config.label}
    </Badge>
  );
};

const SatisfactionRating: React.FC<{ ticketId: string; currentRating?: number }> = ({ ticketId, currentRating }) => {
  const [rating, setRating] = useState<number | undefined>(currentRating);
  const [submitted, setSubmitted] = useState(false);

  const handleRate = (value: number) => {
    setRating(value);
    setSubmitted(true);
    toast({ title: 'Thank you!', description: 'Your feedback has been recorded.' });
  };

  if (submitted || currentRating) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Check className="h-4 w-4 text-green-500" />
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Was this helpful?</span>
      <Button variant="ghost" size="sm" onClick={() => handleRate(5)} className="h-8 px-2">
        <ThumbsUp className="h-4 w-4 text-green-500" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => handleRate(1)} className="h-8 px-2">
        <ThumbsDown className="h-4 w-4 text-red-500" />
      </Button>
    </div>
  );
};

const formatDate = (dateStr: string) => {
  const date = parseISO(dateStr);
  if (isToday(date)) return `Today at ${format(date, 'h:mm a')}`;
  if (isYesterday(date)) return `Yesterday at ${format(date, 'h:mm a')}`;
  return format(date, 'MMM d, yyyy h:mm a');
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const TeacherSupport: React.FC = () => {
  const { user, profile } = useAuth();
  
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);
  
  const [responses, setResponses] = useState<TicketResponse[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [newResponse, setNewResponse] = useState('');
  const [sendingResponse, setSendingResponse] = useState(false);
  
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [faqSearchTerm, setFaqSearchTerm] = useState('');

  // Attachment state
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [responses]);

  const fetchTickets = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const data = await getUserSupportTickets(user.id);
      setTickets(data);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast({
        title: 'Error',
        description: 'Failed to load support tickets',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchResponses = async (ticketId: string) => {
    setResponsesLoading(true);
    try {
      const data = await getTicketResponses(ticketId, false);
      setResponses(data);
    } catch (error) {
      console.error('Error fetching responses:', error);
    } finally {
      setResponsesLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [user?.id]);

  // Real-time subscription for ticket responses
  useEffect(() => {
    if (!selectedTicket?.id) return;

    const channel = supabase
      .channel(`teacher-ticket-responses-${selectedTicket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_responses',
          filter: `ticket_id=eq.${selectedTicket.id}`,
        },
        (payload) => {
          const newResp = payload.new as TicketResponse;
          setResponses((prev) => {
            const exists = prev.some((r) => r.id === newResp.id);
            if (exists) return prev;
            return [...prev, newResp];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket?.id]);

  // Real-time subscription for user's tickets
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('teacher-tickets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const filteredTickets = useMemo(() => {
    let result = [...tickets];
    
    if (activeTab === 'open') {
      result = result.filter(t => !['resolved', 'closed'].includes(t.status));
    } else if (activeTab === 'resolved') {
      result = result.filter(t => ['resolved', 'closed'].includes(t.status));
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.subject.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term) ||
        t.id.toLowerCase().includes(term)
      );
    }
    
    if (categoryFilter !== 'all') {
      result = result.filter(t => t.category === categoryFilter);
    }
    
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'created_at':
        case 'updated_at':
          comparison = new Date(a[sortField]).getTime() - new Date(b[sortField]).getTime();
          break;
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          comparison = priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return result;
  }, [tickets, activeTab, searchTerm, categoryFilter, sortField, sortOrder]);

  const filteredFaqs = useMemo(() => {
    if (!faqSearchTerm) return faqs;
    const term = faqSearchTerm.toLowerCase();
    return faqs.filter(f => 
      f.question.toLowerCase().includes(term) ||
      f.answer.toLowerCase().includes(term)
    );
  }, [faqSearchTerm]);

  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    awaitingReply: tickets.filter(t => t.status === 'waiting_response').length,
    resolved: tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length,
  }), [tickets]);

  const handleCreateTicket = async () => {
    if (!user?.id || !subject.trim() || !description.trim()) {
      toast({
        title: 'Required Fields',
        description: 'Please fill in subject and description',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const ticketId = await createSupportTicket(user.id, subject.trim(), description.trim(), category, priority);
      if (ticketId) {
        toast({ title: 'Ticket Created', description: 'Your support request has been submitted.' });
        setIsNewTicketOpen(false);
        setSubject('');
        setDescription('');
        setCategory('general');
        setPriority('medium');
        fetchTickets();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create ticket', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setIsDetailOpen(true);
    await fetchResponses(ticket.id);
  };

  const handleSendResponse = async () => {
    if (!selectedTicket || !newResponse.trim()) return;

    setSendingResponse(true);
    try {
      // Upload attachments if any
      let messageWithAttachments = newResponse.trim();
      if (attachments.length > 0) {
        const uploadedUrls = await uploadAttachments(selectedTicket.id);
        if (uploadedUrls.length > 0) {
          const attachmentLinks = uploadedUrls.map(url => `[Attachment](${url})`).join('\n');
          messageWithAttachments = `${newResponse.trim()}\n\n📎 Attachments:\n${attachmentLinks}`;
        }
      }
      
      const responseId = await addTicketResponse(selectedTicket.id, messageWithAttachments, false);
      if (responseId) {
        setNewResponse('');
        setAttachments([]);
        await fetchResponses(selectedTicket.id);
        fetchTickets();
        toast({ title: 'Message Sent', description: 'Your response has been added.' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally {
      setSendingResponse(false);
    }
  };

  // File attachment handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const validFiles = Array.from(files).filter(file => {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        if (!validTypes.includes(file.type)) {
          toast({ title: 'Invalid file type', description: `${file.name} is not supported`, variant: 'destructive' });
          return false;
        }
        if (file.size > maxSize) {
          toast({ title: 'File too large', description: `${file.name} exceeds 5MB limit`, variant: 'destructive' });
          return false;
        }
        return true;
      });
      setAttachments(prev => [...prev, ...validFiles]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (ticketId: string): Promise<string[]> => {
    if (attachments.length === 0) return [];
    
    setUploadingAttachment(true);
    const uploadedUrls: string[] = [];
    
    try {
      for (const file of attachments) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${ticketId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('ticket-attachments')
          .upload(fileName, file);
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('ticket-attachments')
          .getPublicUrl(fileName);
        
        uploadedUrls.push(publicUrl);
      }
      
      return uploadedUrls;
    } catch (error) {
      console.error('Error uploading attachments:', error);
      return uploadedUrls;
    } finally {
      setUploadingAttachment(false);
    }
  };

  const copyTicketId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getResponseTime = (ticket: SupportTicket) => {
    const hours = differenceInHours(new Date(), parseISO(ticket.created_at));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6 px-4 lg:px-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            Support Center
          </h1>
          <p className="text-muted-foreground mt-1">Get help, browse FAQs, or submit a support request</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTickets} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={() => setIsNewTicketOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <TicketIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-950 dark:to-amber-900">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Open</p>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{stats.open}</p>
              </div>
              <Inbox className="h-6 w-6 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400">In Progress</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.inProgress}</p>
              </div>
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-purple-700 dark:text-purple-400">Awaiting</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">{stats.awaitingReply}</p>
              </div>
              <MessageSquare className="h-6 w-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-green-700 dark:text-green-400">Resolved</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.resolved}</p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Tickets Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <CardTitle className="text-lg">Your Tickets</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search tickets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9">
                        <ArrowUpDown className="h-4 w-4 mr-1" />
                        Sort
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setSortField('created_at'); setSortOrder('desc'); }}>
                        Newest First
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSortField('created_at'); setSortOrder('asc'); }}>
                        Oldest First
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSortField('priority'); setSortOrder('asc'); }}>
                        Priority (High to Low)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setSortField('updated_at'); setSortOrder('desc'); }}>
                        Recently Updated
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
                <TabsList className="w-full grid grid-cols-3 mb-4">
                  <TabsTrigger value="all">All ({tickets.length})</TabsTrigger>
                  <TabsTrigger value="open">Open ({stats.open + stats.inProgress + stats.awaitingReply})</TabsTrigger>
                  <TabsTrigger value="resolved">Resolved ({stats.resolved})</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-0">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <TicketIcon className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No Tickets Found</h3>
                      <p className="text-muted-foreground mt-1 max-w-sm">
                        {searchTerm || categoryFilter !== 'all'
                          ? 'Try adjusting your filters'
                          : 'You havent submitted any support tickets yet.'}
                      </p>
                      {!searchTerm && categoryFilter === 'all' && (
                        <Button className="mt-4" onClick={() => setIsNewTicketOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Ticket
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <AnimatePresence>
                        {filteredTickets.map((ticket, index) => (
                          <motion.div
                            key={ticket.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: index * 0.03 }}
                          >
                            <div
                              className={cn(
                                "p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md hover:border-primary/30",
                                ticket.status === 'waiting_response' && "border-l-4 border-l-purple-500"
                              )}
                              onClick={() => handleOpenTicket(ticket)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h4 className="font-medium truncate">{ticket.subject}</h4>
                                    {ticket.response_count > 0 && (
                                      <Badge variant="secondary" className="shrink-0 text-xs">
                                        <MessageSquare className="h-3 w-3 mr-1" />
                                        {ticket.response_count}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                                    {ticket.description}
                                  </p>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                    <Tooltip>
                                      <TooltipTrigger className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {formatDistanceToNow(parseISO(ticket.created_at), { addSuffix: true })}
                                      </TooltipTrigger>
                                      <TooltipContent>{formatDate(ticket.created_at)}</TooltipContent>
                                    </Tooltip>
                                    <span className="flex items-center gap-1">
                                      <Tag className="h-3 w-3" />
                                      {categories.find(c => c.value === ticket.category)?.label || ticket.category}
                                    </span>
                                    <button
                                      className="flex items-center gap-1 hover:text-primary transition-colors"
                                      onClick={(e) => { e.stopPropagation(); copyTicketId(ticket.id); }}
                                    >
                                      {copiedId === ticket.id ? (
                                        <Check className="h-3 w-3 text-green-500" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                      #{ticket.id.slice(0, 8)}
                                    </button>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <div className="flex items-center gap-2">
                                    <PriorityBadge priority={ticket.priority} size="sm" />
                                    <StatusBadge status={ticket.status} size="sm" />
                                  </div>
                                  {!['resolved', 'closed'].includes(ticket.status) && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Timer className="h-3 w-3" />
                                      {getResponseTime(ticket)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - FAQ & Help */}
        <div className="space-y-4">
          {/* Quick Help */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Quick Help
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {helpArticles.map(article => (
                <a
                  key={article.id}
                  href={article.link}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted transition-colors group"
                >
                  <div className="p-1.5 bg-primary/10 rounded-md group-hover:bg-primary/20 transition-colors">
                    <article.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm group-hover:text-primary transition-colors">{article.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{article.description}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-blue-500" />
                  FAQ
                </CardTitle>
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search FAQ..."
                  value={faqSearchTerm}
                  onChange={(e) => setFaqSearchTerm(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Accordion type="single" collapsible className="w-full">
                {filteredFaqs.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id}>
                    <AccordionTrigger className="text-sm text-left hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {filteredFaqs.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">No matching questions found</p>
              )}
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto mb-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Need More Help?</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-3">
                  Our support team typically responds within 24 hours.
                </p>
                <Button onClick={() => setIsNewTicketOpen(true)} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Submit a Ticket
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New Ticket Dialog */}
      <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create Support Ticket
            </DialogTitle>
            <DialogDescription>
              Describe your issue and our team will help you resolve it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject *</label>
              <Input
                placeholder="Brief summary of your issue..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => {
                      const Icon = cat.icon;
                      return (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {cat.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", p.color)} />
                          <span>{p.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description *</label>
              <Textarea
                placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce, or other relevant information..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                The more details you provide, the faster we can help you.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewTicketOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTicket} disabled={submitting || !subject.trim() || !description.trim()}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">
            {selectedTicket ? `Ticket: ${selectedTicket.subject}` : 'Ticket Details'}
          </DialogTitle>
          {selectedTicket && (
            <>
              <div className="p-6 border-b bg-muted/30 shrink-0">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <PriorityBadge priority={selectedTicket.priority} />
                      <StatusBadge status={selectedTicket.status} />
                      <Badge variant="outline">
                        {categories.find(c => c.value === selectedTicket.category)?.label}
                      </Badge>
                    </div>
                    <h2 className="text-xl font-semibold">{selectedTicket.subject}</h2>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Created {formatDate(selectedTicket.created_at)}
                      </span>
                      <button
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                        onClick={() => copyTicketId(selectedTicket.id)}
                      >
                        {copiedId === selectedTicket.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        #{selectedTicket.id.slice(0, 8)}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Messages Area with subtle pattern background */}
              <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950" style={{ maxHeight: '50vh' }}>
                <div className="p-6 space-y-6">
                  {/* ORIGINAL TICKET MESSAGE - USER (LEFT SIDE) */}
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-3"
                  >
                    {/* User Avatar */}
                    <div className="flex-shrink-0">
                      <div className="relative">
                        <Avatar className="h-10 w-10 ring-2 ring-blue-400 ring-offset-2 ring-offset-background">
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold text-sm">
                            {profile?.full_name?.slice(0, 2).toUpperCase() || 'ME'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background"></span>
                      </div>
                    </div>
                    {/* Message Content */}
                    <div className="flex-1 max-w-[75%]">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-semibold text-sm text-foreground">{profile?.full_name || 'You'}</span>
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] px-1.5 py-0 h-4 border-0">
                          You
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(selectedTicket.created_at)}</span>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-2 top-3 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-blue-100 dark:border-r-blue-900 border-b-8 border-b-transparent"></div>
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-950 border border-blue-200 dark:border-blue-800 rounded-2xl rounded-tl-md p-4 shadow-sm">
                          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{selectedTicket.description}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Responses - Conversation style */}
                  {responsesLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Loading conversation...</span>
                      </div>
                    </div>
                  ) : responses.length > 0 ? (
                    <div className="space-y-6">
                      {responses.filter(r => !r.is_internal).map((response, index) => {
                        const isSupport = response.user_role === 'admin';
                        return (
                          <motion.div
                            key={response.id}
                            initial={{ opacity: 0, x: isSupport ? 20 : -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={cn(
                              "flex items-start gap-3",
                              isSupport && "flex-row-reverse"
                            )}
                          >
                            {/* Avatar */}
                            <div className="flex-shrink-0">
                              <div className="relative">
                                <Avatar className={cn(
                                  "h-10 w-10 ring-2 ring-offset-2 ring-offset-background",
                                  isSupport ? "ring-emerald-400" : "ring-blue-400"
                                )}>
                                  <AvatarFallback className={cn(
                                    "font-semibold text-sm text-white",
                                    isSupport 
                                      ? "bg-gradient-to-br from-emerald-500 to-emerald-600" 
                                      : "bg-gradient-to-br from-blue-500 to-blue-600"
                                  )}>
                                    {isSupport ? (
                                      <Headphones className="h-5 w-5" />
                                    ) : (
                                      response.user_name.slice(0, 2).toUpperCase()
                                    )}
                                  </AvatarFallback>
                                </Avatar>
                                {isSupport && (
                                  <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-background">
                                    <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Message Content */}
                            <div className="flex-1 max-w-[75%]">
                              <div className={cn(
                                "flex items-center gap-2 mb-1.5",
                                isSupport && "flex-row-reverse"
                              )}>
                                <div className="flex items-center gap-1.5">
                                  {isSupport ? (
                                    <>
                                      <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                                        Support
                                      </span>
                                      <Badge className="bg-emerald-500 text-white text-[10px] px-1.5 py-0 h-4 border-0">
                                        Staff
                                      </Badge>
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">
                                        {response.user_name}
                                      </span>
                                      <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0 h-4 border-0">
                                        You
                                      </Badge>
                                    </>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">{formatDate(response.created_at)}</span>
                              </div>
                              <div className="relative">
                                {/* Message pointer/arrow */}
                                <div className={cn(
                                  "absolute top-3 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent",
                                  isSupport 
                                    ? "-right-2 border-l-8 border-l-emerald-100 dark:border-l-emerald-900" 
                                    : "-left-2 border-r-8 border-r-blue-100 dark:border-r-blue-900"
                                )}></div>
                                <div className={cn(
                                  "rounded-2xl p-4 shadow-sm",
                                  isSupport 
                                    ? "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900 dark:to-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-tr-md" 
                                    : "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-950 border border-blue-200 dark:border-blue-800 rounded-tl-md"
                                )}>
                                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{response.message}</p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center py-12 px-6"
                    >
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900 dark:to-emerald-950 flex items-center justify-center mb-4">
                        <Headphones className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <h4 className="font-semibold text-foreground mb-1">Waiting for Support</h4>
                      <p className="text-sm text-muted-foreground text-center max-w-xs">
                        Our support team will respond to your ticket soon. Average response time is under 24 hours.
                      </p>
                    </motion.div>
                  )}

                  {/* Resolution */}
                  {selectedTicket.resolution && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6"
                    >
                      <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900 dark:to-emerald-950 rounded-xl border border-green-300 dark:border-green-700 shadow-sm overflow-hidden">
                        <div className="bg-green-500/10 px-4 py-2 border-b border-green-300 dark:border-green-700">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-green-500 rounded-full">
                              <CheckCircle2 className="h-4 w-4 text-white" />
                            </div>
                            <span className="font-semibold text-green-700 dark:text-green-400">Ticket Resolved</span>
                          </div>
                        </div>
                        <div className="p-4">
                          <p className="text-sm text-foreground">{selectedTicket.resolution}</p>
                          {['resolved', 'closed'].includes(selectedTicket.status) && (
                            <div className="mt-4 pt-4 border-t border-green-300 dark:border-green-700">
                              <SatisfactionRating ticketId={selectedTicket.id} />
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Scroll anchor */}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Reply Input */}
              {!['closed'].includes(selectedTicket.status) && (
                <div className="p-4 border-t shrink-0">
                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="image/*,.pdf"
                    multiple
                  />
                  
                  {/* Attachment preview */}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 mb-2 bg-muted/50 rounded-md">
                      {attachments.map((file, index) => (
                        <div key={index} className="relative group">
                          {file.type.startsWith('image/') ? (
                            <div className="relative h-14 w-14 rounded-md overflow-hidden border">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="h-full w-full object-cover"
                              />
                              <button
                                onClick={() => removeAttachment(index)}
                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="relative flex items-center gap-2 px-2 py-1 bg-background border rounded-md text-xs">
                              <span className="max-w-[80px] truncate">{file.name}</span>
                              <button
                                onClick={() => removeAttachment(index)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <div className="flex-1 flex gap-2">
                      <Textarea
                        placeholder="Type your message..."
                        value={newResponse}
                        onChange={(e) => setNewResponse(e.target.value)}
                        rows={2}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAttachment}
                        title="Attach file"
                        className="shrink-0"
                      >
                        {uploadingAttachment ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Paperclip className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <Button
                      onClick={handleSendResponse}
                      disabled={!newResponse.trim() || sendingResponse || uploadingAttachment}
                      className="shrink-0"
                    >
                      {sendingResponse ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {attachments.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {attachments.length} file(s) attached
                    </p>
                  )}
                </div>
              )}

              {selectedTicket.status === 'closed' && (
                <div className="p-4 border-t bg-muted/30 text-center">
                  <p className="text-sm text-muted-foreground">
                    This ticket is closed. <button className="text-primary hover:underline" onClick={() => { setIsDetailOpen(false); setIsNewTicketOpen(true); }}>Create a new ticket</button> if you need further assistance.
                  </p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherSupport;
