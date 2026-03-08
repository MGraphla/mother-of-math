import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeEvent = {
  type: 'teacher_signup' | 'student_added' | 'lesson_created' | 'assignment_created' | 
        'submission_added' | 'chat_message' | 'image_generated' | 'resource_added';
  data: any;
  timestamp: Date;
};

interface UseAdminRealtimeOptions {
  onEvent?: (event: RealtimeEvent) => void;
  onTeacherSignup?: (data: any) => void;
  onStudentAdded?: (data: any) => void;
  onLessonCreated?: (data: any) => void;
  onAssignmentCreated?: (data: any) => void;
  onSubmissionAdded?: (data: any) => void;
  onChatMessage?: (data: any) => void;
  onImageGenerated?: (data: any) => void;
  onResourceAdded?: (data: any) => void;
  enabled?: boolean;
}

/**
 * Hook for subscribing to real-time admin dashboard updates
 * Subscribes to multiple tables and triggers callbacks on changes
 */
export const useAdminRealtime = (options: UseAdminRealtimeOptions = {}) => {
  const {
    onEvent,
    onTeacherSignup,
    onStudentAdded,
    onLessonCreated,
    onAssignmentCreated,
    onSubmissionAdded,
    onChatMessage,
    onImageGenerated,
    onResourceAdded,
    enabled = true,
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  
  const handleEvent = useCallback((type: RealtimeEvent['type'], data: any) => {
    const event: RealtimeEvent = {
      type,
      data,
      timestamp: new Date(),
    };
    onEvent?.(event);
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;

    // Create a multi-table subscription channel
    const channel = supabase
      .channel('admin-dashboard-realtime')
      // Teacher signups (profiles table)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          console.log('[Realtime] New teacher signup:', payload.new);
          onTeacherSignup?.(payload.new);
          handleEvent('teacher_signup', payload.new);
        }
      )
      // Student additions
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'students',
        },
        (payload) => {
          console.log('[Realtime] New student added:', payload.new);
          onStudentAdded?.(payload.new);
          handleEvent('student_added', payload.new);
        }
      )
      // Lesson plan creations
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lesson_plans',
        },
        (payload) => {
          console.log('[Realtime] New lesson created:', payload.new);
          onLessonCreated?.(payload.new);
          handleEvent('lesson_created', payload.new);
        }
      )
      // Assignment creations
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'assignments',
        },
        (payload) => {
          console.log('[Realtime] New assignment created:', payload.new);
          onAssignmentCreated?.(payload.new);
          handleEvent('assignment_created', payload.new);
        }
      )
      // Submission additions
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'submissions',
        },
        (payload) => {
          console.log('[Realtime] New submission added:', payload.new);
          onSubmissionAdded?.(payload.new);
          handleEvent('submission_added', payload.new);
        }
      )
      // Chat messages
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chatbot_messages',
        },
        (payload) => {
          console.log('[Realtime] New chat message:', payload.new);
          onChatMessage?.(payload.new);
          handleEvent('chat_message', payload.new);
        }
      )
      // Image generations
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'generated_images',
        },
        (payload) => {
          console.log('[Realtime] New image generated:', payload.new);
          onImageGenerated?.(payload.new);
          handleEvent('image_generated', payload.new);
        }
      )
      // Resource uploads
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'resources',
        },
        (payload) => {
          console.log('[Realtime] New resource added:', payload.new);
          onResourceAdded?.(payload.new);
          handleEvent('resource_added', payload.new);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Admin dashboard subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('[Realtime] Cleaning up admin dashboard subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [
    enabled,
    onTeacherSignup,
    onStudentAdded,
    onLessonCreated,
    onAssignmentCreated,
    onSubmissionAdded,
    onChatMessage,
    onImageGenerated,
    onResourceAdded,
    handleEvent,
  ]);

  return {
    isSubscribed: channelRef.current !== null,
  };
};

/**
 * Hook for tracking real-time stats updates
 */
export const useRealtimeStats = (onStatsUpdate: () => void, enabled = true) => {
  const lastUpdateRef = useRef<Date>(new Date());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedUpdate = useCallback(() => {
    // Debounce updates to avoid too frequent refreshes
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      lastUpdateRef.current = new Date();
      onStatsUpdate();
    }, 2000); // 2 second debounce
  }, [onStatsUpdate]);

  useAdminRealtime({
    enabled,
    onEvent: () => {
      debouncedUpdate();
    },
  });

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    lastUpdate: lastUpdateRef.current,
  };
};

export default useAdminRealtime;
