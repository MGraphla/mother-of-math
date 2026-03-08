import { supabase } from '@/lib/supabase';
import { Interview } from '@/types';

export type { Interview };

export const createInterview = async (
  userId: string,
  role: string,
  level: string,
  topic: string,
  focus: string,
  time: number,
  questions: string[]
): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from('interviews')
      .insert({
        user_id: userId,
        role,
        level,
        topic,
        focus,
        time,
        questions,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error("Error creating interview:", error);
    throw new Error("Failed to create interview.");
  }
};

export const getInterviewsByUser = async (userId: string): Promise<Interview[]> => {
  try {
    const { data, error } = await supabase
      .from('interviews')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      role: row.role,
      level: row.level,
      topic: row.topic,
      focus: row.focus,
      time: row.time,
      questions: row.questions,
      transcript: row.transcript,
      createdAt: row.created_at,
      feedback: row.feedback,
    })) as Interview[];
  } catch (error) {
    console.error("Error fetching interviews:", error);
    throw new Error("Failed to fetch interviews.");
  }
};

export const getInterviewById = async (interviewId: string): Promise<Interview | null> => {
  try {
    const { data, error } = await supabase
      .from('interviews')
      .select('*')
      .eq('id', interviewId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return {
      id: data.id,
      userId: data.user_id,
      role: data.role,
      level: data.level,
      topic: data.topic,
      focus: data.focus,
      time: data.time,
      questions: data.questions,
      transcript: data.transcript,
      createdAt: data.created_at,
      feedback: data.feedback,
    } as Interview;
  } catch (error) {
    console.error("Error fetching interview by ID:", error);
    throw new Error("Failed to fetch interview.");
  }
};

export const updateInterviewFeedback = async (interviewId: string, feedback: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('interviews')
      .update({ feedback })
      .eq('id', interviewId);

    if (error) throw error;
    console.log('Interview feedback updated successfully!');
  } catch (error) {
    console.error('Error updating interview feedback: ', error);
    throw new Error('Failed to update interview feedback.');
  }
};

export const updateInterviewTranscript = async (interviewId: string, transcript: { role: 'assistant' | 'user'; content: string }[]) => {
  try {
    const { error } = await supabase
      .from('interviews')
      .update({ transcript })
      .eq('id', interviewId);

    if (error) throw error;
  } catch (error) {
    console.error("Error updating transcript:", error);
    throw new Error("Failed to update transcript.");
  }
};

export const generateFeedback = async (interviewId: string, transcript: { role: 'assistant' | 'user'; content: string }[]): Promise<string> => {
  if (!transcript || transcript.length === 0) {
    throw new Error("Transcript is empty, cannot generate feedback.");
  }

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch feedback from API.');
    }

    const { feedback } = await response.json();

    const { error } = await supabase
      .from('interviews')
      .update({ feedback })
      .eq('id', interviewId);

    if (error) throw error;

    return feedback;
  } catch (error) {
    console.error('Error generating feedback:', error);
    throw error;
  }
};

// Fetch a single interview by its ID (alias)
export const getInterview = getInterviewById;

export const deleteInterview = async (interviewId: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    console.log("Attempting to delete interview. User ID:", user?.id);

    if (!user) {
      throw new Error("User not authenticated.");
    }

    const { error } = await supabase
      .from('interviews')
      .delete()
      .eq('id', interviewId);

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting interview:", error);
    throw new Error("Failed to delete interview.");
  }
};
