import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  useAdminRealtime, 
  RealtimeEvent 
} from '@/hooks/useAdminRealtime';
import { 
  Activity, 
  UserPlus, 
  Users, 
  BookOpen, 
  ClipboardList,
  FileCheck,
  MessageSquare,
  Image,
  FolderPlus,
  Radio,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface ActivityItem extends RealtimeEvent {
  id: string;
}

const eventConfig: Record<RealtimeEvent['type'], {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
}> = {
  teacher_signup: {
    icon: UserPlus,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    label: 'Teacher Signup',
  },
  student_added: {
    icon: Users,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    label: 'Student Added',
  },
  lesson_created: {
    icon: BookOpen,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    label: 'Lesson Created',
  },
  assignment_created: {
    icon: ClipboardList,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    label: 'Assignment Created',
  },
  submission_added: {
    icon: FileCheck,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    label: 'Submission Added',
  },
  chat_message: {
    icon: MessageSquare,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    label: 'Chat Message',
  },
  image_generated: {
    icon: Image,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    label: 'Image Generated',
  },
  resource_added: {
    icon: FolderPlus,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    label: 'Resource Added',
  },
};

const getEventDescription = (event: RealtimeEvent): string => {
  const { type, data } = event;
  
  switch (type) {
    case 'teacher_signup':
      return `${data.full_name || 'A new teacher'} joined the platform`;
    case 'student_added':
      return `${data.name || 'A student'} was added`;
    case 'lesson_created':
      return `New lesson: "${data.title || 'Untitled'}"`;
    case 'assignment_created':
      return `Assignment: "${data.title || 'Untitled'}" created`;
    case 'submission_added':
      return `New submission received`;
    case 'chat_message':
      return `Chat message from ${data.role === 'user' ? 'teacher' : 'AI'}`;
    case 'image_generated':
      return `Image generated: "${(data.prompt || '').substring(0, 30)}..."`;
    case 'resource_added':
      return `Resource: "${data.title || 'Untitled'}" uploaded`;
    default:
      return 'Activity detected';
  }
};

interface RealtimeActivityFeedProps {
  maxItems?: number;
  className?: string;
  collapsible?: boolean;
}

const RealtimeActivityFeed: React.FC<RealtimeActivityFeedProps> = ({
  maxItems = 20,
  className = '',
  collapsible = true,
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newCount, setNewCount] = useState(0);

  const handleEvent = useCallback((event: RealtimeEvent) => {
    const newActivity: ActivityItem = {
      ...event,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    setActivities(prev => {
      const updated = [newActivity, ...prev];
      return updated.slice(0, maxItems);
    });

    if (isCollapsed) {
      setNewCount(prev => prev + 1);
    }
  }, [maxItems, isCollapsed]);

  useAdminRealtime({
    enabled: isLive,
    onEvent: handleEvent,
  });

  // Clear new count when expanding
  useEffect(() => {
    if (!isCollapsed) {
      setNewCount(0);
    }
  }, [isCollapsed]);

  const clearAll = () => {
    setActivities([]);
    setNewCount(0);
  };

  if (isCollapsed && collapsible) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`fixed bottom-4 right-4 z-50 ${className}`}
      >
        <Button
          onClick={() => setIsCollapsed(false)}
          className="relative bg-gray-900 border border-gray-700 hover:bg-gray-800 text-white shadow-lg"
        >
          <Activity className="w-4 h-4 mr-2" />
          Live Activity
          {isLive && (
            <span className="ml-2 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          )}
          {newCount > 0 && (
            <Badge className="ml-2 bg-red-500 text-white text-xs h-5 min-w-5 flex items-center justify-center">
              {newCount > 9 ? '9+' : newCount}
            </Badge>
          )}
          <ChevronUp className="w-4 h-4 ml-2" />
        </Button>
      </motion.div>
    );
  }

  return (
    <Card className={`bg-gray-900/80 backdrop-blur-sm border-gray-800 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <Radio className={`w-4 h-4 ${isLive ? 'text-green-400 animate-pulse' : 'text-gray-500'}`} />
            Real-time Activity
            {isLive && (
              <Badge className="bg-green-500/20 text-green-400 text-xs">
                LIVE
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsLive(!isLive)}
              className={isLive ? 'text-green-400' : 'text-gray-400'}
            >
              {isLive ? 'Pause' : 'Resume'}
            </Button>
            {activities.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-gray-400 hover:text-red-400"
              >
                Clear
              </Button>
            )}
            {collapsible && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCollapsed(true)}
                className="text-gray-400 h-8 w-8"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[300px] pr-4">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
              <Activity className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Waiting for activity...</p>
              <p className="text-xs mt-1">Events will appear here in real-time</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {activities.map((activity) => {
                const config = eventConfig[activity.type];
                const Icon = config.icon;
                
                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mb-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${config.bgColor} shrink-0`}>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline"
                            className={`${config.color} border-current/30 text-xs`}
                          >
                            {config.label}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 mt-1 truncate">
                          {getEventDescription(activity)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default RealtimeActivityFeed;
