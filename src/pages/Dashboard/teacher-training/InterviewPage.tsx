import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { getInterview } from '@/lib/actions/interview.actions';
import { Interview } from '@/types';
import { Agent } from '@/components/Agent';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const InterviewPage = () => {
      const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!interviewId) {
      setError('No interview ID provided.');
      setIsLoading(false);
      return;
    }

    const fetchInterview = async () => {
      try {
        const interviewData = await getInterview(interviewId);
        if (interviewData) {
          setInterview(interviewData);
        } else {
          setError('Interview not found.');
        }
      } catch (err) {
        setError('Failed to load interview.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInterview();
  }, [interviewId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-4">Loading your interview...</p>
      </div>
    );
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen text-red-500">{error}</div>;
  }

  if (!interview) {
    return <div className="flex justify-center items-center h-screen">Interview data is not available.</div>;
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center mb-4">
        <Button variant="outline" size="icon" className="mr-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Interview Session: {interview.topic}</h1>
      </div>
      <Agent 
        questions={interview.questions} 
        interviewId={interviewId}
        userName={profile?.fullName || 'User'}
        topic={interview.topic}
      />
    </div>
  );
};

export default InterviewPage;
