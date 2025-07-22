import { FC } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Interview } from '@/types/index';
import { deleteInterview } from '@/lib/actions/interview.actions';
import { toast } from './ui/use-toast';
import { Clock, Calendar, Trash2, Play, User, BarChartBig, Crosshair } from 'lucide-react';

interface InterviewCardProps {
  interview: Interview;
  onDelete: (id: string) => void;
}

const InterviewCard: FC<InterviewCardProps> = ({ interview, onDelete }) => {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate(`/dashboard/teacher-training/${interview.id}`);
  };

  const handleViewResults = () => {
    navigate(`/dashboard/teacher-training/results/${interview.id}`);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this interview?')) {
      try {
        await deleteInterview(interview.id);
        onDelete(interview.id);
        toast({ title: 'Success', description: 'Interview deleted successfully.' });
      } catch (error) {
        console.error('Failed to delete interview:', error);
        toast({ title: 'Error', description: 'Failed to delete interview.', variant: 'destructive' });
      }
    }
  };

  const formattedDate = interview.createdAt ? new Date(interview.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';

  return (
    <Card className="flex flex-col justify-between h-full border-l-4 border-primary hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-primary">{interview.topic || 'General Interview'}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow py-4">
        <div className="flex items-center text-sm text-muted-foreground mb-2">
          <Clock className="h-4 w-4 mr-2" />
          <span>{interview.time} minutes</span>
        </div>
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 mr-2" />
          <span>{formattedDate}</span>
        </div>
        <p className="text-sm text-muted-foreground pt-2">
          For a <strong>{interview.level} {interview.role}</strong>, focusing on <strong>{interview.focus}</strong>.
        </p>
      </CardContent>
      <CardFooter className="flex justify-center gap-2">
        <Button variant="outline" onClick={handleDelete} size="icon" aria-label="Delete Interview">
          <Trash2 className="h-4 w-4" />
        </Button>
        {interview.transcript && interview.transcript.length > 0 ? (
          <Button onClick={handleViewResults} className="flex-grow">
            <BarChartBig className="h-4 w-4 mr-2" />
            View Results
          </Button>
        ) : (
          <Button onClick={handleStart} className="flex-grow">
            <Play className="h-4 w-4 mr-2" />
            Start Interview
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default InterviewCard;
