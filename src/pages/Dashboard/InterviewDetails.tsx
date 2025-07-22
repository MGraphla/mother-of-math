import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getInterviewById, generateFeedback, Interview } from '@/lib/actions/interview.actions';
import { Agent } from '@/components/Agent';
import { Loader2, ArrowLeft, Wand2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

const InterviewDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [user, authLoading] = useAuthState(auth);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setError('No interview ID provided.');
      setLoading(false);
      return;
    }

    const fetchInterview = async () => {
      try {
        const fetchedInterview = await getInterviewById(id);
        if (fetchedInterview) {
          setInterview(fetchedInterview);
        } else {
          setError('Interview not found.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load interview.');
      } finally {
        setLoading(false);
      }
    };

    fetchInterview();
  }, [id]);

  const handleGenerateFeedback = async () => {
    if (!interview?.transcript || !id) return;
    setFeedbackLoading(true);
    setError(null);
    try {
      const feedback = await generateFeedback(id, interview.transcript);
      setInterview(prev => prev ? { ...prev, feedback } : null);
    } catch (err: any) {
      setError(err.message || 'Failed to generate feedback.');
    } finally {
      setFeedbackLoading(false);
    }
  };

  const renderContent = () => {
    if (loading || authLoading) {
      return <div className="flex justify-center items-center h-[calc(100vh-200px)]"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (error) {
      return <div className="text-red-500 text-center mt-10">{error}</div>;
    }

    if (!interview || !user) {
      return <div className="text-center mt-10">Interview data could not be loaded.</div>;
    }

    // Interview is complete, show transcript and feedback options
    if (interview.transcript && interview.transcript.length > 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Interview Review: {interview.topic}</CardTitle>
            <CardDescription>Review your performance and the AI-generated feedback.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {interview.feedback ? (
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <ReactMarkdown>{interview.feedback}</ReactMarkdown>
              </div>
            ) : (
              <div className="text-center p-6 bg-muted rounded-lg">
                <h3 className="text-lg font-semibold">Your transcript is ready for analysis.</h3>
                <p className="text-sm text-muted-foreground mb-4">Click the button below to get AI-powered feedback on your performance.</p>
                <Button onClick={handleGenerateFeedback} disabled={feedbackLoading}>
                  {feedbackLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Wand2 className="mr-2 h-4 w-4" /> Get AI Feedback</>
                  )}
                </Button>
              </div>
            )}
            <div>
              <h3 className="text-xl font-semibold mb-4 border-b pb-2">Your Transcript</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto p-4 border rounded-md">
                {interview.transcript.map((entry, index) => (
                  <div key={index} className={`flex items-start gap-3 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-3 rounded-lg max-w-2xl ${entry.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                      <p className="font-bold capitalize text-sm">{entry.role === 'user' ? user.displayName || 'You' : 'AI Interviewer'}</p>
                      <p>{entry.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Interview not started yet, show agent
    return <Agent userName={user.displayName || 'User'} interviewId={interview.id} questions={interview.questions} />;
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Link to="/dashboard/teacher-training" className="flex items-center text-sm text-muted-foreground hover:underline mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to My Interviews
      </Link>
      {renderContent()}
    </div>
  );
};

export default InterviewDetails;
