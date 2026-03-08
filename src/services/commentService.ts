/**
 * Comments Service
 * Handles assignment discussion threads
 */

import { supabase } from '@/lib/supabase';
import { getStudentSession } from './studentService';

// ── Types ─────────────────────────────────────────────────

export interface AssignmentComment {
  id: string;
  assignment_id: string;
  student_id: string | null;
  teacher_id: string | null;
  parent_comment_id: string | null;
  message: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  author_name?: string;
  is_teacher?: boolean;
}

// ── Student Comments (Magic Link) ─────────────────────────

/** Get comments for an assignment (student view) */
export const getAssignmentCommentsForStudent = async (
  assignmentId: string
): Promise<AssignmentComment[]> => {
  const session = getStudentSession();
  if (!session) throw new Error('No student session');

  const { data, error } = await supabase.rpc('get_assignment_comments_by_token', {
    p_student_id: session.id,
    p_access_token: session.access_token,
    p_assignment_id: assignmentId,
  });

  if (error) {
    console.error('Error fetching comments:', error);
    return [];
  }

  return data || [];
};

/** Add a comment as a student */
export const addStudentComment = async (
  assignmentId: string,
  message: string,
  parentCommentId?: string
): Promise<AssignmentComment | null> => {
  const session = getStudentSession();
  if (!session) throw new Error('No student session');

  const { data, error } = await supabase.rpc('add_comment_by_token', {
    p_student_id: session.id,
    p_access_token: session.access_token,
    p_assignment_id: assignmentId,
    p_message: message,
    p_parent_comment_id: parentCommentId || null,
  });

  if (error) {
    console.error('Error adding comment:', error);
    throw new Error('Failed to add comment');
  }

  return data;
};

// ── Teacher Comments ──────────────────────────────────────

/** Get all comments for an assignment (teacher view) */
export const getAssignmentCommentsForTeacher = async (
  assignmentId: string
): Promise<AssignmentComment[]> => {
  const { data, error } = await supabase
    .from('assignment_comments')
    .select(`
      *,
      students:student_id (full_name)
    `)
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching comments:', error);
    return [];
  }

  return (data || []).map(c => ({
    ...c,
    author_name: c.teacher_id ? 'Teacher' : c.students?.full_name || 'Student',
    is_teacher: !!c.teacher_id,
  }));
};

/** Add a comment as a teacher */
export const addTeacherComment = async (
  assignmentId: string,
  message: string,
  options?: {
    parentCommentId?: string;
    isPrivate?: boolean;
    targetStudentId?: string; // For private messages to specific student
  }
): Promise<AssignmentComment | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('assignment_comments')
    .insert({
      assignment_id: assignmentId,
      teacher_id: user.id,
      message,
      parent_comment_id: options?.parentCommentId || null,
      is_private: options?.isPrivate || false,
      student_id: options?.targetStudentId || null, // For private messages
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding teacher comment:', error);
    throw new Error('Failed to add comment');
  }

  return data;
};

/** Delete a comment (teacher only) */
export const deleteComment = async (commentId: string): Promise<void> => {
  const { error } = await supabase
    .from('assignment_comments')
    .delete()
    .eq('id', commentId);

  if (error) {
    console.error('Error deleting comment:', error);
    throw new Error('Failed to delete comment');
  }
};

/** Get comment count for an assignment */
export const getCommentCount = async (assignmentId: string): Promise<number> => {
  const { count, error } = await supabase
    .from('assignment_comments')
    .select('*', { count: 'exact', head: true })
    .eq('assignment_id', assignmentId)
    .eq('is_private', false);

  if (error) {
    console.error('Error getting comment count:', error);
    return 0;
  }

  return count || 0;
};

/** Get comments grouped by parent (for threaded view) */
export const getThreadedComments = async (
  assignmentId: string
): Promise<{ rootComments: AssignmentComment[]; replies: Record<string, AssignmentComment[]> }> => {
  const comments = await getAssignmentCommentsForTeacher(assignmentId);
  
  const rootComments = comments.filter(c => !c.parent_comment_id);
  const replies: Record<string, AssignmentComment[]> = {};
  
  comments.forEach(c => {
    if (c.parent_comment_id) {
      if (!replies[c.parent_comment_id]) {
        replies[c.parent_comment_id] = [];
      }
      replies[c.parent_comment_id].push(c);
    }
  });

  return { rootComments, replies };
};

// ── Enhanced Comment Features (Reactions, Edit, etc.) ─────

/** Comment Reaction type */
export interface CommentReaction {
  id: string;
  comment_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

/** Unified Comment interface for enhanced component */
export interface Comment {
  id: string;
  content: string;
  user_id: string;
  user_role: 'teacher' | 'student';
  author_name?: string;
  parent_id?: string | null;
  created_at: string;
  updated_at?: string;
}

/** Update a comment's content */
export const updateComment = async (
  commentId: string,
  newMessage: string
): Promise<void> => {
  const { error } = await supabase
    .from('assignment_comments')
    .update({ 
      message: newMessage,
      updated_at: new Date().toISOString()
    })
    .eq('id', commentId);

  if (error) {
    console.error('Error updating comment:', error);
    throw new Error('Failed to update comment');
  }
};

/** Get reactions for a comment */
export const getReactions = async (commentId: string): Promise<CommentReaction[]> => {
  const { data, error } = await supabase
    .from('comment_reactions')
    .select('*')
    .eq('comment_id', commentId);

  if (error) {
    console.error('Error fetching reactions:', error);
    return [];
  }

  return data || [];
};

/** Add a reaction to a comment */
export const addReaction = async (reaction: {
  comment_id: string;
  user_id: string;
  emoji: string;
}): Promise<CommentReaction | null> => {
  const { data, error } = await supabase
    .from('comment_reactions')
    .insert(reaction)
    .select()
    .single();

  if (error) {
    console.error('Error adding reaction:', error);
    throw new Error('Failed to add reaction');
  }

  return data;
};

/** Remove a reaction */
export const removeReaction = async (reactionId: string): Promise<void> => {
  const { error } = await supabase
    .from('comment_reactions')
    .delete()
    .eq('id', reactionId);

  if (error) {
    console.error('Error removing reaction:', error);
    throw new Error('Failed to remove reaction');
  }
};

/** Unified comment service for enhanced AssignmentComments component */
export const commentService = {
  /** Get comments for an assignment */
  getComments: async (assignmentId: string): Promise<Comment[]> => {
    const comments = await getAssignmentCommentsForTeacher(assignmentId);
    return comments.map(c => ({
      id: c.id,
      content: c.message,
      user_id: c.teacher_id || c.student_id || '',
      user_role: (c.is_teacher ? 'teacher' : 'student') as 'teacher' | 'student',
      author_name: c.author_name || (c.is_teacher ? 'Teacher' : 'Student'),
      parent_id: c.parent_comment_id,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));
  },

  /** Add a comment */
  addComment: async (comment: {
    assignment_id: string;
    user_id: string;
    user_role: 'teacher' | 'student';
    content: string;
    parent_id?: string;
    author_name?: string;
  }): Promise<Comment | null> => {
    if (comment.user_role === 'teacher') {
      const result = await addTeacherComment(
        comment.assignment_id,
        comment.content,
        { parentCommentId: comment.parent_id }
      );
      if (!result) return null;
      return {
        id: result.id,
        content: result.message,
        user_id: result.teacher_id || '',
        user_role: 'teacher',
        author_name: comment.author_name || 'Teacher',
        parent_id: result.parent_comment_id,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };
    } else {
      const result = await addStudentComment(
        comment.assignment_id,
        comment.content,
        comment.parent_id
      );
      if (!result) return null;
      return {
        id: result.id,
        content: result.message,
        user_id: result.student_id || '',
        user_role: 'student',
        author_name: comment.author_name || 'Student',
        parent_id: result.parent_comment_id,
        created_at: result.created_at,
        updated_at: result.updated_at,
      };
    }
  },

  updateComment,
  deleteComment,
  getReactions,
  addReaction,
  removeReaction,
};
