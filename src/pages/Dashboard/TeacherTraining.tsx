import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";
import { getInterviewsByUser, Interview } from '@/lib/actions/interview.actions';
import InterviewCard from '@/components/InterviewCard';
import CreateInterviewModal from '@/components/CreateInterviewModal';

const TeacherTraining = () => {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  const handleInterviewDeleted = (deletedInterviewId: string) => {
    setInterviews(prevInterviews => prevInterviews.filter(interview => interview.id !== deletedInterviewId));
  };

  const fetchInterviews = useCallback(async () => {
        if (!profile?.uid) return;
    setIsLoading(true);
    try {
            const userInterviews = await getInterviewsByUser(profile.uid);
      setInterviews(userInterviews);
    } catch (err) {
      setError('Failed to fetch interviews. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchInterviews();
  }, [fetchInterviews]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center justify-between">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Teacher Training</h1>
          <p className="text-muted-foreground">
            Practice and upgrade your teaching skills with AI-powered mock interviews.
          </p>
        </header>
                <Button className="ml-auto" onClick={() => setIsModalOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Interview
        </Button>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <p>Loading interviews...</p>
        ) : interviews.length > 0 ? (
          <div className="flex flex-wrap gap-6 justify-center md:justify-start">
            {interviews.map((interview) => (
              <InterviewCard key={interview.id} interview={interview} onDelete={handleInterviewDeleted} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-gray-300 p-12 text-center bg-gray-50 mt-10">
            <h3 className="text-xl font-semibold text-gray-700">You haven't created any interviews yet.</h3>
            <p className="text-gray-500">
              Click the button above to create your first AI-powered mock interview.
            </p>
          </div>
        )}
      </div>
      <CreateInterviewModal 
        isOpen={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        onInterviewCreated={fetchInterviews} 
      />
    </div>
  );
};

export default TeacherTraining;
