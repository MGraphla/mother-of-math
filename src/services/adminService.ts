/**
 * Admin Data Service
 * Fetches all data from Supabase for admin dashboard
 * Provides comprehensive data scraping for admin oversight
 * 
 * NOTE: Uses the shared supabase client from lib/supabase.ts
 * RPC functions use SECURITY DEFINER so they bypass RLS
 */

import { supabase } from '@/lib/supabase';
import type {
  TeacherStats,
  StudentStats,
  LessonPlanStats,
  ChatbotStats,
  AssignmentStats,
  SubmissionStats,
  DashboardOverview,
  UsageAnalytics,
  ResourceStats,
  AnnouncementStats,
  NotificationStats,
  CommentStats,
  ConversationMessageStats,
  StudentWorkStats,
} from '@/types/admin';

// Use the shared supabase client - RPC functions use SECURITY DEFINER to bypass RLS
const adminSupabase = supabase;

/**
 * Get dashboard overview statistics - fetches ALL data from Supabase
 * Uses RPC functions with SECURITY DEFINER to bypass RLS when service role key is not available
 */
export const getAdminDashboardOverview = async (): Promise<DashboardOverview> => {
  try {
    // Try using the admin counts RPC function first (bypasses RLS)
    const { data: rpcCounts, error: rpcError } = await supabase.rpc('get_admin_counts');
    
    if (!rpcError && rpcCounts !== null && rpcCounts.length > 0) {
      console.log('Using RPC function for admin counts (bypasses RLS)');
      const counts = rpcCounts[0];
      
      // Get recent activity using RPC or regular queries
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      return {
        totalTeachers: Number(counts.teachers_count) || 0,
        totalStudents: Number(counts.students_count) || 0,
        totalLessonPlans: Number(counts.lesson_plans_count) || 0,
        totalAssignments: Number(counts.assignments_count) || 0,
        totalSubmissions: Number(counts.submissions_count) || 0,
        totalChatConversations: Number(counts.conversations_count) || 0,
        totalChatMessages: Number(counts.messages_count) || 0,
        totalResources: Number(counts.resources_count) || 0,
        totalAnnouncements: Number(counts.announcements_count) || 0,
        totalNotifications: 0,
        totalComments: 0,
        activeTeachersToday: 0,
        activeTeachersThisWeek: 0,
        activeTeachersThisMonth: 0,
        newTeachersThisWeek: 0,
        newStudentsThisWeek: 0,
        newLessonPlansThisWeek: 0,
        newAssignmentsThisWeek: 0,
        newSubmissionsThisWeek: 0,
        totalImagesGenerated: 0,
        totalChatInputs: 0,
        totalChatResponses: 0,
        dailyActiveUsers: 0,
        weeklyActiveUsers: 0,
        monthlyActiveUsers: 0,
        aiWordsGenerated: 0,
      };
    }
    
    console.log('RPC function not available, falling back to direct queries');
    
    // Fall back to direct queries (requires service role key for full access)
    // Get counts from ALL tables in the database
    const [
      teachersResult,
      studentsResult,
      lessonPlansResult,
      assignmentsResult,
      submissionsResult,
      conversationsResult,
      messagesResult,
      resourcesResult,
      announcementsResult,
      notificationsResult,
      commentsResult,
    ] = await Promise.all([
      adminSupabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher'),
      adminSupabase.from('students').select('*', { count: 'exact', head: true }),
      adminSupabase.from('lesson_plans').select('*', { count: 'exact', head: true }),
      adminSupabase.from('assignments').select('*', { count: 'exact', head: true }),
      adminSupabase.from('assignment_submissions').select('*', { count: 'exact', head: true }),
      adminSupabase.from('conversations').select('*', { count: 'exact', head: true }),
      adminSupabase.from('conversation_messages').select('*', { count: 'exact', head: true }),
      adminSupabase.from('resources').select('*', { count: 'exact', head: true }),
      adminSupabase.from('announcements').select('*', { count: 'exact', head: true }),
      adminSupabase.from('notifications').select('*', { count: 'exact', head: true }),
      adminSupabase.from('assignment_comments').select('*', { count: 'exact', head: true }),
    ]);

    // Log any errors for debugging
    [teachersResult, studentsResult, lessonPlansResult, assignmentsResult, submissionsResult, conversationsResult, messagesResult, resourcesResult, announcementsResult, notificationsResult, commentsResult].forEach((result, index) => {
      if (result.error) {
        console.warn(`Admin query ${index} error:`, result.error.message);
      }
    });

    // Get recent activity counts
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      activeToday,
      activeWeek,
      activeMonth,
      newTeachersWeek,
      newStudentsWeek,
      newLessonPlansWeek,
      newAssignmentsWeek,
      newSubmissionsWeek,
    ] = await Promise.all([
      adminSupabase.from('profiles').select('*', { count: 'exact', head: true })
        .eq('role', 'teacher').gte('updated_at', todayStart.toISOString()),
      adminSupabase.from('profiles').select('*', { count: 'exact', head: true })
        .eq('role', 'teacher').gte('updated_at', weekAgo),
      adminSupabase.from('profiles').select('*', { count: 'exact', head: true })
        .eq('role', 'teacher').gte('updated_at', monthAgo),
      adminSupabase.from('profiles').select('*', { count: 'exact', head: true })
        .eq('role', 'teacher').gte('created_at', weekAgo),
      adminSupabase.from('students').select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo),
      adminSupabase.from('lesson_plans').select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo),
      adminSupabase.from('assignments').select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo),
      adminSupabase.from('assignment_submissions').select('*', { count: 'exact', head: true })
        .gte('submitted_at', weekAgo),
    ]);

    return {
      totalTeachers: teachersResult.count || 0,
      totalStudents: studentsResult.count || 0,
      totalLessonPlans: lessonPlansResult.count || 0,
      totalAssignments: assignmentsResult.count || 0,
      totalSubmissions: submissionsResult.count || 0,
      totalChatConversations: conversationsResult.count || 0,
      totalChatMessages: messagesResult.count || 0,
      totalResources: resourcesResult.count || 0,
      totalAnnouncements: announcementsResult.count || 0,
      totalNotifications: notificationsResult.count || 0,
      totalComments: commentsResult.count || 0,
      activeTeachersToday: activeToday.count || 0,
      activeTeachersThisWeek: activeWeek.count || 0,
      activeTeachersThisMonth: activeMonth.count || 0,
      newTeachersThisWeek: newTeachersWeek.count || 0,
      newStudentsThisWeek: newStudentsWeek.count || 0,
      newLessonPlansThisWeek: newLessonPlansWeek.count || 0,
      newAssignmentsThisWeek: newAssignmentsWeek.count || 0,
      newSubmissionsThisWeek: newSubmissionsWeek.count || 0,
      totalImagesGenerated: 0,
      totalChatInputs: 0,
      totalChatResponses: 0,
      dailyActiveUsers: activeToday.count || 0,
      weeklyActiveUsers: activeWeek.count || 0,
      monthlyActiveUsers: activeMonth.count || 0,
      aiWordsGenerated: 0,
    };
  } catch (error) {
    console.error('Error fetching admin dashboard overview:', error);
    return {
      totalTeachers: 0,
      totalStudents: 0,
      totalLessonPlans: 0,
      totalAssignments: 0,
      totalSubmissions: 0,
      totalChatConversations: 0,
      totalChatMessages: 0,
      totalResources: 0,
      totalAnnouncements: 0,
      totalNotifications: 0,
      totalComments: 0,
      activeTeachersToday: 0,
      activeTeachersThisWeek: 0,
      activeTeachersThisMonth: 0,
      newTeachersThisWeek: 0,
      newStudentsThisWeek: 0,
      newLessonPlansThisWeek: 0,
      newAssignmentsThisWeek: 0,
      newSubmissionsThisWeek: 0,
      totalImagesGenerated: 0,
      totalChatInputs: 0,
      totalChatResponses: 0,
      dailyActiveUsers: 0,
      weeklyActiveUsers: 0,
      monthlyActiveUsers: 0,
      aiWordsGenerated: 0,
    };
  }
};

/**
 * Get all teachers with their statistics - fetches ALL teacher profile data
 * Uses RPC function with SECURITY DEFINER to bypass RLS
 */
export const getAllTeachers = async (): Promise<TeacherStats[]> => {
  try {
    // First try using the RPC function that bypasses RLS
    const { data: rpcTeachers, error: rpcError } = await supabase.rpc('get_all_teachers');
    
    let teachers: any[] = [];
    
    if (!rpcError && rpcTeachers !== null) {
      console.log(`RPC: Found ${rpcTeachers.length} teachers (bypassed RLS)`);
      teachers = rpcTeachers;
    } else {
      // Fallback to direct query (requires service role key for full access)
      console.log('RPC error or not available, falling back to direct query:', rpcError?.message);
      const { data: directTeachers, error } = await adminSupabase
        .from('profiles')
        .select('*')
        .eq('role', 'teacher')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching teachers:', error.message);
        throw error;
      }
      
      teachers = directTeachers || [];
    }
    
    if (teachers.length === 0) {
      console.log('No teachers found in database');
      return [];
    }

    console.log(`Processing ${teachers.length} teachers`);

    // Get additional stats for each teacher using RPC or direct queries
    const teacherStats = await Promise.all(
      teachers.map(async (teacher) => {
        // Try RPC function for stats first
        const { data: rpcStats, error: rpcError } = await supabase.rpc('get_teacher_stats', { teacher_uuid: teacher.id });
        
        // Suppress individual teacher stats errors in console (expected if SQL not deployed)
        if (rpcError) {
          // Silent fallback to direct queries
        }
        
        let stats = {
          total_students: 0,
          total_lesson_plans: 0,
          total_assignments: 0,
          total_conversations: 0,
          total_messages: 0,
          total_resources: 0,
          total_announcements: 0,
        };
        
        if (!rpcError && rpcStats !== null && rpcStats.length > 0) {
          stats = rpcStats[0];
        } else {
          // Fallback to direct queries
          const [
            studentsCount, 
            lessonPlansCount, 
            assignmentsCount, 
            conversationsResult,
            resourcesCount,
            announcementsCount
          ] = await Promise.all([
            adminSupabase.from('students').select('*', { count: 'exact', head: true }).eq('teacher_id', teacher.id),
            adminSupabase.from('lesson_plans').select('*', { count: 'exact', head: true }).eq('user_id', teacher.id),
            adminSupabase.from('assignments').select('*', { count: 'exact', head: true }).eq('teacher_id', teacher.id),
            adminSupabase.from('conversations').select('id').eq('user_id', teacher.id),
            adminSupabase.from('resources').select('*', { count: 'exact', head: true }).eq('teacher_id', teacher.id),
            adminSupabase.from('announcements').select('*', { count: 'exact', head: true }).eq('teacher_id', teacher.id),
          ]);

          // Get total messages from all conversations
          let totalMessages = 0;
          const conversations = conversationsResult.data || [];
          if (conversations.length > 0) {
            const convoIds = conversations.map((c: any) => c.id);
            const { count } = await adminSupabase
              .from('conversation_messages')
              .select('*', { count: 'exact', head: true })
              .in('conversation_id', convoIds);
            totalMessages = count || 0;
          }
          
          stats = {
            total_students: studentsCount.count || 0,
            total_lesson_plans: lessonPlansCount.count || 0,
            total_assignments: assignmentsCount.count || 0,
            total_conversations: conversations.length,
            total_messages: totalMessages,
            total_resources: resourcesCount.count || 0,
            total_announcements: announcementsCount.count || 0,
          };
        }

        return {
          // All profile fields
          id: teacher.id,
          email: teacher.email || '',
          full_name: teacher.full_name || 'Unknown',
          gender: teacher.gender,
          country: teacher.country,
          city: teacher.city,
          school_name: teacher.school_name,
          school_address: teacher.school_address,
          school_type: teacher.school_type,
          number_of_students: teacher.number_of_students,
          subjects_taught: teacher.subjects_taught,
          grade_levels: teacher.grade_levels,
          years_of_experience: teacher.years_of_experience,
          education_level: teacher.education_level,
          phone_number: teacher.phone_number,
          whatsapp_number: teacher.whatsapp_number,
          bio: teacher.bio,
          date_of_birth: teacher.date_of_birth,
          avatar_url: teacher.avatar_url,
          preferred_language: teacher.preferred_language,
          // Timestamps
          created_at: teacher.created_at,
          updated_at: teacher.updated_at,
          last_login: teacher.updated_at,
          // Calculated stats (using stats object)
          total_students: Number(stats.total_students) || 0,
          total_lesson_plans: Number(stats.total_lesson_plans) || 0,
          total_assignments: Number(stats.total_assignments) || 0,
          total_chatbot_messages: Number(stats.total_messages) || 0,
          total_conversations: Number(stats.total_conversations) || 0,
          total_resources: Number(stats.total_resources) || 0,
          total_announcements: Number(stats.total_announcements) || 0,
          account_status: 'active' as const,
          login_count: 0,
          last_activity: teacher.updated_at,
        };
      })
    );

    return teacherStats;
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return [];
  }
};

/**
 * Get all students with their statistics
 */
export const getAllStudents = async (): Promise<StudentStats[]> => {
  try {
    // Try RPC function first (bypasses RLS)
    const { data: rpcStudents, error: rpcError } = await supabase.rpc('get_all_students_full');
    
    if (!rpcError && rpcStudents !== null) {
      console.log(`RPC: Found ${rpcStudents.length} students (bypassed RLS)`);
      
      // Get submission stats for each student
      const studentStats = await Promise.all(
        rpcStudents.map(async (student: any) => {
          const { data: submissions } = await adminSupabase
            .from('assignment_submissions')
            .select('score')
            .eq('student_id', student.id);

          const totalSubmissions = submissions?.length || 0;
          const gradedSubmissions = submissions?.filter((s: any) => s.score !== null) || [];
          const averageScore = gradedSubmissions.length > 0
            ? gradedSubmissions.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / gradedSubmissions.length
            : null;

          return {
            id: student.id,
            full_name: student.full_name || 'Unknown',
            grade_level: student.grade_level || 'N/A',
            teacher_id: student.teacher_id,
            teacher_name: student.teacher_name,
            created_at: student.created_at,
            account_status: student.account_status || 'active',
            total_submissions: totalSubmissions,
            average_score: averageScore,
            last_activity: student.updated_at,
          };
        })
      );
      return studentStats;
    }

    console.log('RPC not available, falling back to direct query');
    
    // Fallback to direct query
    const { data: students, error } = await adminSupabase
      .from('students')
      .select(`
        *,
        profiles:teacher_id ( full_name )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!students) return [];

    // Get submission stats for each student
    const studentStats = await Promise.all(
      students.map(async (student) => {
        const { data: submissions } = await adminSupabase
          .from('assignment_submissions')
          .select('score')
          .eq('student_id', student.id);

        const totalSubmissions = submissions?.length || 0;
        const gradedSubmissions = submissions?.filter(s => s.score !== null) || [];
        const averageScore = gradedSubmissions.length > 0
          ? gradedSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / gradedSubmissions.length
          : null;

        return {
          id: student.id,
          full_name: student.full_name,
          grade_level: student.grade_level,
          teacher_id: student.teacher_id,
          teacher_name: student.profiles?.full_name,
          created_at: student.created_at,
          account_status: student.account_status || 'active',
          total_submissions: totalSubmissions,
          average_score: averageScore,
          last_activity: student.updated_at,
        };
      })
    );

    return studentStats;
  } catch (error) {
    console.error('Error fetching students:', error);
    return [];
  }
};

/**
 * Get all lesson plans from the database
 */
export const getAllLessonPlans = async (): Promise<LessonPlanStats[]> => {
  try {
    // Try RPC function first (bypasses RLS)
    const { data: rpcPlans, error: rpcError } = await supabase.rpc('get_all_lesson_plans');
    
    if (!rpcError && rpcPlans !== null) {
      console.log(`RPC: Found ${rpcPlans.length} lesson plans (bypassed RLS)`);
      return rpcPlans.map((plan: any) => {
        // Content is a JSON blob containing topic, subject, etc.
        const content = plan.content || {};
        return {
          id: plan.id,
          title: plan.title || 'Untitled Lesson Plan',
          grade_level: plan.grade_level || 'N/A',
          subject: content.subject || 'Mathematics',
          teacher_id: plan.user_id,
          teacher_name: plan.teacher_name,
          created_at: plan.created_at,
          topic: content.topic || '',
        };
      });
    }

    console.log('RPC error or not available, falling back to direct query:', rpcError?.message);
    
    const { data, error } = await adminSupabase
      .from('lesson_plans')
      .select(`
        *,
        profiles:user_id ( full_name )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching lesson plans:', error.message);
      return [];
    }
    if (!data) return [];

    return data.map(plan => {
      const content = plan.content || {};
      return {
        id: plan.id,
        title: plan.title || 'Untitled Lesson Plan',
        grade_level: plan.level || 'N/A',
        subject: content.subject || 'Mathematics',
        teacher_id: plan.user_id,
        teacher_name: plan.profiles?.full_name,
        created_at: plan.created_at,
        topic: content.topic || '',
      };
    });
  } catch (error) {
    console.error('Error fetching lesson plans:', error);
    return [];
  }
};

/**
 * Get all chatbot conversations with message counts
 */
export const getAllChatConversations = async (): Promise<ChatbotStats[]> => {
  try {
    // Try RPC function first (bypasses RLS)
    const { data: rpcConvos, error: rpcError } = await supabase.rpc('get_all_conversations');
    
    if (!rpcError && rpcConvos !== null) {
      console.log(`RPC: Found ${rpcConvos.length} conversations (bypassed RLS)`);
      return rpcConvos.map((convo: any) => ({
        id: convo.id,
        user_id: convo.user_id,
        user_name: convo.teacher_name,
        title: convo.title || 'Untitled',
        grade: convo.grade || 'N/A',
        created_at: convo.created_at,
        updated_at: convo.updated_at,
        message_count: Number(convo.message_count) || 0,
      }));
    }

    console.log('RPC error or not available, falling back to direct query:', rpcError?.message);
    
    const { data: conversations, error } = await adminSupabase
      .from('conversations')
      .select(`
        *,
        profiles:user_id ( full_name )
      `)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    if (!conversations) return [];

    // Get message counts for each conversation
    const convoStats = await Promise.all(
      conversations.map(async (convo) => {
        const { count } = await adminSupabase
          .from('conversation_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', convo.id);

        return {
          id: convo.id,
          user_id: convo.user_id,
          user_name: convo.profiles?.full_name,
          title: convo.title,
          grade: convo.grade,
          created_at: convo.created_at,
          updated_at: convo.updated_at,
          message_count: count || 0,
        };
      })
    );

    return convoStats;
  } catch (error) {
    console.error('Error fetching chat conversations:', error);
    return [];
  }
};

/**
 * Get all assignments with statistics
 */
export const getAllAssignments = async (): Promise<AssignmentStats[]> => {
  try {
    // Try RPC function first (bypasses RLS)
    const { data: rpcAssignments, error: rpcError } = await supabase.rpc('get_all_assignments');
    
    if (!rpcError && rpcAssignments !== null) {
      console.log(`RPC: Found ${rpcAssignments.length} assignments (bypassed RLS)`);
      return rpcAssignments.map((a: any) => ({
        id: a.id,
        title: a.title || 'Untitled',
        description: a.description,
        subject: a.subject || 'N/A',
        grade_level: a.grade_level || 'N/A',
        teacher_id: a.teacher_id,
        teacher_name: a.teacher_name,
        due_date: a.due_date,
        status: a.status || 'active',
        created_at: a.created_at,
        total_students: Number(a.student_count) || 0,
        submitted_count: Number(a.submission_count) || 0,
        graded_count: 0,
        average_score: null,
      }));
    }

    console.log('RPC error or not available, falling back to direct query:', rpcError?.message);
    
    const { data: assignments, error } = await adminSupabase
      .from('assignments')
      .select(`
        *,
        profiles:teacher_id ( full_name )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!assignments) return [];

    // Get submission stats for each assignment
    const assignmentStats = await Promise.all(
      assignments.map(async (assignment) => {
        const [studentsCount, submissionsResult] = await Promise.all([
          adminSupabase.from('assignment_students').select('*', { count: 'exact', head: true }).eq('assignment_id', assignment.id),
          adminSupabase.from('assignment_submissions').select('score, status').eq('assignment_id', assignment.id),
        ]);

        const submissions = submissionsResult.data || [];
        const gradedSubmissions = submissions.filter(s => s.status === 'graded' && s.score !== null);
        const averageScore = gradedSubmissions.length > 0
          ? gradedSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / gradedSubmissions.length
          : null;

        return {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          subject: assignment.subject,
          grade_level: assignment.grade_level,
          teacher_id: assignment.teacher_id,
          teacher_name: assignment.profiles?.full_name,
          due_date: assignment.due_date,
          status: assignment.status,
          created_at: assignment.created_at,
          total_students: studentsCount.count || 0,
          submitted_count: submissions.length,
          graded_count: gradedSubmissions.length,
          average_score: averageScore,
        };
      })
    );

    return assignmentStats;
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return [];
  }
};

/**
 * Get all submissions
 */
export const getAllSubmissions = async (): Promise<SubmissionStats[]> => {
  try {
    // Try RPC function first (bypasses RLS)
    const { data: rpcSubs, error: rpcError } = await supabase.rpc('get_all_submissions');
    
    if (!rpcError && rpcSubs !== null) {
      console.log(`RPC: Found ${rpcSubs.length} submissions (bypassed RLS)`);
      return rpcSubs.map((sub: any) => ({
        id: sub.id,
        assignment_id: sub.assignment_id,
        assignment_title: sub.assignment_title || 'Unknown',
        student_id: sub.student_id,
        student_name: sub.student_name || 'Unknown',
        teacher_name: sub.teacher_name,
        status: sub.status || 'submitted',
        score: sub.score,
        ai_score: sub.ai_score,
        file_url: sub.file_url,
        submitted_at: sub.submitted_at,
        graded_at: sub.graded_at,
      }));
    }

    console.log('RPC error or not available, falling back to direct query:', rpcError?.message);
    
    const { data, error } = await adminSupabase
      .from('assignment_submissions')
      .select(`
        *,
        students ( full_name ),
        assignments ( title, teacher_id )
      `)
      .order('submitted_at', { ascending: false })
      .limit(500);

    if (error) throw error;
    if (!data) return [];

    // Get teacher names
    const teacherIds = [...new Set(data.map(s => s.assignments?.teacher_id).filter(Boolean))];
    const { data: teachers } = await adminSupabase
      .from('profiles')
      .select('id, full_name')
      .in('id', teacherIds);

    const teacherMap = new Map(teachers?.map(t => [t.id, t.full_name]) || []);

    return data.map(sub => ({
      id: sub.id,
      assignment_id: sub.assignment_id,
      assignment_title: sub.assignments?.title,
      student_id: sub.student_id,
      student_name: sub.students?.full_name,
      teacher_name: teacherMap.get(sub.assignments?.teacher_id),
      status: sub.status,
      score: sub.score,
      ai_score: sub.ai_score,
      file_url: sub.file_url,
      submitted_at: sub.submitted_at,
      graded_at: sub.graded_at,
    }));
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return [];
  }
};

/**
 * Get usage analytics data
 */
export const getUsageAnalytics = async (): Promise<UsageAnalytics> => {
  try {
    // Get data grouped by month for the past 12 months
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({
        month: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
        start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString(),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString(),
      });
    }

    // Fetch data for each month using adminSupabase
    const [lessonPlansByMonth, assignmentsByMonth, submissionsByMonth] = await Promise.all([
      Promise.all(months.map(async (m) => {
        const { count } = await adminSupabase
          .from('lesson_plans')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', m.start)
          .lte('created_at', m.end);
        return { month: m.month, count: count || 0 };
      })),
      Promise.all(months.map(async (m) => {
        const { count } = await adminSupabase
          .from('assignments')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', m.start)
          .lte('created_at', m.end);
        return { month: m.month, count: count || 0 };
      })),
      Promise.all(months.map(async (m) => {
        const { count } = await adminSupabase
          .from('assignment_submissions')
          .select('*', { count: 'exact', head: true })
          .gte('submitted_at', m.start)
          .lte('submitted_at', m.end);
        return { month: m.month, count: count || 0 };
      })),
    ]);

    // Get teachers by country - try RPC first
    let teachersByCountry: { country: string; count: number }[] = [];
    const { data: rpcTeachers } = await supabase.rpc('get_all_teachers');
    if (rpcTeachers && rpcTeachers.length > 0) {
      const countryCount: Record<string, number> = {};
      rpcTeachers.forEach((t: any) => {
        if (t.country) {
          countryCount[t.country] = (countryCount[t.country] || 0) + 1;
        }
      });
      teachersByCountry = Object.entries(countryCount)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count);
    } else {
      const { data: teacherCountries } = await adminSupabase
        .from('profiles')
        .select('country')
        .eq('role', 'teacher')
        .not('country', 'is', null);

      const countryCount: Record<string, number> = {};
      teacherCountries?.forEach(t => {
        if (t.country) {
          countryCount[t.country] = (countryCount[t.country] || 0) + 1;
        }
      });
      teachersByCountry = Object.entries(countryCount)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count);
    }

    // Get students by grade - try RPC first
    let studentsByGrade: { grade: string; count: number }[] = [];
    const { data: rpcStudents } = await supabase.rpc('get_all_students_full');
    if (rpcStudents && rpcStudents.length > 0) {
      const gradeCount: Record<string, number> = {};
      rpcStudents.forEach((s: any) => {
        if (s.grade_level) {
          gradeCount[s.grade_level] = (gradeCount[s.grade_level] || 0) + 1;
        }
      });
      studentsByGrade = Object.entries(gradeCount)
        .map(([grade, count]) => ({ grade, count }))
        .sort((a, b) => a.grade.localeCompare(b.grade));
    } else {
      const { data: studentGrades } = await adminSupabase
        .from('students')
        .select('grade_level');

      const gradeCount: Record<string, number> = {};
      studentGrades?.forEach(s => {
        gradeCount[s.grade_level] = (gradeCount[s.grade_level] || 0) + 1;
      });
      studentsByGrade = Object.entries(gradeCount)
        .map(([grade, count]) => ({ grade, count }))
        .sort((a, b) => a.grade.localeCompare(b.grade));
    }

    return {
      dailyActiveUsers: [],
      weeklyActiveUsers: [],
      monthlyActiveUsers: [],
      lessonPlansByMonth,
      assignmentsByMonth,
      chatMessagesByMonth: [],
      submissionsByMonth,
      teachersByCountry,
      studentsByGrade,
    };
  } catch (error) {
    console.error('Error fetching usage analytics:', error);
    return {
      dailyActiveUsers: [],
      weeklyActiveUsers: [],
      monthlyActiveUsers: [],
      lessonPlansByMonth: [],
      assignmentsByMonth: [],
      chatMessagesByMonth: [],
      submissionsByMonth: [],
      teachersByCountry: [],
      studentsByGrade: [],
    };
  }
};

/**
 * Update teacher account status
 */
export const updateTeacherStatus = async (
  teacherId: string, 
  status: 'active' | 'paused' | 'suspended'
): Promise<boolean> => {
  try {
    // Note: This would require adding an account_status column to profiles
    // For now, we'll just log the action
    console.log(`Updating teacher ${teacherId} status to ${status}`);
    return true;
  } catch (error) {
    console.error('Error updating teacher status:', error);
    return false;
  }
};

/**
 * Create a new teacher account (admin-initiated, pre-verified, no email confirmation required)
 */
export const createTeacherAccount = async (teacherData: {
  email: string;
  password: string;
  full_name: string;
  gender?: string;
  date_of_birth?: string;
  country?: string;
  city?: string;
  preferred_language?: string;
  bio?: string;
  school_name?: string;
  school_address?: string;
  school_type?: string;
  number_of_students?: number;
  subjects_taught?: string;
  grade_levels?: string;
  years_of_experience?: number;
  education_level?: string;
  phone_number?: string;
  whatsapp_number?: string;
}): Promise<{ success: boolean; userId?: string; error?: string }> => {
  try {
    // Build metadata (all fields passed through so the DB trigger can populate profiles)
    const metadata: Record<string, any> = {
      full_name: teacherData.full_name,
      role: 'teacher',
    };
    const optionalFields = [
      'gender','date_of_birth','country','city','preferred_language','bio',
      'school_name','school_address','school_type','number_of_students',
      'subjects_taught','grade_levels','years_of_experience','education_level',
      'phone_number','whatsapp_number',
    ] as const;
    optionalFields.forEach(k => {
      if (teacherData[k] !== undefined && teacherData[k] !== '') metadata[k] = teacherData[k];
    });

    // Create the auth user — email_confirm:true means no verification email is sent
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: teacherData.email,
      password: teacherData.password,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const userId = data.user?.id;
    if (!userId) {
      return { success: false, error: 'User created but no ID returned' };
    }

    // Upsert the profiles row directly so the profile is immediately available
    // even if the Postgres trigger hasn't run or doesn't exist.
    const profilePayload: Record<string, any> = {
      id: userId,
      email: teacherData.email,
      role: 'teacher',
      email_verified: true,
      account_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...metadata,
    };

    const { error: profileError } = await adminSupabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' });

    if (profileError) {
      // Log but don't fail — the trigger may have already created the row
      console.warn('Profile upsert warning (may already exist via trigger):', profileError.message);
    }

    return { success: true, userId };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create teacher account' };
  }
};

/**
 * Get all resources from the database
 */
export const getAllResources = async (): Promise<ResourceStats[]> => {
  try {
    // Try RPC function first (bypasses RLS)
    const { data: rpcResources, error: rpcError } = await supabase.rpc('get_all_resources');
    
    if (!rpcError && rpcResources !== null) {
      console.log(`RPC: Found ${rpcResources.length} resources (bypassed RLS)`);
      return rpcResources.map((resource: any) => ({
        id: resource.id,
        teacher_id: resource.teacher_id,
        teacher_name: resource.teacher_name,
        title: resource.title || 'Untitled',
        description: resource.description,
        file_url: resource.file_url,
        file_type: resource.file_type,
        topic: resource.topic,
        grade_level: resource.grade_level,
        is_public: resource.is_public || false,
        download_count: resource.download_count || 0,
        created_at: resource.created_at,
      }));
    }

    console.log('RPC error or not available, falling back to direct query:', rpcError?.message);
    
    const { data, error } = await adminSupabase
      .from('resources')
      .select(`
        *,
        profiles:teacher_id ( full_name )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching resources:', error.message);
      return [];
    }
    if (!data) return [];

    return data.map(resource => ({
      id: resource.id,
      teacher_id: resource.teacher_id,
      teacher_name: resource.profiles?.full_name,
      title: resource.title,
      description: resource.description,
      file_url: resource.file_url,
      file_type: resource.file_type,
      topic: resource.topic,
      grade_level: resource.grade_level,
      is_public: resource.is_public || false,
      download_count: resource.download_count || 0,
      created_at: resource.created_at,
    }));
  } catch (error) {
    console.error('Error fetching resources:', error);
    return [];
  }
};

/**
 * Get all student works (uploads from /dashboard/upload) from the database
 */
export const getAllStudentWorks = async (): Promise<StudentWorkStats[]> => {
  try {
    // Try RPC function first (bypasses RLS)
    console.log('Attempting to call get_all_student_works RPC...');
    const { data: rpcWorks, error: rpcError } = await supabase.rpc('get_all_student_works');
    
    if (rpcError) {
      console.warn('RPC get_all_student_works failed:', rpcError.message, rpcError.code);
      console.log('This usually means the SQL function has not been deployed. Please run supabase-admin-functions.sql in Supabase SQL Editor.');
    }
    
    if (!rpcError && rpcWorks !== null) {
      console.log(`RPC: Found ${rpcWorks.length} student works (bypassed RLS)`);
      return rpcWorks.map((work: any) => ({
        id: work.id,
        teacher_id: work.teacher_id || work.parent_id,
        teacher_name: work.teacher_name,
        student_name: work.student_name || 'Unknown',
        subject: work.subject,
        image_url: work.image_url,
        file_name: work.file_name,
        file_type: work.file_type,
        file_size: work.file_size,
        grade: work.grade,
        status: work.status,
        feedback: work.feedback,
        error_type: work.error_type,
        remediation: work.remediation,
        created_at: work.created_at,
      }));
    }

    console.log('Falling back to direct query with adminSupabase...');
    console.log('Has service role access:', !!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
    
    // Direct query without relationship join (no FK constraint on student_works)
    const { data, error } = await adminSupabase
      .from('student_works')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Direct query error:', error.message, error.code);
      console.log('If RLS error, make sure to deploy SQL functions or set VITE_SUPABASE_SERVICE_ROLE_KEY');
      return [];
    }
    if (!data) return [];
    
    console.log(`Direct query found ${data.length} student works`);

    // Get teacher names separately
    const teacherIds = [...new Set(data.map(w => w.teacher_id || w.parent_id).filter(Boolean))];
    let teacherMap: Record<string, string> = {};
    
    if (teacherIds.length > 0) {
      const { data: teachers } = await adminSupabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teacherIds);
      
      if (teachers) {
        teacherMap = teachers.reduce((acc, t) => {
          acc[t.id] = t.full_name;
          return acc;
        }, {} as Record<string, string>);
      }
    }

    return data.map(work => ({
      id: work.id,
      teacher_id: work.teacher_id || work.parent_id,
      teacher_name: teacherMap[work.teacher_id] || teacherMap[work.parent_id] || 'Unknown',
      student_name: work.student_name || 'Unknown',
      subject: work.subject,
      image_url: work.image_url,
      file_name: work.file_name,
      file_type: work.file_type,
      file_size: work.file_size,
      grade: work.grade,
      status: work.status,
      feedback: work.feedback,
      error_type: work.error_type,
      remediation: work.remediation,
      created_at: work.created_at,
    }));
  } catch (error) {
    console.error('Error fetching student works:', error);
    return [];
  }
};

/**
 * Get all announcements from the database
 */
export const getAllAnnouncements = async (): Promise<AnnouncementStats[]> => {
  try {
    // Try RPC function first (bypasses RLS)
    const { data: rpcAnnouncements, error: rpcError } = await supabase.rpc('get_all_announcements');
    
    if (!rpcError && rpcAnnouncements !== null) {
      console.log(`RPC: Found ${rpcAnnouncements.length} announcements (bypassed RLS)`);
      return rpcAnnouncements.map((announcement: any) => ({
        id: announcement.id,
        teacher_id: announcement.teacher_id,
        teacher_name: announcement.teacher_name,
        title: announcement.title || 'Untitled',
        // Support both old (content/target_audience) and new (message/target_grade_level) column names
        message: announcement.message || announcement.content || '',
        target_grade_level: announcement.target_grade_level || announcement.target_audience,
        target_class_name: announcement.target_class_name,
        is_pinned: announcement.is_pinned || false,
        priority: announcement.priority || 'normal',
        category: announcement.category,
        created_at: announcement.created_at,
        read_count: 0,
      }));
    }

    console.log('RPC error or not available, falling back to direct query:', rpcError?.message);
    
    // NOTE: announcements.teacher_id references auth.users, not profiles,
    // so PostgREST cannot auto-resolve the embedded join. Fetch separately.
    const { data: announcements, error } = await adminSupabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching announcements:', error.message);
      return [];
    }
    if (!announcements || announcements.length === 0) return [];

    // Fetch teacher names from profiles using teacher_ids
    const teacherIds = [...new Set(announcements.map(a => a.teacher_id).filter(Boolean))];
    let teacherNameMap: Record<string, string> = {};
    if (teacherIds.length > 0) {
      const { data: teachers } = await adminSupabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teacherIds);
      if (teachers) {
        teacherNameMap = teachers.reduce((acc, t) => {
          acc[t.id] = t.full_name;
          return acc;
        }, {} as Record<string, string>);
      }
    }

    // Get read counts for each announcement
    const announcementStats = await Promise.all(
      announcements.map(async (announcement) => {
        const { count } = await adminSupabase
          .from('announcement_reads')
          .select('*', { count: 'exact', head: true })
          .eq('announcement_id', announcement.id);

        return {
          id: announcement.id,
          teacher_id: announcement.teacher_id,
          teacher_name: teacherNameMap[announcement.teacher_id] || 'Unknown',
          title: announcement.title,
          message: announcement.message,
          target_grade_level: announcement.target_grade_level,
          target_class_name: announcement.target_class_name,
          is_pinned: announcement.is_pinned || false,
          priority: announcement.priority || 'normal',
          category: announcement.category,
          created_at: announcement.created_at,
          read_count: count || 0,
        };
      })
    );

    return announcementStats;
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return [];
  }
};

/**
 * Get all notifications from the database
 */
export const getAllNotifications = async (): Promise<NotificationStats[]> => {
  try {
    const { data, error } = await adminSupabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.warn('Error fetching notifications:', error.message);
      return [];
    }
    if (!data) return [];

    return data.map(notification => ({
      id: notification.id,
      recipient_student_id: notification.recipient_student_id,
      recipient_teacher_id: notification.recipient_teacher_id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      is_read: notification.is_read || false,
      created_at: notification.created_at,
    }));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

/**
 * Get all assignment comments from the database
 */
export const getAllComments = async (): Promise<CommentStats[]> => {
  try {
    // Try RPC function first (bypasses RLS)
    const { data: rpcComments, error: rpcError } = await supabase.rpc('get_all_comments');
    
    if (!rpcError && rpcComments !== null) {
      console.log(`RPC: Found ${rpcComments.length} comments (bypassed RLS)`);
      return rpcComments.map((comment: any) => ({
        id: comment.id,
        assignment_id: comment.assignment_id,
        assignment_title: comment.assignment_title,
        student_id: comment.student_id,
        student_name: comment.student_name,
        teacher_id: comment.teacher_id,
        teacher_name: comment.teacher_name,
        message: comment.message || '',
        is_private: comment.is_private || false,
        created_at: comment.created_at,
      }));
    }

    console.log('RPC error or not available, falling back to direct query:', rpcError?.message);
    
    const { data, error } = await adminSupabase
      .from('assignment_comments')
      .select(`
        *,
        students ( full_name ),
        assignments ( title ),
        profiles:teacher_id ( full_name )
      `)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.warn('Error fetching comments:', error.message);
      return [];
    }
    if (!data) return [];

    return data.map(comment => ({
      id: comment.id,
      assignment_id: comment.assignment_id,
      assignment_title: comment.assignments?.title,
      student_id: comment.student_id,
      student_name: comment.students?.full_name,
      teacher_id: comment.teacher_id,
      teacher_name: comment.profiles?.full_name,
      message: comment.message,
      is_private: comment.is_private || false,
      created_at: comment.created_at,
    }));
  } catch (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
};

/**
 * Get all conversation messages from the database
 */
export const getAllConversationMessages = async (): Promise<ConversationMessageStats[]> => {
  try {
    // Try RPC function first (bypasses RLS)
    const { data: rpcMessages, error: rpcError } = await supabase.rpc('get_all_messages');
    
    if (!rpcError && rpcMessages !== null) {
      console.log(`RPC: Found ${rpcMessages.length} messages (bypassed RLS)`);
      return rpcMessages.map((message: any) => ({
        id: message.id,
        conversation_id: message.conversation_id,
        role: message.role,
        content: message.content || '',
        image_url: null,
        rating: null,
        bookmarked: false,
        created_at: message.created_at,
        user_name: message.teacher_name,
      }));
    }

    console.log('RPC error or not available, falling back to direct query:', rpcError?.message);
    
    const { data: messages, error } = await adminSupabase
      .from('conversation_messages')
      .select(`
        *,
        conversations ( user_id, title )
      `)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.warn('Error fetching conversation messages:', error.message);
      return [];
    }
    if (!messages) return [];

    // Get user names for the conversations
    const userIds = [...new Set(messages.map(m => m.conversations?.user_id).filter(Boolean))];
    const { data: users } = await adminSupabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    const userMap = new Map(users?.map(u => [u.id, u.full_name]) || []);

    return messages.map(message => ({
      id: message.id,
      conversation_id: message.conversation_id,
      role: message.role,
      content: message.content,
      image_url: message.image_url,
      rating: message.rating,
      bookmarked: message.bookmarked,
      created_at: message.created_at,
      user_name: userMap.get(message.conversations?.user_id),
    }));
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    return [];
  }
};

/**
 * Get comprehensive platform statistics
 */
export const getPlatformStatistics = async () => {
  try {
    const [
      overview,
      teachers,
      students,
      lessonPlans,
      assignments,
      submissions,
      conversations,
      resources,
      announcements,
    ] = await Promise.all([
      getAdminDashboardOverview(),
      getAllTeachers(),
      getAllStudents(),
      getAllLessonPlans(),
      getAllAssignments(),
      getAllSubmissions(),
      getAllChatConversations(),
      getAllResources(),
      getAllAnnouncements(),
    ]);

    return {
      overview,
      teachers,
      students,
      lessonPlans,
      assignments,
      submissions,
      conversations,
      resources,
      announcements,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error fetching platform statistics:', error);
    return null;
  }
};

/**
 * Export all data as JSON for backup
 */
export const exportAllData = async () => {
  try {
    const allData = await getPlatformStatistics();
    return JSON.stringify(allData, null, 2);
  } catch (error) {
    console.error('Error exporting data:', error);
    return null;
  }
};

/**
 * Activity item for user activity tracking
 */
export interface ActivityItem {
  id: string;
  type: 'teacher_signup' | 'student_created' | 'lesson_plan' | 'assignment' | 'submission' | 'chat';
  description: string;
  user_name?: string;
  created_at: string;
}

/**
 * Get recent user activity across the platform
 */
export const getUserActivity = async (): Promise<ActivityItem[]> => {
  try {
    const allActivities: ActivityItem[] = [];

    // Get teachers using RPC or admin client
    const { data: rpcTeachers } = await supabase.rpc('get_all_teachers');
    let teachers: any[] = [];
    
    if (rpcTeachers && rpcTeachers.length > 0) {
      teachers = rpcTeachers;
    } else {
      const { data } = await adminSupabase
        .from('profiles')
        .select('id, full_name, created_at')
        .eq('role', 'teacher')
        .order('created_at', { ascending: false })
        .limit(20);
      teachers = data || [];
    }
    
    teachers.forEach(teacher => {
      allActivities.push({
        id: `teacher-${teacher.id}`,
        type: 'teacher_signup',
        description: `New teacher registered: ${teacher.full_name}`,
        user_name: teacher.full_name,
        created_at: teacher.created_at,
      });
    });

    // Get students using RPC or admin client
    const { data: rpcStudents } = await supabase.rpc('get_all_students_full');
    let students: any[] = [];
    
    if (rpcStudents && rpcStudents.length > 0) {
      students = rpcStudents.slice(0, 20);
    } else {
      const { data } = await adminSupabase
        .from('students')
        .select('id, full_name, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      students = data || [];
    }
    
    students.forEach(student => {
      allActivities.push({
        id: `student-${student.id}`,
        type: 'student_created',
        description: `New student created: ${student.full_name}`,
        user_name: student.full_name,
        created_at: student.created_at,
      });
    });

    // Get lesson plans using RPC or admin client
    const { data: rpcPlans } = await supabase.rpc('get_all_lesson_plans');
    let lessonPlans: any[] = [];
    
    if (rpcPlans !== null) {
      lessonPlans = rpcPlans.slice(0, 20);
    } else {
      const { data } = await adminSupabase
        .from('lesson_plans')
        .select('id, title, created_at, profiles:user_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(20);
      lessonPlans = data || [];
    }
    
    lessonPlans.forEach((plan: any) => {
      allActivities.push({
        id: `lesson-${plan.id}`,
        type: 'lesson_plan',
        description: `Lesson plan created: "${plan.title}"`,
        user_name: plan.teacher_name || plan.profiles?.full_name,
        created_at: plan.created_at,
      });
    });

    // Get assignments using RPC or admin client
    const { data: rpcAssignments } = await supabase.rpc('get_all_assignments');
    let assignments: any[] = [];
    
    if (rpcAssignments && rpcAssignments.length > 0) {
      assignments = rpcAssignments.slice(0, 20);
    } else {
      const { data } = await adminSupabase
        .from('assignments')
        .select('id, title, created_at, profiles:teacher_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(20);
      assignments = data || [];
    }
    
    assignments.forEach((assignment: any) => {
      allActivities.push({
        id: `assignment-${assignment.id}`,
        type: 'assignment',
        description: `Assignment created: "${assignment.title}"`,
        user_name: assignment.teacher_name || assignment.profiles?.full_name,
        created_at: assignment.created_at,
      });
    });

    // Get submissions using RPC or admin client
    const { data: rpcSubs } = await supabase.rpc('get_all_submissions');
    let submissions: any[] = [];
    
    if (rpcSubs && rpcSubs.length > 0) {
      submissions = rpcSubs.slice(0, 20);
    } else {
      const { data } = await adminSupabase
        .from('assignment_submissions')
        .select('id, submitted_at, students(full_name), assignments(title)')
        .order('submitted_at', { ascending: false })
        .limit(20);
      submissions = data || [];
    }
    
    submissions.forEach((submission: any) => {
      allActivities.push({
        id: `submission-${submission.id}`,
        type: 'submission',
        description: `Submitted: "${submission.assignment_title || submission.assignments?.title || 'Assignment'}"`,
        user_name: submission.student_name || submission.students?.full_name,
        created_at: submission.submitted_at,
      });
    });

    // Sort by date descending
    allActivities.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return allActivities.slice(0, 100);
  } catch (error) {
    console.error('Error fetching user activity:', error);
    return [];
  }
};

/**
 * Get students count per teacher
 */
export const getStudentsPerTeacher = async (): Promise<{ teacherId: string; teacherName: string; studentCount: number; schoolName: string | null }[]> => {
  try {
    // Get all teachers with RPC or direct query
    const { data: rpcTeachers } = await supabase.rpc('get_all_teachers');
    let teachers: any[] = [];
    
    if (rpcTeachers && rpcTeachers.length > 0) {
      teachers = rpcTeachers;
    } else {
      const { data } = await adminSupabase
        .from('profiles')
        .select('id, full_name, school_name')
        .eq('role', 'teacher');
      teachers = data || [];
    }

    // Get student counts per teacher using RPC or direct query
    const { data: rpcStudents } = await supabase.rpc('get_all_students_full');
    
    if (rpcStudents && rpcStudents.length > 0) {
      const countMap = new Map<string, number>();
      rpcStudents.forEach((s: any) => {
        const count = countMap.get(s.teacher_id) || 0;
        countMap.set(s.teacher_id, count + 1);
      });

      return teachers.map((t: any) => ({
        teacherId: t.id,
        teacherName: t.full_name || 'Unknown',
        studentCount: countMap.get(t.id) || 0,
        schoolName: t.school_name,
      })).sort((a, b) => b.studentCount - a.studentCount);
    }

    // Fallback to direct query
    const results = await Promise.all(
      teachers.map(async (teacher: any) => {
        const { count } = await adminSupabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', teacher.id);
        
        return {
          teacherId: teacher.id,
          teacherName: teacher.full_name || 'Unknown',
          studentCount: count || 0,
          schoolName: teacher.school_name,
        };
      })
    );

    return results.sort((a, b) => b.studentCount - a.studentCount);
  } catch (error) {
    console.error('Error fetching students per teacher:', error);
    return [];
  }
};

/**
 * Get lesson plans count per teacher
 */
export const getLessonPlansByTeacher = async (): Promise<{ teacherId: string; teacherName: string; lessonPlanCount: number }[]> => {
  try {
    const { data: rpcPlans } = await supabase.rpc('get_all_lesson_plans');
    const { data: rpcTeachers } = await supabase.rpc('get_all_teachers');

    if (rpcPlans && rpcPlans.length > 0 && rpcTeachers && rpcTeachers.length > 0) {
      const countMap = new Map<string, number>();
      rpcPlans.forEach((p: any) => {
        const userId = p.user_id || p.teacher_id;
        const count = countMap.get(userId) || 0;
        countMap.set(userId, count + 1);
      });

      return rpcTeachers.map((t: any) => ({
        teacherId: t.id,
        teacherName: t.full_name || 'Unknown',
        lessonPlanCount: countMap.get(t.id) || 0,
      })).filter((t: any) => t.lessonPlanCount > 0).sort((a: any, b: any) => b.lessonPlanCount - a.lessonPlanCount);
    }

    // Fallback to direct query
    const { data: teachers } = await adminSupabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'teacher');

    const results = await Promise.all(
      (teachers || []).map(async (teacher) => {
        const { count } = await adminSupabase
          .from('lesson_plans')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', teacher.id);
        
        return {
          teacherId: teacher.id,
          teacherName: teacher.full_name || 'Unknown',
          lessonPlanCount: count || 0,
        };
      })
    );

    return results.filter(t => t.lessonPlanCount > 0).sort((a, b) => b.lessonPlanCount - a.lessonPlanCount);
  } catch (error) {
    console.error('Error fetching lesson plans by teacher:', error);
    return [];
  }
};

/**
 * Get all schools with their statistics
 */
export const getAllSchools = async (): Promise<{ name: string; type: string | null; city: string | null; country: string | null; teacherCount: number; studentCount: number }[]> => {
  try {
    const { data: rpcTeachers } = await supabase.rpc('get_all_teachers');
    const { data: rpcStudents } = await supabase.rpc('get_all_students_full');

    let teachers: any[] = [];
    let students: any[] = [];

    if (rpcTeachers && rpcTeachers.length > 0) {
      teachers = rpcTeachers;
    } else {
      const { data } = await adminSupabase
        .from('profiles')
        .select('id, school_name, school_type, city, country')
        .eq('role', 'teacher');
      teachers = data || [];
    }

    if (rpcStudents && rpcStudents.length > 0) {
      students = rpcStudents;
    } else {
      const { data } = await adminSupabase.from('students').select('id, teacher_id');
      students = data || [];
    }

    // Create teacher-to-school mapping
    const teacherSchoolMap = new Map<string, string>();
    teachers.forEach((t: any) => {
      if (t.school_name) {
        teacherSchoolMap.set(t.id, t.school_name);
      }
    });

    // Aggregate schools
    const schoolMap = new Map<string, { name: string; type: string | null; city: string | null; country: string | null; teacherIds: Set<string>; studentCount: number }>();

    teachers.forEach((t: any) => {
      const schoolName = t.school_name || 'Unknown School';
      if (!schoolMap.has(schoolName)) {
        schoolMap.set(schoolName, {
          name: schoolName,
          type: t.school_type || null,
          city: t.city || null,
          country: t.country || null,
          teacherIds: new Set(),
          studentCount: 0,
        });
      }
      schoolMap.get(schoolName)!.teacherIds.add(t.id);
    });

    // Count students per school
    students.forEach((s: any) => {
      const schoolName = teacherSchoolMap.get(s.teacher_id) || 'Unknown School';
      if (schoolMap.has(schoolName)) {
        schoolMap.get(schoolName)!.studentCount++;
      }
    });

    return Array.from(schoolMap.values()).map(school => ({
      name: school.name,
      type: school.type,
      city: school.city,
      country: school.country,
      teacherCount: school.teacherIds.size,
      studentCount: school.studentCount,
    })).filter(s => s.name !== 'Unknown School').sort((a, b) => b.teacherCount - a.teacherCount);
  } catch (error) {
    console.error('Error fetching schools:', error);
    return [];
  }
};

/**
 * Get teachers by country distribution
 */
export const getTeachersByCountry = async (): Promise<{ country: string; count: number }[]> => {
  try {
    const { data: rpcTeachers } = await supabase.rpc('get_all_teachers');
    let teachers: any[] = [];

    if (rpcTeachers && rpcTeachers.length > 0) {
      teachers = rpcTeachers;
    } else {
      const { data } = await adminSupabase
        .from('profiles')
        .select('country')
        .eq('role', 'teacher');
      teachers = data || [];
    }

    const countryCount = new Map<string, number>();
    teachers.forEach((t: any) => {
      const country = t.country || 'Unknown';
      countryCount.set(country, (countryCount.get(country) || 0) + 1);
    });

    return Array.from(countryCount.entries())
      .map(([country, count]) => ({ country, count }))
      .filter(c => c.country !== 'Unknown')
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error('Error fetching teachers by country:', error);
    return [];
  }
};

/**
 * Get images generated by each teacher
 */
export const getImagesGeneratedByTeacher = async (): Promise<{ teacherId: string; teacherName: string; imageCount: number }[]> => {
  try {
    const { data: rpcTeachers } = await supabase.rpc('get_all_teachers');
    let teachers: any[] = [];

    if (rpcTeachers && rpcTeachers.length > 0) {
      teachers = rpcTeachers;
    } else {
      const { data } = await adminSupabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'teacher');
      teachers = data || [];
    }

    // Get image counts - try RPC first then adminSupabase
    const { data: rpcImages, error: rpcError } = await supabase.rpc('get_all_images');
    
    if (!rpcError && rpcImages && rpcImages.length > 0) {
      const countMap = new Map<string, number>();
      rpcImages.forEach((img: any) => {
        const count = countMap.get(img.user_id) || 0;
        countMap.set(img.user_id, count + 1);
      });

      return teachers.map((t: any) => ({
        teacherId: t.id,
        teacherName: t.full_name || 'Unknown',
        imageCount: countMap.get(t.id) || 0,
      })).filter(t => t.imageCount > 0).sort((a, b) => b.imageCount - a.imageCount);
    }

    // Fallback to direct query
    const results = await Promise.all(
      teachers.map(async (teacher: any) => {
        const { count } = await adminSupabase
          .from('generated_images')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', teacher.id);
        
        return {
          teacherId: teacher.id,
          teacherName: teacher.full_name || 'Unknown',
          imageCount: count || 0,
        };
      })
    );

    return results.filter(t => t.imageCount > 0).sort((a, b) => b.imageCount - a.imageCount);
  } catch (error) {
    console.error('Error fetching images by teacher:', error);
    return [];
  }
};

/**
 * Get total generated images count
 */
export const getTotalImagesGenerated = async (): Promise<number> => {
  try {
    const { data: rpcImages } = await supabase.rpc('get_all_images');
    if (rpcImages && rpcImages.length > 0) {
      return rpcImages.length;
    }

    const { count } = await adminSupabase
      .from('generated_images')
      .select('*', { count: 'exact', head: true });
    
    return count || 0;
  } catch (error) {
    console.error('Error fetching total images:', error);
    return 0;
  }
};

/**
 * Get chat input vs response statistics including AI words generated
 */
export const getChatInputResponseStats = async (): Promise<{ totalInputs: number; totalResponses: number; aiWordsGenerated: number }> => {
  try {
    // Try the comprehensive admin counts RPC first (includes word count)
    const { data: rpcCounts, error: rpcError } = await supabase.rpc('get_comprehensive_admin_counts');
    
    if (!rpcError && rpcCounts !== null && rpcCounts.length > 0) {
      const counts = rpcCounts[0];
      return {
        totalInputs: Number(counts.user_messages_count) || 0,
        totalResponses: Number(counts.assistant_messages_count) || 0,
        aiWordsGenerated: Number(counts.ai_words_generated) || 0,
      };
    }

    // Fallback: Get messages and calculate manually
    const { data: rpcMessages } = await supabase.rpc('get_all_messages');
    
    if (rpcMessages && rpcMessages.length > 0) {
      const inputs = rpcMessages.filter((m: any) => m.role === 'user').length;
      const responses = rpcMessages.filter((m: any) => m.role === 'assistant');
      const wordCount = responses.reduce((acc: number, m: any) => {
        const content = m.content || '';
        const words = content.split(/\s+/).filter((w: string) => w.length > 0).length;
        return acc + words;
      }, 0);
      return { totalInputs: inputs, totalResponses: responses.length, aiWordsGenerated: wordCount };
    }

    // Fallback to direct queries
    const [userCount, assistantCount] = await Promise.all([
      adminSupabase.from('conversation_messages').select('*', { count: 'exact', head: true }).eq('role', 'user'),
      adminSupabase.from('conversation_messages').select('*', { count: 'exact', head: true }).eq('role', 'assistant'),
    ]);

    return {
      totalInputs: userCount.count || 0,
      totalResponses: assistantCount.count || 0,
      aiWordsGenerated: 0, // Can't calculate without fetching all content
    };
  } catch (error) {
    console.error('Error fetching chat stats:', error);
    return { totalInputs: 0, totalResponses: 0, aiWordsGenerated: 0 };
  }
};

/**
 * Get activity trends over the last 30 days
 */
export const getActivityTrends = async (): Promise<{ date: string; lessonPlans: number; assignments: number; submissions: number; messages: number }[]> => {
  try {
    const trends: { date: string; lessonPlans: number; assignments: number; submissions: number; messages: number }[] = [];
    
    // Get last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const startOfDay = `${dateStr}T00:00:00.000Z`;
      const endOfDay = `${dateStr}T23:59:59.999Z`;

      const [lpCount, assignCount, subCount, msgCount] = await Promise.all([
        adminSupabase.from('lesson_plans').select('*', { count: 'exact', head: true }).gte('created_at', startOfDay).lte('created_at', endOfDay),
        adminSupabase.from('assignments').select('*', { count: 'exact', head: true }).gte('created_at', startOfDay).lte('created_at', endOfDay),
        adminSupabase.from('assignment_submissions').select('*', { count: 'exact', head: true }).gte('submitted_at', startOfDay).lte('submitted_at', endOfDay),
        adminSupabase.from('conversation_messages').select('*', { count: 'exact', head: true }).gte('created_at', startOfDay).lte('created_at', endOfDay),
      ]);

      trends.push({
        date: dateStr,
        lessonPlans: lpCount.count || 0,
        assignments: assignCount.count || 0,
        submissions: subCount.count || 0,
        messages: msgCount.count || 0,
      });
    }

    return trends;
  } catch (error) {
    console.error('Error fetching activity trends:', error);
    return [];
  }
};

/**
 * Get comprehensive admin statistics for the dashboard
 */
export const getComprehensiveAdminStats = async () => {
  try {
    const [
      overview,
      studentsPerTeacher,
      lessonPlansByTeacher,
      schools,
      teachersByCountry,
      imagesGeneratedByTeacher,
      activityTrends,
      chatStats,
      totalImages,
    ] = await Promise.all([
      getAdminDashboardOverview(),
      getStudentsPerTeacher(),
      getLessonPlansByTeacher(),
      getAllSchools(),
      getTeachersByCountry(),
      getImagesGeneratedByTeacher(),
      getActivityTrends(),
      getChatInputResponseStats(),
      getTotalImagesGenerated(),
    ]);

    // Enhance overview with additional stats
    const enhancedOverview = {
      ...overview,
      totalImagesGenerated: totalImages,
      totalChatInputs: chatStats.totalInputs,
      totalChatResponses: chatStats.totalResponses,
      dailyActiveUsers: overview.activeTeachersToday,
      weeklyActiveUsers: overview.activeTeachersThisWeek,
      monthlyActiveUsers: overview.activeTeachersThisMonth,
      aiWordsGenerated: chatStats.aiWordsGenerated,
    };

    return {
      overview: enhancedOverview,
      studentsPerTeacher,
      lessonPlansByTeacher,
      schools,
      teachersByCountry,
      activityTrends,
      imagesGeneratedByTeacher,
    };
  } catch (error) {
    console.error('Error fetching comprehensive admin stats:', error);
    return null;
  }
};

/**
 * Image stats interface
 */
export interface ImageStats {
  id: string;
  user_id: string;
  user_name: string;
  prompt: string;
  enhanced_prompt?: string;
  aspect_ratio: string;
  style?: string;
  image_url: string;
  is_favorite: boolean;
  created_at: string;
}

/**
 * Get all generated images with details
 */
export const getAllImages = async (): Promise<ImageStats[]> => {
  try {
    // Try RPC function first (bypasses RLS)
    const { data: rpcImages, error: rpcError } = await supabase.rpc('get_all_images');
    
    if (!rpcError && rpcImages !== null) {
      console.log(`RPC: Found ${rpcImages.length} images (bypassed RLS)`);
      return rpcImages.map((img: any) => ({
        id: img.id,
        user_id: img.user_id,
        user_name: img.user_name || 'Unknown',
        prompt: img.prompt || '',
        enhanced_prompt: img.enhanced_prompt,
        aspect_ratio: img.aspect_ratio || '1:1',
        style: img.style,
        image_url: img.image_url,
        is_favorite: img.is_favorite || false,
        created_at: img.created_at,
      }));
    }

    console.log('RPC error or not available, falling back to direct query:', rpcError?.message);
    
    // Fallback to direct query
    const { data, error } = await adminSupabase
      .from('generated_images')
      .select(`
        *,
        profiles:user_id ( full_name )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching images:', error.message);
      return [];
    }
    if (!data) return [];

    return data.map(img => ({
      id: img.id,
      user_id: img.user_id,
      user_name: img.profiles?.full_name || 'Unknown',
      prompt: img.prompt || '',
      enhanced_prompt: img.enhanced_prompt,
      aspect_ratio: img.aspect_ratio || '1:1',
      style: img.style,
      image_url: img.image_url,
      is_favorite: img.is_favorite || false,
      created_at: img.created_at,
    }));
  } catch (error) {
    console.error('Error fetching images:', error);
    return [];
  }
};

// ============================================================
// ENHANCED ADMIN SERVICE FUNCTIONS
// ============================================================

import type {
  GrowthMetric,
  ComparisonData,
  SupportTicket,
  SupportTicketStats,
  TicketResponse,
  ContentFlag,
  ModerationStats,
  DataRequest,
  EngagementMetric,
  GradeDistribution,
  AIvsHumanGrading,
  AdminAuditLog,
  AdminNotificationItem,
} from '@/types/admin';

/**
 * Get growth metrics over time
 */
export const getGrowthMetrics = async (daysBack: number = 30): Promise<GrowthMetric[]> => {
  try {
    const { data, error } = await supabase.rpc('get_growth_metrics', { days_back: daysBack });
    
    if (error) {
      console.warn('Error fetching growth metrics:', error.message);
      return [];
    }
    
    return (data || []).map((d: any) => ({
      metric_date: d.metric_date,
      new_teachers: Number(d.new_teachers) || 0,
      new_students: Number(d.new_students) || 0,
      new_lesson_plans: Number(d.new_lesson_plans) || 0,
      new_conversations: Number(d.new_conversations) || 0,
      new_messages: Number(d.new_messages) || 0,
      new_assignments: Number(d.new_assignments) || 0,
      new_images: Number(d.new_images) || 0,
    }));
  } catch (error) {
    console.error('Error fetching growth metrics:', error);
    return [];
  }
};

/**
 * Get comparison metrics (current vs previous period)
 */
export const getComparisonMetrics = async (periodDays: number = 7): Promise<ComparisonData[]> => {
  try {
    const { data, error } = await supabase.rpc('get_comparison_metrics', { period_days: periodDays });
    
    if (error) {
      console.warn('Error fetching comparison metrics:', error.message);
      return [];
    }
    
    return (data || []).map((d: any) => ({
      metric_name: d.metric_name,
      current_value: Number(d.current_value) || 0,
      previous_value: Number(d.previous_value) || 0,
      change_percent: Number(d.change_percent) || 0,
      change_direction: d.change_direction as 'up' | 'down' | 'stable',
    }));
  } catch (error) {
    console.error('Error fetching comparison metrics:', error);
    return [];
  }
};

/**
 * Get all support tickets
 */
export const getAllSupportTickets = async (): Promise<SupportTicket[]> => {
  try {
    const { data, error } = await supabase.rpc('get_all_support_tickets');
    
    if (error) {
      console.warn('Error fetching support tickets:', error.message);
      return [];
    }
    
    return (data || []).map((t: any) => ({
      id: t.id,
      user_id: t.user_id,
      user_name: t.user_name || 'Unknown',
      user_email: t.user_email || '',
      subject: t.subject,
      description: t.description,
      category: t.category,
      priority: t.priority,
      status: t.status,
      assigned_to: t.assigned_to,
      response_count: 0,
      created_at: t.created_at,
      updated_at: t.updated_at,
      resolved_at: t.resolved_at,
      first_response_at: t.first_response_at,
    }));
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    return [];
  }
};

/**
 * Get support ticket statistics
 */
export const getSupportTicketStats = async (): Promise<SupportTicketStats | null> => {
  try {
    const { data, error } = await supabase.rpc('get_support_ticket_stats');
    
    if (error || !data || data.length === 0) {
      return {
        total_tickets: 0,
        open_tickets: 0,
        in_progress_tickets: 0,
        resolved_tickets: 0,
        avg_resolution_hours: 0,
        avg_first_response_hours: 0,
        tickets_by_category: {},
        tickets_by_priority: {},
      };
    }
    
    const stats = data[0];
    return {
      total_tickets: Number(stats.total_tickets) || 0,
      open_tickets: Number(stats.open_tickets) || 0,
      in_progress_tickets: Number(stats.in_progress_tickets) || 0,
      resolved_tickets: Number(stats.resolved_tickets) || 0,
      avg_resolution_hours: Number(stats.avg_resolution_hours) || 0,
      avg_first_response_hours: Number(stats.avg_first_response_hours) || 0,
      tickets_by_category: stats.tickets_by_category || {},
      tickets_by_priority: stats.tickets_by_priority || {},
    };
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    return null;
  }
};

/**
 * Create a support ticket
 */
export const createSupportTicket = async (
  userId: string | null,
  subject: string,
  description: string,
  category: string = 'general',
  priority: string = 'medium'
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('create_support_ticket', {
      p_user_id: userId,
      p_subject: subject,
      p_description: description,
      p_category: category,
      p_priority: priority,
    });
    
    if (error) {
      console.error('Error creating ticket:', error.message);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error creating ticket:', error);
    return null;
  }
};

/**
 * Update support ticket status
 */
export const updateTicketStatus = async (
  ticketId: string,
  status: string,
  resolution?: string,
  assignedTo?: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('update_ticket_status', {
      p_ticket_id: ticketId,
      p_status: status,
      p_resolution: resolution,
      p_assigned_to: assignedTo,
    });
    
    if (error) {
      console.error('Error updating ticket:', error.message);
      return false;
    }
    
    return data === true;
  } catch (error) {
    console.error('Error updating ticket:', error);
    return false;
  }
};

/**
 * Get ticket responses/conversation thread
 */
export const getTicketResponses = async (
  ticketId: string,
  includeInternal: boolean = false
): Promise<TicketResponse[]> => {
  try {
    const { data, error } = await supabase.rpc('get_ticket_responses', {
      p_ticket_id: ticketId,
      p_include_internal: includeInternal,
    });
    
    if (error) {
      console.warn('Error fetching ticket responses:', error.message);
      return [];
    }
    
    return (data || []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      user_name: r.user_name,
      user_role: r.user_role,
      message: r.message,
      is_internal: r.is_internal,
      created_at: r.created_at,
    }));
  } catch (error) {
    console.error('Error fetching ticket responses:', error);
    return [];
  }
};

/**
 * Add a response to a support ticket
 * @param isAdminResponse - Set to true when admin is responding from the admin dashboard
 */
export const addTicketResponse = async (
  ticketId: string,
  message: string,
  isInternal: boolean = false,
  isAdminResponse: boolean = false
): Promise<string | null> => {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user');
      return null;
    }

    if (isAdminResponse) {
      // Use the RPC function with explicit admin role override
      const { data, error } = await supabase.rpc('add_admin_ticket_response', {
        p_ticket_id: ticketId,
        p_user_id: user.id,
        p_message: message,
        p_is_internal: isInternal,
      });
      
      if (error) {
        console.error('Error adding admin ticket response:', error.message);
        return null;
      }
      
      return data;
    } else {
      // User response - use the regular RPC function
      const { data, error } = await supabase.rpc('add_ticket_response', {
        p_ticket_id: ticketId,
        p_user_id: user.id,
        p_message: message,
        p_is_internal: isInternal,
      });
      
      if (error) {
        console.error('Error adding ticket response:', error.message);
        return null;
      }
      
      return data;
    }
  } catch (error) {
    console.error('Error adding ticket response:', error);
    return null;
  }
};

/**
 * Get support tickets for a specific user
 */
export const getUserSupportTickets = async (
  userId: string
): Promise<SupportTicket[]> => {
  try {
    const { data, error } = await supabase.rpc('get_user_support_tickets', {
      p_user_id: userId,
    });
    
    if (error) {
      console.warn('Error fetching user tickets:', error.message);
      return [];
    }
    
    return (data || []).map((t: any) => ({
      id: t.id,
      subject: t.subject,
      description: t.description,
      category: t.category,
      priority: t.priority,
      status: t.status,
      resolution: t.resolution,
      response_count: Number(t.response_count) || 0,
      created_at: t.created_at,
      updated_at: t.updated_at,
      resolved_at: t.resolved_at,
    }));
  } catch (error) {
    console.error('Error fetching user tickets:', error);
    return [];
  }
};

/**
 * Get all content flags
 */
export const getAllContentFlags = async (): Promise<ContentFlag[]> => {
  try {
    const { data, error } = await supabase.rpc('get_all_content_flags');
    
    if (error) {
      console.warn('Error fetching content flags:', error.message);
      return [];
    }
    
    return (data || []).map((f: any) => ({
      id: f.id,
      content_type: f.content_type,
      content_id: f.content_id,
      content_preview: f.content_preview,
      flagged_by: f.flagged_by,
      flag_reason: f.flag_reason,
      severity: f.severity,
      status: f.status,
      reviewed_by: f.reviewed_by,
      review_notes: f.review_notes,
      created_at: f.created_at,
      reviewed_at: f.reviewed_at,
    }));
  } catch (error) {
    console.error('Error fetching content flags:', error);
    return [];
  }
};

/**
 * Get moderation statistics
 */
export const getModerationStats = async (): Promise<ModerationStats | null> => {
  try {
    const { data, error } = await supabase.rpc('get_moderation_stats');
    
    if (error || !data || data.length === 0) {
      return {
        total_flags: 0,
        pending_flags: 0,
        approved_flags: 0,
        removed_flags: 0,
        flags_by_type: {},
        flags_by_reason: {},
        flags_by_severity: {},
      };
    }
    
    const stats = data[0];
    return {
      total_flags: Number(stats.total_flags) || 0,
      pending_flags: Number(stats.pending_flags) || 0,
      approved_flags: Number(stats.approved_flags) || 0,
      removed_flags: Number(stats.removed_flags) || 0,
      flags_by_type: stats.flags_by_type || {},
      flags_by_reason: stats.flags_by_reason || {},
      flags_by_severity: stats.flags_by_severity || {},
    };
  } catch (error) {
    console.error('Error fetching moderation stats:', error);
    return null;
  }
};

/**
 * Review a content flag
 */
export const reviewContentFlag = async (
  flagId: string,
  status: string,
  reviewedBy: string,
  reviewNotes?: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('review_content_flag', {
      p_flag_id: flagId,
      p_status: status,
      p_reviewed_by: reviewedBy,
      p_review_notes: reviewNotes,
    });
    
    if (error) {
      console.error('Error reviewing flag:', error.message);
      return false;
    }
    
    return data === true;
  } catch (error) {
    console.error('Error reviewing flag:', error);
    return false;
  }
};

/**
 * Get data requests (GDPR)
 */
export const getDataRequests = async (): Promise<DataRequest[]> => {
  try {
    const { data, error } = await supabase.rpc('get_data_requests');
    
    if (error) {
      console.warn('Error fetching data requests:', error.message);
      return [];
    }
    
    return (data || []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      user_name: r.user_name || 'Unknown',
      user_email: r.user_email,
      request_type: r.request_type,
      status: r.status,
      requested_by: r.requested_by,
      reason: r.reason,
      data_categories: r.data_categories || [],
      download_url: r.download_url,
      completed_at: r.completed_at,
      expires_at: r.expires_at,
      created_at: r.created_at,
    }));
  } catch (error) {
    console.error('Error fetching data requests:', error);
    return [];
  }
};

/**
 * Get engagement metrics over time
 */
export const getEngagementMetrics = async (daysBack: number = 30): Promise<EngagementMetric[]> => {
  try {
    const { data, error } = await supabase.rpc('get_engagement_metrics', { days_back: daysBack });
    
    if (error) {
      console.warn('Error fetching engagement metrics:', error.message);
      return [];
    }
    
    return (data || []).map((d: any) => ({
      metric_date: d.metric_date,
      active_users: Number(d.active_users) || 0,
      conversations_started: Number(d.conversations_started) || 0,
      messages_sent: Number(d.messages_sent) || 0,
      lessons_created: Number(d.lessons_created) || 0,
      assignments_created: Number(d.assignments_created) || 0,
      avg_messages_per_conversation: d.avg_messages_per_conversation ? Number(d.avg_messages_per_conversation) : null,
    }));
  } catch (error) {
    console.error('Error fetching engagement metrics:', error);
    return [];
  }
};

/**
 * Get grade distribution
 */
export const getGradeDistribution = async (): Promise<GradeDistribution[]> => {
  try {
    const { data, error } = await supabase.rpc('get_grade_distribution');
    
    if (error) {
      console.warn('Error fetching grade distribution:', error.message);
      return [];
    }
    
    return (data || []).map((d: any) => ({
      grade_range: d.grade_range,
      count: Number(d.count) || 0,
      percentage: Number(d.percentage) || 0,
    }));
  } catch (error) {
    console.error('Error fetching grade distribution:', error);
    return [];
  }
};

/**
 * Get AI vs Human grading comparison
 */
export const getAIvsHumanGrading = async (): Promise<AIvsHumanGrading | null> => {
  try {
    const { data, error } = await supabase.rpc('get_ai_vs_human_grading');
    
    if (error || !data || data.length === 0) {
      return null;
    }
    
    const d = data[0];
    return {
      total_submissions: Number(d.total_submissions) || 0,
      ai_graded: Number(d.ai_graded) || 0,
      human_graded: Number(d.human_graded) || 0,
      both_graded: Number(d.both_graded) || 0,
      avg_ai_score: d.avg_ai_score ? Number(d.avg_ai_score) : null,
      avg_human_score: d.avg_human_score ? Number(d.avg_human_score) : null,
      avg_difference: d.avg_difference ? Number(d.avg_difference) : null,
      correlation_coefficient: d.correlation_coefficient ? Number(d.correlation_coefficient) : null,
    };
  } catch (error) {
    console.error('Error fetching AI vs Human grading:', error);
    return null;
  }
};

/**
 * Get admin audit logs
 */
export const getAdminAuditLogs = async (limit: number = 100): Promise<AdminAuditLog[]> => {
  try {
    const { data, error } = await supabase.rpc('get_admin_audit_logs', { limit_count: limit });
    
    if (error) {
      console.warn('Error fetching audit logs:', error.message);
      return [];
    }
    
    return (data || []).map((log: any) => ({
      id: log.id,
      admin_user: log.admin_user,
      action: log.action_type,
      resource_type: log.resource_type,
      resource_id: log.resource_id,
      details: { old: log.old_values, new: log.new_values },
      ip_address: log.ip_address,
      created_at: log.created_at,
    }));
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
};

/**
 * Insert audit log entry
 */
export const insertAuditLog = async (
  adminUser: string,
  actionType: string,
  resourceType: string,
  resourceId?: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('insert_audit_log', {
      p_admin_user: adminUser,
      p_action_type: actionType,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_old_values: oldValues,
      p_new_values: newValues,
    });
    
    if (error) {
      console.error('Error inserting audit log:', error.message);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error inserting audit log:', error);
    return null;
  }
};

/**
 * Get admin notifications
 */
export const getAdminNotifications = async (includeRead: boolean = false): Promise<AdminNotificationItem[]> => {
  try {
    const { data, error } = await supabase.rpc('get_admin_notifications', { include_read: includeRead });
    
    if (error) {
      console.warn('Error fetching notifications:', error.message);
      return [];
    }
    
    return (data || []).map((n: any) => ({
      id: n.id,
      type: n.notification_type,
      category: n.category,
      title: n.title,
      message: n.message,
      is_read: n.is_read,
      created_at: n.created_at,
    }));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

/**
 * Mark notification as read
 */
export const markNotificationRead = async (notificationId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: notificationId,
    });
    
    if (error) {
      console.error('Error marking notification read:', error.message);
      return false;
    }
    
    return data === true;
  } catch (error) {
    console.error('Error marking notification read:', error);
    return false;
  }
};

/**
 * Create admin notification
 */
export const createAdminNotification = async (
  title: string,
  message: string,
  type: string = 'info',
  category: string = 'system',
  priority: string = 'normal',
  actionUrl?: string
): Promise<string | null> => {
  try {
    const { data, error } = await supabase.rpc('create_admin_notification', {
      p_title: title,
      p_message: message,
      p_notification_type: type,
      p_category: category,
      p_priority: priority,
      p_action_url: actionUrl,
    });
    
    if (error) {
      console.error('Error creating notification:', error.message);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

/**
 * Get system health metrics
 */
export const getSystemHealth = async (): Promise<{ metric_name: string; metric_value: string; status: string }[]> => {
  try {
    const { data, error } = await supabase.rpc('get_system_health');
    
    if (error) {
      console.warn('Error fetching system health:', error.message);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching system health:', error);
    return [];
  }
};
