import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  TicketIcon,
  SearchIcon,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  UserIcon,
  RefreshCw,
  Send,
  Eye,
  Mail,
  Calendar,
  Tag,
  User2,
  MoreHorizontal,
  Filter,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Inbox,
  AlertTriangle,
  Zap,
  Timer,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  Star,
  StarOff,
  Pin,
  PinOff,
  Trash2,
  Archive,
  RotateCcw,
  Copy,
  ExternalLink,
  FileText,
  Paperclip,
  ChevronRight,
  ChevronDown,
  ListFilter,
  LayoutGrid,
  LayoutList,
  Kanban,
  Circle,
  CheckCheck,
  XOctagon,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Bot,
  History,
  UserCog,
  Shield,
  Bell,
  BellOff,
  Reply,
  Forward,
  MoreVertical,
  Headphones,
  ImagePlus,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { KPICard, KPIGrid } from '@/components/admin/KPICard';
import {
  getAllSupportTickets,
  getSupportTicketStats,
  updateTicketStatus,
  getTicketResponses,
  addTicketResponse,
} from '@/services/adminService';
import { supabase } from '@/lib/supabase';
import type { SupportTicket, SupportTicketStats, TicketResponse } from '@/types/admin';
import { format, formatDistanceToNow, differenceInHours, differenceInMinutes, isToday, isYesterday, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

// ============================================================
// TYPES & CONSTANTS
// ============================================================

type TicketStatus = 'open' | 'in_progress' | 'waiting_response' | 'resolved' | 'closed';
type ViewMode = 'table' | 'kanban' | 'list';
type SortField = 'created_at' | 'updated_at' | 'priority' | 'status';
type SortOrder = 'asc' | 'desc';

interface CannedResponse {
  id: string;
  title: string;
  content: string;
  category: string;
}

const priorityConfig = {
  urgent: { color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 dark:bg-red-950', border: 'border-red-200', icon: Zap },
  high: { color: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-200', icon: AlertTriangle },
  medium: { color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-200', icon: Circle },
  low: { color: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-900', border: 'border-gray-200', icon: Circle },
};

const statusConfig = {
  open: { color: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50 dark:bg-yellow-950', icon: Inbox, label: 'Open' },
  in_progress: { color: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50 dark:bg-blue-950', icon: Clock, label: 'In Progress' },
  waiting_response: { color: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50 dark:bg-purple-950', icon: MessageSquare, label: 'Awaiting Reply' },
  resolved: { color: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 dark:bg-green-950', icon: CheckCircle2, label: 'Resolved' },
  closed: { color: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-900', icon: XCircle, label: 'Closed' },
};

const categoryLabels: Record<string, string> = {
  general: 'General',
  technical: 'Technical',
  billing: 'Billing',
  feature_request: 'Feature Request',
  bug_report: 'Bug Report',
  account: 'Account',
  other: 'Other',
};

const defaultCannedResponses: CannedResponse[] = [
  { id: '1', title: 'Greeting', content: 'Hello! Thank you for reaching out to our support team. I\'d be happy to help you with your inquiry.', category: 'general' },
  { id: '2', title: 'Request More Info', content: 'To better assist you, could you please provide more details about your issue? Specifically:\n\n1. What steps led to this issue?\n2. When did you first notice this problem?\n3. Are you able to reproduce it consistently?', category: 'general' },
  { id: '3', title: 'Technical Escalation', content: 'I\'ve escalated your ticket to our technical team for further investigation. You should hear back within 24-48 hours. We appreciate your patience.', category: 'technical' },
  { id: '4', title: 'Resolution Confirmation', content: 'I\'m glad we could resolve your issue. Please let us know if you have any other questions. Thank you for your patience!', category: 'general' },
  { id: '5', title: 'Password Reset', content: 'To reset your password:\n\n1. Go to the login page\n2. Click "Forgot Password"\n3. Enter your email address\n4. Check your inbox for the reset link\n5. Follow the instructions to create a new password', category: 'account' },
  { id: '6', title: 'Feature Acknowledged', content: 'Thank you for your feature suggestion! We\'ve logged this request and will consider it for future updates. Your feedback helps us improve the platform.', category: 'feature_request' },
];

// ============================================================
// HELPER COMPONENTS
// ============================================================

const PriorityBadge: React.FC<{ priority: string; size?: 'sm' | 'md' }> = ({ priority, size = 'md' }) => {
  const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium;
  const Icon = config.icon;
  return (
    <Badge className={cn(config.bg, config.text, 'border', config.border, size === 'sm' ? 'text-xs px-1.5 py-0' : '')}>
      <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      {priority}
    </Badge>
  );
};

const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.open;
  const Icon = config.icon;
  return (
    <Badge className={cn(config.bg, config.text, 'border', size === 'sm' ? 'text-xs px-1.5 py-0' : '')}>
      <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      {config.label}
    </Badge>
  );
};

const SLAIndicator: React.FC<{ createdAt: string; status: string }> = ({ createdAt, status }) => {
  if (['resolved', 'closed'].includes(status)) return null;
  
  const hours = differenceInHours(new Date(), parseISO(createdAt));
  const slaHours = 24;
  const percentage = Math.min((hours / slaHours) * 100, 100);
  const isOverdue = hours > slaHours;
  const isWarning = hours > slaHours * 0.75;
  
  return (
    <Tooltip>
      <TooltipTrigger>
        <div className="flex items-center gap-1">
          <Timer className={cn('h-3.5 w-3.5', isOverdue ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-green-500')} />
          <span className={cn('text-xs font-medium', isOverdue ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-green-500')}>
            {isOverdue ? `${hours - slaHours}h over` : `${slaHours - hours}h left`}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>SLA: {isOverdue ? 'Overdue' : `${Math.round(percentage)}% of time used`}</p>
        <Progress value={percentage} className="h-1 mt-1" />
      </TooltipContent>
    </Tooltip>
  );
};

const formatDate = (dateStr: string) => {
  const date = parseISO(dateStr);
  if (isToday(date)) return `Today ${format(date, 'HH:mm')}`;
  if (isYesterday(date)) return `Yesterday ${format(date, 'HH:mm')}`;
  return format(date, 'MMM d, HH:mm');
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const SupportTicketsManagement: React.FC = () => {
  const navigate = useNavigate();
  
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState<SupportTicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isQuickReplyOpen, setIsQuickReplyOpen] = useState(false);
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false);
  
  const [responses, setResponses] = useState<TicketResponse[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [newResponse, setNewResponse] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sendingResponse, setSendingResponse] = useState(false);
  const [showCannedResponses, setShowCannedResponses] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const [bulkStatus, setBulkStatus] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ticketsData, statsData] = await Promise.all([
        getAllSupportTickets(),
        getSupportTicketStats(),
      ]);
      setTickets(ticketsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast({ title: 'Error', description: 'Failed to load tickets', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchResponses = async (ticketId: string) => {
    setResponsesLoading(true);
    try {
      const data = await getTicketResponses(ticketId, true);
      setResponses(data);
    } catch (error) {
      console.error('Error fetching responses:', error);
    } finally {
      setResponsesLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Real-time subscription for ticket responses
  useEffect(() => {
    if (!selectedTicket?.id) return;

    const channel = supabase
      .channel(`ticket-responses-${selectedTicket.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_responses',
          filter: `ticket_id=eq.${selectedTicket.id}`,
        },
        (payload) => {
          // Add new response to the list if not already present
          const newResponse = payload.new as TicketResponse;
          setResponses((prev) => {
            const exists = prev.some((r) => r.id === newResponse.id);
            if (exists) return prev;
            return [...prev, newResponse];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTicket?.id]);

  // Real-time subscription for ticket updates
  useEffect(() => {
    const channel = supabase
      .channel('support-tickets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
        },
        () => {
          // Refresh tickets list when any change happens
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredTickets = useMemo(() => {
    let result = [...tickets];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.subject.toLowerCase().includes(term) ||
        t.user_name.toLowerCase().includes(term) ||
        t.user_email?.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term) ||
        t.id.toLowerCase().includes(term)
      );
    }
    
    if (statusFilter.length > 0) {
      result = result.filter(t => statusFilter.includes(t.status));
    }
    
    if (priorityFilter.length > 0) {
      result = result.filter(t => priorityFilter.includes(t.priority));
    }
    
    if (categoryFilter.length > 0) {
      result = result.filter(t => categoryFilter.includes(t.category));
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
        case 'status':
          const statusOrder = { open: 0, in_progress: 1, waiting_response: 2, resolved: 3, closed: 4 };
          comparison = statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder];
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return result;
  }, [tickets, searchTerm, statusFilter, priorityFilter, categoryFilter, sortField, sortOrder]);

  const kanbanColumns = useMemo(() => ({
    open: filteredTickets.filter(t => t.status === 'open'),
    in_progress: filteredTickets.filter(t => t.status === 'in_progress'),
    waiting_response: filteredTickets.filter(t => t.status === 'waiting_response'),
    resolved: filteredTickets.filter(t => t.status === 'resolved'),
  }), [filteredTickets]);

  const handleOpenTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setIsDetailOpen(true);
    await fetchResponses(ticket.id);
  };

  const handleQuickReply = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setNewResponse('');
    setIsInternalNote(false);
    setIsQuickReplyOpen(true);
  };

  const handleSendResponse = async () => {
    if (!selectedTicket || !newResponse.trim()) return;

    setSendingResponse(true);
    try {
      // Upload attachments if any
      let messageWithAttachments = newResponse;
      if (attachments.length > 0) {
        const uploadedUrls = await uploadAttachments(selectedTicket.id);
        if (uploadedUrls.length > 0) {
          // Append attachment URLs to message
          const attachmentLinks = uploadedUrls.map(url => `[Attachment](${url})`).join('\n');
          messageWithAttachments = `${newResponse}\n\n📎 Attachments:\n${attachmentLinks}`;
        }
      }
      
      // Pass isAdminResponse=true since this is the admin dashboard
      const responseId = await addTicketResponse(selectedTicket.id, messageWithAttachments, isInternalNote, true);
      
      if (responseId) {
        toast({ title: 'Response sent', description: isInternalNote ? 'Internal note added' : 'Reply sent to user' });
        setNewResponse('');
        setIsInternalNote(false);
        setShowCannedResponses(false);
        setAttachments([]);
        
        if (isDetailOpen) {
          await fetchResponses(selectedTicket.id);
        }
        
        setIsQuickReplyOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error('Error sending response:', error);
      toast({ title: 'Error', description: 'Failed to send response', variant: 'destructive' });
    } finally {
      setSendingResponse(false);
    }
  };

  // File attachment handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const validFiles = Array.from(files).filter(file => {
        // Allow images and common document types
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        if (!validTypes.includes(file.type)) {
          toast({ title: 'Invalid file type', description: `${file.name} is not a supported file type`, variant: 'destructive' });
          return false;
        }
        if (file.size > maxSize) {
          toast({ title: 'File too large', description: `${file.name} is larger than 5MB`, variant: 'destructive' });
          return false;
        }
        return true;
      });
      setAttachments(prev => [...prev, ...validFiles]);
    }
    // Reset input
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
      
      setAttachments([]);
      return uploadedUrls;
    } catch (error) {
      console.error('Error uploading attachments:', error);
      return uploadedUrls;
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: TicketStatus, resolution?: string) => {
    try {
      const success = await updateTicketStatus(ticketId, newStatus, resolution);
      if (success) {
        toast({ title: 'Status updated', description: `Ticket status changed to ${statusConfig[newStatus]?.label || newStatus}` });
        fetchData();
        
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket({ ...selectedTicket, status: newStatus });
        }
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleBulkStatusChange = async () => {
    if (!bulkStatus || selectedTickets.length === 0) return;
    
    try {
      await Promise.all(selectedTickets.map(id => updateTicketStatus(id, bulkStatus)));
      toast({ title: 'Bulk update complete', description: `${selectedTickets.length} tickets updated` });
      setSelectedTickets([]);
      setBulkStatus('');
      setIsBulkActionOpen(false);
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Some updates failed', variant: 'destructive' });
    }
  };

  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTickets(prev => 
      prev.includes(ticketId) 
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const selectAllVisible = () => {
    if (selectedTickets.length === filteredTickets.length) {
      setSelectedTickets([]);
    } else {
      setSelectedTickets(filteredTickets.map(t => t.id));
    }
  };

  const insertCannedResponse = (response: CannedResponse) => {
    setNewResponse(prev => prev ? `${prev}\n\n${response.content}` : response.content);
    setShowCannedResponses(false);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter([]);
    setPriorityFilter([]);
    setCategoryFilter([]);
  };

  const activeFilterCount = statusFilter.length + priorityFilter.length + categoryFilter.length + (searchTerm ? 1 : 0);

  const renderStats = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Total Tickets</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats?.total_tickets || 0}</p>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <TicketIcon className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">Open</p>
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{stats?.open_tickets || 0}</p>
            </div>
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Inbox className="h-5 w-5 text-yellow-500" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-purple-600 dark:text-purple-400">In Progress</p>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{stats?.in_progress_tickets || 0}</p>
            </div>
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Clock className="h-5 w-5 text-purple-500" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-green-600 dark:text-green-400">Resolved</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats?.resolved_tickets || 0}</p>
            </div>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-orange-600 dark:text-orange-400">Avg Response</p>
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                {stats?.avg_first_response_hours ? `${stats.avg_first_response_hours.toFixed(1)}h` : '--'}
              </p>
            </div>
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Timer className="h-5 w-5 text-orange-500" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 border-indigo-200">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Avg Resolution</p>
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                {stats?.avg_resolution_hours ? `${stats.avg_resolution_hours.toFixed(1)}h` : '--'}
              </p>
            </div>
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderToolbar = () => (
    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
      <div className="flex flex-1 gap-2 items-center w-full lg:w-auto flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets, users, emails..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Circle className="h-3.5 w-3.5" />
              Status
              {statusFilter.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">{statusFilter.length}</Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {Object.entries(statusConfig).map(([key, config]) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={statusFilter.includes(key)}
                onCheckedChange={(checked) => {
                  setStatusFilter(prev => checked ? [...prev, key] : prev.filter(s => s !== key));
                }}
              >
                <config.icon className="h-4 w-4 mr-2" />
                {config.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Zap className="h-3.5 w-3.5" />
              Priority
              {priorityFilter.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">{priorityFilter.length}</Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            {Object.keys(priorityConfig).map((key) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={priorityFilter.includes(key)}
                onCheckedChange={(checked) => {
                  setPriorityFilter(prev => checked ? [...prev, key] : prev.filter(p => p !== key));
                }}
                className="capitalize"
              >
                {key}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <Tag className="h-3.5 w-3.5" />
              Category
              {categoryFilter.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">{categoryFilter.length}</Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {Object.entries(categoryLabels).map(([key, label]) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={categoryFilter.includes(key)}
                onCheckedChange={(checked) => {
                  setCategoryFilter(prev => checked ? [...prev, key] : prev.filter(c => c !== key));
                }}
              >
                {label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <XCircle className="h-4 w-4 mr-1" />
            Clear ({activeFilterCount})
          </Button>
        )}
      </div>
      
      <div className="flex gap-2 items-center">
        {selectedTickets.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setIsBulkActionOpen(true)}>
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Bulk Actions ({selectedTickets.length})
          </Button>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[
              { field: 'created_at', label: 'Created Date' },
              { field: 'updated_at', label: 'Last Updated' },
              { field: 'priority', label: 'Priority' },
              { field: 'status', label: 'Status' },
            ].map(({ field, label }) => (
              <DropdownMenuItem
                key={field}
                onClick={() => {
                  if (sortField === field) {
                    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField(field as SortField);
                    setSortOrder('desc');
                  }
                }}
              >
                {sortField === field && (
                  sortOrder === 'desc' ? <ArrowDown className="h-4 w-4 mr-2" /> : <ArrowUp className="h-4 w-4 mr-2" />
                )}
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="flex border rounded-lg p-0.5">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode('table')}
          >
            <LayoutList className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode('kanban')}
          >
            <Kanban className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode('list')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
        
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>
    </div>
  );

  const renderTableView = () => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={selectedTickets.length === filteredTickets.length && filteredTickets.length > 0}
                  onChange={selectAllVisible}
                  className="rounded border-gray-300"
                />
              </TableHead>
              <TableHead className="w-10">Priority</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No tickets found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map(ticket => (
                <TableRow 
                  key={ticket.id} 
                  className={cn(
                    "cursor-pointer hover:bg-muted/50 transition-colors",
                    selectedTickets.includes(ticket.id) && "bg-primary/5"
                  )}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedTickets.includes(ticket.id)}
                      onChange={() => toggleTicketSelection(ticket.id)}
                      className="rounded border-gray-300"
                    />
                  </TableCell>
                  <TableCell>
                    <div className={cn('w-2 h-2 rounded-full', priorityConfig[ticket.priority as keyof typeof priorityConfig]?.color)} />
                  </TableCell>
                  <TableCell onClick={() => handleOpenTicket(ticket)}>
                    <div className="max-w-[250px]">
                      <p className="font-medium truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground truncate">#{ticket.id.slice(0, 8)}</p>
                    </div>
                  </TableCell>
                  <TableCell onClick={() => handleOpenTicket(ticket)}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{ticket.user_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <p className="font-medium truncate max-w-[120px]">{ticket.user_name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell onClick={() => handleOpenTicket(ticket)}>
                    <Badge variant="outline" className="text-xs">{categoryLabels[ticket.category]}</Badge>
                  </TableCell>
                  <TableCell onClick={() => handleOpenTicket(ticket)}>
                    <StatusBadge status={ticket.status} size="sm" />
                  </TableCell>
                  <TableCell onClick={() => handleOpenTicket(ticket)}>
                    <SLAIndicator createdAt={ticket.created_at} status={ticket.status} />
                  </TableCell>
                  <TableCell onClick={() => handleOpenTicket(ticket)}>
                    <span className="text-xs text-muted-foreground">{formatDate(ticket.created_at)}</span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenTicket(ticket)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleQuickReply(ticket)}>
                          <Reply className="h-4 w-4 mr-2" />
                          Quick Reply
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                        {Object.entries(statusConfig).map(([key, config]) => (
                          <DropdownMenuItem
                            key={key}
                            onClick={() => handleStatusChange(ticket.id, key as TicketStatus)}
                            disabled={ticket.status === key}
                          >
                            <config.icon className="h-4 w-4 mr-2" />
                            {config.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const renderKanbanView = () => (
    <div className="grid grid-cols-4 gap-4 overflow-x-auto pb-4">
      {Object.entries(kanbanColumns).map(([status, columnTickets]) => {
        const config = statusConfig[status as keyof typeof statusConfig];
        return (
          <div key={status} className="min-w-[280px]">
            <div className={cn("p-3 rounded-t-lg border-b-2", config.bg, config.color.replace('bg-', 'border-'))}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <config.icon className="h-4 w-4" />
                  <span className="font-medium">{config.label}</span>
                </div>
                <Badge variant="secondary">{columnTickets.length}</Badge>
              </div>
            </div>
            <ScrollArea className="h-[600px] bg-muted/30 rounded-b-lg p-2">
              <div className="space-y-2">
                {columnTickets.map(ticket => (
                  <motion.div
                    key={ticket.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-background border rounded-lg p-3 shadow-sm hover:shadow-md cursor-pointer transition-shadow"
                    onClick={() => handleOpenTicket(ticket)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <PriorityBadge priority={ticket.priority} size="sm" />
                      <span className="text-xs text-muted-foreground">#{ticket.id.slice(0, 6)}</span>
                    </div>
                    <p className="font-medium text-sm line-clamp-2 mb-2">{ticket.subject}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User2 className="h-3 w-3" />
                        <span className="truncate max-w-[100px]">{ticket.user_name}</span>
                      </div>
                      <span>{formatDistanceToNow(parseISO(ticket.created_at), { addSuffix: true })}</span>
                    </div>
                    {ticket.response_count > 0 && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        <span>{ticket.response_count} responses</span>
                      </div>
                    )}
                  </motion.div>
                ))}
                {columnTickets.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No tickets
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <div className="space-y-2">
      {filteredTickets.map(ticket => (
        <Card
          key={ticket.id}
          className={cn(
            "cursor-pointer hover:border-primary/50 transition-colors",
            selectedTickets.includes(ticket.id) && "border-primary bg-primary/5"
          )}
          onClick={() => handleOpenTicket(ticket)}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <input
                type="checkbox"
                checked={selectedTickets.includes(ticket.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleTicketSelection(ticket.id);
                }}
                className="mt-1 rounded border-gray-300"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <PriorityBadge priority={ticket.priority} size="sm" />
                      <StatusBadge status={ticket.status} size="sm" />
                      <Badge variant="outline" className="text-xs">{categoryLabels[ticket.category]}</Badge>
                    </div>
                    <h3 className="font-semibold truncate">{ticket.subject}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1">{ticket.description}</p>
                  </div>
                  <SLAIndicator createdAt={ticket.created_at} status={ticket.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px]">{ticket.user_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span>{ticket.user_name}</span>
                    </div>
                    <span>#{ticket.id.slice(0, 8)}</span>
                    {ticket.response_count > 0 && (
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        <span>{ticket.response_count}</span>
                      </div>
                    )}
                  </div>
                  <span>{formatDate(ticket.created_at)}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleQuickReply(ticket);
                }}
              >
                <Reply className="h-4 w-4 mr-1" />
                Reply
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {filteredTickets.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No tickets found</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-white">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TicketIcon className="h-8 w-8 text-primary" />
            </div>
            Support Center
          </h1>
          <p className="text-gray-400 mt-1">
            Manage and respond to support tickets
          </p>
        </div>
      </div>

      {renderStats()}
      {renderToolbar()}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredTickets.length} of {tickets.length} tickets
          {selectedTickets.length > 0 && ` • ${selectedTickets.length} selected`}
        </span>
      </div>

      {viewMode === 'table' && renderTableView()}
      {viewMode === 'kanban' && renderKanbanView()}
      {viewMode === 'list' && renderListView()}

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">
            {selectedTicket ? `Ticket: ${selectedTicket.subject}` : 'Ticket Details'}
          </DialogTitle>
          {selectedTicket && (
            <>
              <div className="p-6 border-b bg-muted/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <PriorityBadge priority={selectedTicket.priority} />
                      <StatusBadge status={selectedTicket.status} />
                      <Badge variant="outline">{categoryLabels[selectedTicket.category]}</Badge>
                      <span className="text-xs text-muted-foreground">#{selectedTicket.id.slice(0, 8)}</span>
                    </div>
                    <h2 className="text-xl font-semibold">{selectedTicket.subject}</h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1">
                        <User2 className="h-4 w-4" />
                        {selectedTicket.user_name}
                      </div>
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        {selectedTicket.user_email}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(parseISO(selectedTicket.created_at), 'MMM d, yyyy HH:mm')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedTicket.status}
                      onValueChange={(value) => handleStatusChange(selectedTicket.id, value as TicketStatus)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <config.icon className="h-4 w-4" />
                              {config.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex">
                <div className="flex-1 flex flex-col min-h-0 border-r">
                  {/* Chat Messages Area with subtle pattern background */}
                  <ScrollArea className="flex-1 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
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
                                {selectedTicket.user_name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background"></span>
                          </div>
                        </div>
                        {/* Message Content */}
                        <div className="flex-1 max-w-[75%]">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">{selectedTicket.user_name}</span>
                            <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0 h-4 border-0">
                              Customer
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(parseISO(selectedTicket.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="relative">
                            <div className="absolute -left-2 top-3 w-0 h-0 border-t-8 border-t-transparent border-r-8 border-r-blue-100 dark:border-r-blue-900 border-b-8 border-b-transparent"></div>
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-950 border border-blue-200 dark:border-blue-800 rounded-2xl rounded-tl-md p-4 shadow-sm">
                              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{selectedTicket.description}</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      {responsesLoading ? (
                        <div className="flex justify-center py-12">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Loading conversation...</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {responses.map((response, index) => {
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
                                <div className={cn(
                                  "flex-1 max-w-[75%]",
                                  response.is_internal && "opacity-80"
                                )}>
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
                                            Customer
                                          </Badge>
                                        </>
                                      )}
                                    </div>
                                    {response.is_internal && (
                                      <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950">
                                        Internal
                                      </Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(parseISO(response.created_at), { addSuffix: true })}
                                    </span>
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
                                        : "bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-950 border border-blue-200 dark:border-blue-800 rounded-tl-md",
                                      response.is_internal && "border-dashed border-amber-400 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900 dark:to-amber-950"
                                    )}>
                                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{response.message}</p>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}

                      {/* Resolution Card */}
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
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </ScrollArea>

                  <div className="p-4 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCannedResponses(!showCannedResponses)}
                      >
                        <Sparkles className="h-4 w-4 mr-1" />
                        Templates
                      </Button>
                      <label className="flex items-center gap-2 text-sm ml-auto">
                        <input
                          type="checkbox"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        Internal note
                      </label>
                    </div>
                    
                    {showCannedResponses && (
                      <div className="mb-3 p-2 bg-muted rounded-lg max-h-32 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-1">
                          {defaultCannedResponses.map(response => (
                            <Button
                              key={response.id}
                              variant="ghost"
                              size="sm"
                              className="justify-start text-xs h-auto py-1"
                              onClick={() => insertCannedResponse(response)}
                            >
                              {response.title}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* File input (hidden) */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx"
                      multiple
                    />
                    
                    <div className="flex gap-2">
                      <div className="flex-1 space-y-2">
                        <Textarea
                          placeholder={isInternalNote ? "Add internal note..." : "Type your reply..."}
                          value={newResponse}
                          onChange={(e) => setNewResponse(e.target.value)}
                          className="min-h-[80px]"
                        />
                        
                        {/* Attachment preview */}
                        {attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-md">
                            {attachments.map((file, index) => (
                              <div key={index} className="relative group">
                                {file.type.startsWith('image/') ? (
                                  <div className="relative h-16 w-16 rounded-md overflow-hidden border">
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
                                    <span className="max-w-[100px] truncate">{file.name}</span>
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
                      </div>
                      
                      {/* Attachment button */}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAttachment}
                        className="shrink-0"
                        title="Attach files"
                      >
                        {uploadingAttachment ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ImagePlus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      {attachments.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {attachments.length} file(s) attached
                        </span>
                      )}
                      <div className="ml-auto">
                        <Button onClick={handleSendResponse} disabled={!newResponse.trim() || sendingResponse || uploadingAttachment}>
                          {sendingResponse ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          {isInternalNote ? 'Add Note' : 'Send Reply'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-64 p-4 bg-muted/20">
                  <h4 className="font-medium mb-3">Ticket Info</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Created</p>
                      <p>{format(parseISO(selectedTicket.created_at), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Last Updated</p>
                      <p>{format(parseISO(selectedTicket.updated_at), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                    {selectedTicket.resolved_at && (
                      <div>
                        <p className="text-muted-foreground text-xs">Resolved</p>
                        <p>{format(parseISO(selectedTicket.resolved_at), 'MMM d, yyyy HH:mm')}</p>
                      </div>
                    )}
                    <Separator />
                    <div>
                      <p className="text-muted-foreground text-xs">Responses</p>
                      <p>{responses.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">SLA Status</p>
                      <SLAIndicator createdAt={selectedTicket.created_at} status={selectedTicket.status} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isQuickReplyOpen} onOpenChange={setIsQuickReplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Reply</DialogTitle>
            <DialogDescription>{selectedTicket?.subject}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCannedResponses(!showCannedResponses)}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Use Template
              </Button>
              <label className="flex items-center gap-2 text-sm ml-auto">
                <input
                  type="checkbox"
                  checked={isInternalNote}
                  onChange={(e) => setIsInternalNote(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Internal note
              </label>
            </div>
            
            {showCannedResponses && (
              <div className="p-2 bg-muted rounded-lg max-h-40 overflow-y-auto">
                <div className="space-y-1">
                  {defaultCannedResponses.map(response => (
                    <Button
                      key={response.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-sm"
                      onClick={() => insertCannedResponse(response)}
                    >
                      {response.title}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            
            <Textarea
              placeholder={isInternalNote ? "Add internal note..." : "Type your reply..."}
              value={newResponse}
              onChange={(e) => setNewResponse(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickReplyOpen(false)}>Cancel</Button>
            <Button onClick={handleSendResponse} disabled={!newResponse.trim() || sendingResponse}>
              {sendingResponse ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {isInternalNote ? 'Add Note' : 'Send Reply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkActionOpen} onOpenChange={setIsBulkActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Actions</DialogTitle>
            <DialogDescription>
              Apply actions to {selectedTickets.length} selected tickets
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Change Status</label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <config.icon className="h-4 w-4" />
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkActionOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkStatusChange} disabled={!bulkStatus}>
              Apply to {selectedTickets.length} tickets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportTicketsManagement;
