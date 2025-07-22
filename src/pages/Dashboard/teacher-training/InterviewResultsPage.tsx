import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getInterview, updateInterviewFeedback } from '@/lib/actions/interview.actions';
import { Interview } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';

const InterviewResultsPage = () => {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingFeedback, setGeneratingFeedback] = useState(false);

  useEffect(() => {
    if (!interviewId) return;

    const fetchInterview = async () => {
      try {
        setLoading(true);
        const interviewData = await getInterview(interviewId);
        if (interviewData) {
          setInterview(interviewData);
        } else {
          setError('Interview not found.');
        }
      } catch (err) {
        setError('Failed to fetch interview data.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchInterview();
  }, [interviewId]);

  const handleGenerateFeedback = async () => {
    if (!interview || !interview.transcript || !interviewId) {
      setError('Cannot generate feedback without a valid interview and transcript.');
      return;
    }

    setGeneratingFeedback(true);
    setError(null);

    try {
      // Temporary direct API call to OpenRouter (bypassing Firebase Function)
      const analysisPrompt = `
        You are an expert teaching coach and interviewer evaluator. You have just conducted a mock teaching interview where the 'user' is the teacher candidate and the 'assistant' is the interviewer.

        Your task is to evaluate the teacher's performance during this interview. Focus specifically on how well they communicated, answered questions, demonstrated their teaching knowledge, and presented their teaching methods.

        Interview Transcript:
        ${JSON.stringify(interview.transcript, null, 2)}

        Please provide feedback directly to the teacher candidate. Structure your response as follows:

        OVERALL PERFORMANCE GRADE: Give a letter grade (A, B, C, D, F) with a brief explanation.

        COMMUNICATION SKILLS: Evaluate how clearly and effectively you communicated your ideas. Rate this area and provide specific feedback.

        TEACHING KNOWLEDGE: Assess your understanding of teaching concepts, curriculum, and educational methods demonstrated in your responses.

        PROBLEM-SOLVING APPROACH: Analyze how you approached challenging questions and scenarios presented during the interview.

        AREAS OF STRENGTH: Highlight 2-3 specific things you did exceptionally well during this interview, with examples from your responses.

        AREAS FOR IMPROVEMENT: Identify 2-3 specific areas where you can enhance your interview performance, with actionable recommendations.

        NEXT STEPS: Provide concrete suggestions for how you can prepare better for future teaching interviews.

        IMPORTANT: Do not use any markdown formatting (no *, #, or other symbols). Write in a conversational, encouraging tone as if speaking directly to the teacher. Make the feedback personal and actionable.
      `;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer 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`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o',
          messages: [
            {
              role: 'system',
              content: analysisPrompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch feedback from AI.');
      }

      const data = await response.json();
      const feedback = data.choices[0].message.content;

      await updateInterviewFeedback(interviewId, feedback);
      setInterview(prev => (prev ? { ...prev, feedback } : null));

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      console.error(err);
    } finally {
      setGeneratingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return <div className="flex h-screen w-full items-center justify-center text-red-500">{error}</div>;
  }

  if (!interview) {
    return <div className="flex h-screen w-full items-center justify-center">Interview data is not available.</div>;
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <Button onClick={() => navigate('/dashboard/teacher-training')} variant="ghost" className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Interviews
      </Button>

      <div className="bg-white p-8 rounded-2xl shadow-lg border">
        <h1 className="text-4xl font-bold mb-2">Interview Results</h1>
        <p className="text-lg text-gray-600 mb-6">Topic: <span className="font-semibold text-gray-800">{interview.topic}</span></p>

        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4 border-b pb-2">Transcript</h2>
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-4">
            {interview.transcript?.map((msg, index) => (
              <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                <div className={`p-3 rounded-lg max-w-lg ${msg.role === 'user' ? 'bg-green-100 text-green-900' : 'bg-gray-100 text-gray-900'}`}>
                  <p className="font-bold capitalize mb-1">{msg.role}</p>
                  <p>{msg.content}</p>
                </div>
              </div>
            )) || <p>No transcript available.</p>}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4 border-b pb-2">AI Feedback</h2>
          {interview.feedback ? (
            <div className="prose max-w-none p-4 bg-gray-50 rounded-lg border">
              <p dangerouslySetInnerHTML={{ __html: interview.feedback.replace(/\n/g, '<br />') }} />
            </div>
          ) : (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-r-lg text-center">
              <p className="text-blue-800 mb-4">Get personalized feedback on your performance.</p>
              <Button onClick={handleGenerateFeedback} disabled={generatingFeedback}>
                {generatingFeedback ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  'Generate AI Feedback'
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewResultsPage;
