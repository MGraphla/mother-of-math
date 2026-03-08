/**
 * NotificationBell Component (Enhanced)
 * Shows notification count and dropdown list with grouping, filtering, and sound
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Loader2, 
  Settings, 
  Volume2, 
  VolumeX,
  BookOpen,
  MessageSquare,
  Star,
  FileText,
  Clock,
  Trophy,
  AlertCircle,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import {
  Notification,
  getStudentNotifications,
  markStudentNotificationRead,
  markAllStudentNotificationsRead,
  getTeacherNotifications,
  markTeacherNotificationRead,
  markAllTeacherNotificationsRead,
  deleteNotification,
} from '@/services/notificationService';

interface NotificationBellProps {
  isTeacher?: boolean;
  className?: string;
}

type FilterType = 'all' | 'unread' | 'assignments' | 'comments' | 'grades';

// Notification type icon mapping
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'new_assignment': return <BookOpen className="h-4 w-4" />;
    case 'graded': return <Trophy className="h-4 w-4" />;
    case 'comment': return <MessageSquare className="h-4 w-4" />;
    case 'submission': return <FileText className="h-4 w-4" />;
    case 'resubmit_request': return <AlertCircle className="h-4 w-4" />;
    case 'announcement': return <Star className="h-4 w-4" />;
    case 'due_reminder': return <Clock className="h-4 w-4" />;
    default: return <Bell className="h-4 w-4" />;
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case 'resubmit_request': 
    case 'due_reminder':
      return 'bg-destructive/10 text-destructive dark:bg-destructive/20';
    default: 
      return 'bg-primary/10 text-primary dark:bg-primary/20';
  }
};

// Group notifications by date
const groupByDate = (notifications: Notification[]) => {
  const groups: { label: string; notifications: Notification[] }[] = [];
  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const earlier: Notification[] = [];

  notifications.forEach(n => {
    const date = new Date(n.created_at);
    if (isToday(date)) today.push(n);
    else if (isYesterday(date)) yesterday.push(n);
    else earlier.push(n);
  });

  if (today.length > 0) groups.push({ label: 'Today', notifications: today });
  if (yesterday.length > 0) groups.push({ label: 'Yesterday', notifications: yesterday });
  if (earlier.length > 0) groups.push({ label: 'Earlier', notifications: earlier });

  return groups;
};

export const NotificationBell = ({ isTeacher = false, className }: NotificationBellProps) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('mom_notification_sound');
    return saved !== 'false';
  });
  const [prevUnreadCount, setPrevUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQAnZqzmsYZNQnmoy8JoQTZjqsK8nHBBOmaez9avcj8qUXWRonxcQkNwnbK6mGFJO1Zyo7WadU5KR2qSqKKDW0tFZ46jn4ZVTkJWa4iTi3NUUkZbbYmUimZcUEtrdZKLgWdfU0xoe42HdGthV01le4p9cmVhWE9kcX6AdmhfWVFib3t8cWRhW1NhbXl4aWNfWVRgaXVxY2FeW1Vjbnp4Y11fZlRhaHRwXV1hWVVfaHJpXmFbW1ZlamxtYGJaVVdhaGplXWRbU1VeZGdiXV5cVFZfZ2VfX15bVldgZGFdXV5aVVhhZGFbXV1bU1hiY15bX11XUlpkY1lbXltVU15lYllcX1lVVWFjYFpcXlpVV2NkXFlbXVZUWGVmWlpfXFRVXGdkV1pdWFVXYGdhV1pbV1RXYmVfV1xcVlVaZGVdV1tZU1RdZmRaWFxYVFdgZmFYWFpWU1RgZWJWWVxXU1dkZl9XWFlUU1lmZV1WWFhTVFpmZFpWWFZTVlxmYlhXWFVUV19nX1ZWV1VUWWJlW1dXVVRWXGRjWlZXVFRXX2NfVldXVFRbYmJcVlZWVFVcYmJZV1dUVVdeYV9XVlZVVVlgYFtXV1VVV1xfX1pWVlVVWF5fXVdXVVVYXV5bV1dVVVdaXlxZV1dVVlpcXVpYV1ZWV1tdW1lXV1ZXWl1bWldXVldZXFtbV1hXV1haW1pYV1dXWFlaWllYV1dZWFpZWVhYV1hZWlpZWFhYWFlZWVlYWFhYWFlZWFlYWFlZWVlYWFhZWVlYWFlYWVlZWFhYWFhZWVlZWFhZWFlZWFhZWVlZWFhYWVlZWVhYWFlZWVhYWFhZWVlYWFhZWVlYWFhZWVlYWFhZWQ==');
  }, []);

  // Play sound on new notifications
  useEffect(() => {
    if (soundEnabled && unreadCount > prevUnreadCount && prevUnreadCount > 0) {
      audioRef.current?.play().catch(() => {});
    }
    setPrevUnreadCount(unreadCount);
  }, [unreadCount, prevUnreadCount, soundEnabled]);

  // Save sound preference
  useEffect(() => {
    localStorage.setItem('mom_notification_sound', soundEnabled.toString());
  }, [soundEnabled]);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = isTeacher
        ? await getTeacherNotifications(50)
        : await getStudentNotifications(50);
      setNotifications(data);
    } catch (e) {
      console.error('Error fetching notifications:', e);
    } finally {
      setIsLoading(false);
    }
  }, [isTeacher]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkRead = async (notification: Notification) => {
    if (notification.is_read) return;
    
    try {
      if (isTeacher) {
        await markTeacherNotificationRead(notification.id);
      } else {
        await markStudentNotificationRead(notification.id);
      }
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      );
    } catch (e) {
      console.error('Error marking notification read:', e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      if (isTeacher) {
        await markAllTeacherNotificationsRead();
      } else {
        await markAllStudentNotificationsRead();
      }
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('Error marking all notifications read:', e);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (e) {
      console.error('Error deleting notification:', e);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    handleMarkRead(notification);
    setIsOpen(false);
    
    if (notification.link_url) {
      navigate(notification.link_url);
    }
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    switch (filter) {
      case 'unread': return !n.is_read;
      case 'assignments': return ['new_assignment', 'due_reminder'].includes(n.type);
      case 'comments': return n.type === 'comment';
      case 'grades': return n.type === 'graded';
      default: return true;
    }
  });

  const groupedNotifications = groupByDate(filteredNotifications);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative group', className)}
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        >
          <Bell className={cn(
            "h-5 w-5 transition-transform",
            isOpen && "scale-110",
            unreadCount > 0 && "animate-pulse"
          )} />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] flex items-center justify-center bg-red-500 text-white border-2 border-background animate-in zoom-in-50 duration-200"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 text-[10px]">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Read all
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                    Sound
                  </div>
                  <Switch
                    checked={soundEnabled}
                    onCheckedChange={setSoundEnabled}
                    className="scale-75"
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-full">
          <div className="px-2 py-2 border-b">
            <TabsList className="w-full h-8 grid grid-cols-5 p-0.5">
              <TabsTrigger value="all" className="text-[10px] h-7">All</TabsTrigger>
              <TabsTrigger value="unread" className="text-[10px] h-7">Unread</TabsTrigger>
              <TabsTrigger value="assignments" className="text-[10px] h-7">Tasks</TabsTrigger>
              <TabsTrigger value="comments" className="text-[10px] h-7">Comments</TabsTrigger>
              <TabsTrigger value="grades" className="text-[10px] h-7">Grades</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={filter} className="mt-0">
            <ScrollArea className="h-[380px]">
              {isLoading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Bell className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1 max-w-[200px]">
                    {filter === 'all' 
                      ? "We'll notify you about assignments, grades, and messages here"
                      : 'Try checking other categories'}
                  </p>
                </div>
              ) : (
                <div>
                  {groupedNotifications.map((group) => (
                    <div key={group.label}>
                      <div className="px-4 py-2 bg-muted/50 sticky top-0 z-10">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          {group.label}
                        </span>
                      </div>
                      {group.notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={cn(
                            'px-4 py-3 hover:bg-muted/50 cursor-pointer transition-all relative group border-b border-transparent hover:border-border',
                            !notification.is_read && 'bg-primary/5 border-l-2 border-l-primary'
                          )}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105',
                              getNotificationColor(notification.type)
                            )}>
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={cn(
                                  'text-sm line-clamp-1',
                                  !notification.is_read && 'font-semibold'
                                )}>
                                  {notification.title}
                                </p>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {!notification.is_read && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMarkRead(notification);
                                      }}
                                      title="Mark as read"
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(notification.id);
                                    }}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              {notification.message && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                                  {notification.message}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1.5">
                                <p className="text-[10px] text-muted-foreground/60">
                                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                </p>
                                {notification.link_url && (
                                  <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/40" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t bg-muted/20 text-center">
            <Button variant="link" size="sm" className="h-6 text-xs text-muted-foreground">
              View notification settings
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
