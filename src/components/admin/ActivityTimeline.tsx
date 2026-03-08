import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  BookOpen,
  ClipboardList,
  FileText,
  MessageSquare,
  Image,
  GraduationCap,
  Megaphone,
  FolderOpen,
  Clock,
  RefreshCw,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

export interface ActivityEvent {
  id: string;
  type: 'teacher_signup' | 'student_created' | 'lesson_plan' | 'assignment' | 'submission' | 'message' | 'image' | 'announcement' | 'resource' | 'login';
  title: string;
  description: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, any>;
}

interface ActivityTimelineProps {
  events?: ActivityEvent[];
  maxItems?: number;
  showFilters?: boolean;
  className?: string;
  title?: string;
  compact?: boolean;
}

const eventTypeConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  teacher_signup: {
    icon: <User className="h-4 w-4" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    label: 'Teacher Signup',
  },
  student_created: {
    icon: <GraduationCap className="h-4 w-4" />,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    label: 'Student Created',
  },
  lesson_plan: {
    icon: <BookOpen className="h-4 w-4" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    label: 'Lesson Plan',
  },
  assignment: {
    icon: <ClipboardList className="h-4 w-4" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    label: 'Assignment',
  },
  submission: {
    icon: <FileText className="h-4 w-4" />,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    label: 'Submission',
  },
  message: {
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    label: 'Message',
  },
  image: {
    icon: <Image className="h-4 w-4" />,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    label: 'Image Generated',
  },
  announcement: {
    icon: <Megaphone className="h-4 w-4" />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    label: 'Announcement',
  },
  resource: {
    icon: <FolderOpen className="h-4 w-4" />,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    label: 'Resource',
  },
  login: {
    icon: <User className="h-4 w-4" />,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    label: 'Login',
  },
};

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  events: propEvents,
  maxItems = 20,
  showFilters = true,
  className,
  title = 'Activity Timeline',
  compact = false,
}) => {
  const [events, setEvents] = useState<ActivityEvent[]>(propEvents || []);
  const [loading, setLoading] = useState(!propEvents);
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!propEvents) {
      generateMockEvents();
    } else {
      setEvents(propEvents);
    }
  }, [propEvents]);

  const generateMockEvents = () => {
    // Generate mock events for demonstration
    const types = ['teacher_signup', 'student_created', 'lesson_plan', 'assignment', 'submission', 'message', 'image'] as const;
    const names = ['John Smith', 'Mary Johnson', 'David Wilson', 'Sarah Brown', 'Michael Davis', 'Emily Taylor'];
    
    const mockEvents: ActivityEvent[] = [];
    const now = Date.now();
    
    for (let i = 0; i < 30; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const name = names[Math.floor(Math.random() * names.length)];
      const hoursAgo = Math.floor(Math.random() * 72);
      
      let title = '';
      let description = '';
      
      switch (type) {
        case 'teacher_signup':
          title = `${name} registered`;
          description = 'New teacher account created';
          break;
        case 'student_created':
          title = `Student added`;
          description = `${name} created a new student account`;
          break;
        case 'lesson_plan':
          title = 'Lesson plan created';
          description = `${name} created "Introduction to Fractions"`;
          break;
        case 'assignment':
          title = 'Assignment created';
          description = `${name} posted a new math assignment`;
          break;
        case 'submission':
          title = 'Submission received';
          description = `Student submitted assignment to ${name}`;
          break;
        case 'message':
          title = 'Chatbot conversation';
          description = `${name} started a new AI chat session`;
          break;
        case 'image':
          title = 'Image generated';
          description = `${name} generated educational images`;
          break;
      }
      
      mockEvents.push({
        id: `mock-${i}`,
        type,
        title,
        description,
        timestamp: new Date(now - hoursAgo * 60 * 60 * 1000).toISOString(),
        userName: name,
      });
    }
    
    // Sort by timestamp
    mockEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setEvents(mockEvents);
    setLoading(false);
  };

  // Filter events
  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    return event.type === filter;
  });

  // Group events by date
  const groupedEvents: Record<string, ActivityEvent[]> = {};
  filteredEvents.slice(0, expanded ? undefined : maxItems).forEach(event => {
    const date = new Date(event.timestamp);
    let dateKey: string;
    
    if (isToday(date)) {
      dateKey = 'Today';
    } else if (isYesterday(date)) {
      dateKey = 'Yesterday';
    } else {
      dateKey = format(date, 'MMMM d, yyyy');
    }
    
    if (!groupedEvents[dateKey]) {
      groupedEvents[dateKey] = [];
    }
    groupedEvents[dateKey].push(event);
  });

  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'h:mm a');
  };

  if (loading) {
    return (
      <Card className={cn("bg-gray-900/50 border-gray-800", className)}>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-gray-900/50 border-gray-800", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-400" />
            {title}
          </CardTitle>
          {showFilters && (
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[150px] bg-gray-800 border-gray-700 h-8 text-sm">
                <Filter className="h-3 w-3 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activity</SelectItem>
                <SelectItem value="teacher_signup">Signups</SelectItem>
                <SelectItem value="student_created">Students</SelectItem>
                <SelectItem value="lesson_plan">Lesson Plans</SelectItem>
                <SelectItem value="assignment">Assignments</SelectItem>
                <SelectItem value="submission">Submissions</SelectItem>
                <SelectItem value="message">Messages</SelectItem>
                <SelectItem value="image">Images</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {Object.keys(groupedEvents).length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No activity to show</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEvents).map(([date, dateEvents]) => (
              <div key={date}>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {date}
                </h4>
                <div className="space-y-3">
                  {dateEvents.map((event, index) => {
                    const config = eventTypeConfig[event.type] || eventTypeConfig.login;
                    
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "flex items-start gap-3 relative",
                          !compact && "group hover:bg-gray-800/30 p-2 -mx-2 rounded-lg transition-colors"
                        )}
                      >
                        {/* Timeline connector */}
                        {!compact && index < dateEvents.length - 1 && (
                          <div className="absolute left-[18px] top-10 bottom-0 w-px bg-gray-800" />
                        )}
                        
                        {/* Icon */}
                        <div className={cn(
                          "p-2 rounded-lg flex-shrink-0 z-10",
                          config.bgColor
                        )}>
                          <span className={config.color}>{config.icon}</span>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium text-white truncate">
                              {event.title}
                            </p>
                            <Badge variant="outline" className={cn(
                              "text-[10px] px-1.5 py-0",
                              config.color,
                              config.bgColor,
                              "border-0"
                            )}>
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-1">
                            {event.description}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTime(event.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Show more button */}
        {filteredEvents.length > maxItems && (
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-white"
            >
              <ChevronDown className={cn(
                "h-4 w-4 mr-1 transition-transform",
                expanded && "rotate-180"
              )} />
              {expanded ? 'Show less' : `Show ${filteredEvents.length - maxItems} more`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityTimeline;
