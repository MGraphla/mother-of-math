import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { createInterview } from '@/lib/actions/interview.actions';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Wand2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const levels = ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"];
const focuses = ["Behavioral", "Technical", "Mixed"];
const timeFrames = [10, 15, 20, 30]; // minutes
const defaultRole = "Primary School Teacher";


interface CreateInterviewModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onInterviewCreated: () => void;
}

const CreateInterviewModal = ({ isOpen, onOpenChange, onInterviewCreated }: CreateInterviewModalProps) => {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(defaultRole);
  const [level, setLevel] = useState(levels[0]);
  const [topic, setTopic] = useState('');
  const [focus, setFocus] = useState(focuses[0]);
  const [time, setTime] = useState(timeFrames[0]);
  const [questions, setQuestions] = useState<string[]>(['']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Reset state when modal is closed
    if (!isOpen) {
      setTimeout(() => {
        setStep(1);
        setTopic('');
        setQuestions(['']);
      }, 200); // Delay to allow closing animation
    }
  }, [isOpen]);

  const handleNextStep = async () => {
    if (step === 1) {
      if (!role || !level || !topic || !focus || !time) {
        toast({ title: 'Missing Information', description: 'Please fill in all fields.', variant: 'destructive' });
        return;
      }
      setIsGenerating(true);
      setStep(2);
      try {
        const numQuestions = Math.max(3, Math.round(time / 1.5));
        const prompt = `Generate ${numQuestions} interview questions for a job role of '${role}' at the '${level}' level. The topic is '${topic}', with a focus on '${focus}'. The entire interview should last approximately ${time} minutes. Please provide only the questions, each on a new line, without numbering.`;

        const res = await fetch(import.meta.env.VITE_OPENROUTER_API_URL!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'openai/gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (!res.ok) {
          const errorBody = await res.text();
          throw new Error(`API error: ${res.statusText} - ${errorBody}`);
        }

        const data = await res.json();
        const generatedQuestions = data.choices[0]?.message?.content.trim().split('\n').filter(q => q);
        setQuestions(generatedQuestions.length > 0 ? generatedQuestions : ['']);

      } catch (error) {
        console.error(error);
        toast({ title: 'Error', description: 'Could not generate questions. Please try again.', variant: 'destructive' });
        setQuestions(['']); 
      } finally {
        setIsGenerating(false);
      }
    } else {
      setStep(s => s + 1);
    }
  };

  const handlePrevStep = () => setStep(s => s - 1);

  const handleQuestionChange = (index: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[index] = value;
    setQuestions(newQuestions);
  };

  const handleAddQuestion = () => setQuestions([...questions, '']);
  const handleRemoveQuestion = (index: number) => setQuestions(questions.filter((_, i) => i !== index));

  const handleSaveInterview = async () => {
    setIsSubmitting(true);
    if (!profile?.uid) {
      toast({ title: 'Authentication Error', description: 'User profile not found.', variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }

    const finalQuestions = questions.map(q => q.trim()).filter(q => q);
    if (!topic || finalQuestions.length === 0) {
        toast({ title: 'Missing Information', description: 'A topic and at least one question are required.', variant: 'destructive' });
        setIsSubmitting(false);
        return;
    }

    try {
        await createInterview(
          profile.uid,
          role,
          level,
          topic,
          focus,
          time,
          finalQuestions
        );
        toast({ title: 'Success!', description: 'Your new interview has been saved.' });
        onInterviewCreated(); // This will refetch the interviews
        onOpenChange(false); // This closes the modal
    } catch (error) {
        console.error('Failed to create interview:', error);
        toast({ title: 'Error', description: 'Failed to save interview. Please try again.', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1: // Interview Setup
        return (
          <div className="grid gap-4">
            <div>
              <Label htmlFor="role">Job Role</Label>
              <Input id="role" value={role} onChange={e => setRole(e.target.value)} placeholder="Primary School Teacher" />
            </div>
            <div>
              <Label htmlFor="level">Level</Label>
              <select id="level" value={level} onChange={e => setLevel(e.target.value)} className="w-full border rounded px-2 py-1">
                {levels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Fractions, Photosynthesis" />
            </div>
            <div>
              <Label htmlFor="focus">Question Focus</Label>
              <select id="focus" value={focus} onChange={e => setFocus(e.target.value)} className="w-full border rounded px-2 py-1">
                {focuses.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="time">Time Frame (minutes)</Label>
              <select id="time" value={time} onChange={e => setTime(Number(e.target.value))} className="w-full border rounded px-2 py-1">
                {timeFrames.map(t => <option key={t} value={t}>{t} minutes</option>)}
              </select>
            </div>
          </div>
        );
      case 2: // Review Questions
        return (
          <div className="space-y-4">
            <div>
              <Label>Generated Questions</Label>
              <p className="text-sm text-muted-foreground pb-2">Review the AI-generated questions below or edit them as needed.</p>
              {isGenerating ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                  <span>Generating questions...</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {questions.map((q, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input value={q} onChange={(e) => handleQuestionChange(index, e.target.value)} placeholder={`Question ${index + 1}`} />
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveQuestion(index)} disabled={questions.length <= 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                   <Button variant="link" className="p-0 h-auto mt-2" onClick={handleAddQuestion}>+ Add another question</Button>
                </div>
              )}
            </div>
          </div>
        );
      case 3: // Review
        return (
            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold">Review Your Interview</h3>
                    <p className="text-sm text-muted-foreground">Confirm the details below before starting.</p>
                </div>
                <div className="space-y-2">
                    <p><strong className="font-medium">Topic:</strong> {topic}</p>
                    <div>
                        <strong className="font-medium">Questions:</strong>
                        <ul className="list-disc list-inside pl-4 text-sm max-h-48 overflow-y-auto">
                            {questions.map((q, i) => q && <li key={i}>{q}</li>)}
                        </ul>
                    </div>
                </div>
            </div>
        );
      default:
        return null;
    }
  }

  const renderFooter = () => {
    return (
        <DialogFooter className="flex justify-between w-full">
            {step > 1 && <Button variant="outline" onClick={handlePrevStep}>Back</Button>}
            <div className="flex-grow"></div>
            {step < 3 && <Button onClick={handleNextStep} disabled={!topic || (step === 2 && questions.every(q => !q.trim()))}>Next</Button>}
            {step === 3 && <Button onClick={handleSaveInterview} disabled={isSubmitting}>{isSubmitting ? 'Starting...' : 'Finish'}</Button>}
        </DialogFooter>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Create New Mock Interview</DialogTitle>
          <DialogDescription>Step {step} of 3: {step === 1 ? 'Choose Topic' : step === 2 ? 'Set Questions' : 'Review & Start'}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {renderStepContent()}
        </div>
        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
};

export default CreateInterviewModal;
