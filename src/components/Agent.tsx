import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateInterviewTranscript } from '@/lib/actions/interview.actions';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Phone, PhoneOff, Loader2, User, Bot, Volume2 } from 'lucide-react';
import { useVapi } from '../hooks/useVapi';
import { TypeAnimation } from 'react-type-animation';
import { cn } from '@/lib/utils';

interface AgentProps {
  userName: string;
  interviewId: string;
  questions: string[];
  topic: string;
}

type CallState = 'idle' | 'loading' | 'connecting' | 'connected' | 'ended' | 'error';
type Speaker = 'user' | 'assistant' | 'none';
interface TranscriptMessage {
    role: 'user' | 'assistant';
    content: string;
}

export const Agent = ({ userName, interviewId, questions, topic }: AgentProps) => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [activeSpeaker, setActiveSpeaker] = useState<Speaker>('none');
  const vapi = useVapi();
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [transcript]);

  const handleCallEnd = useCallback(async () => {
    setCallState('ended');
    if (transcript.length > 0) {
      try {
        await updateInterviewTranscript(interviewId, transcript);
      } catch (e) {
        console.error('Failed to save transcript', e);
        setError('Could not save the final transcript.');
      }
    }
  }, [interviewId, transcript]);

  const onError = useCallback((e: any) => {
    console.error('Vapi error:', e);
    setError(e?.message || 'An unknown error occurred.');
    setCallState('error');
  }, []);

  useEffect(() => {
    const onCallStart = () => setCallState('connected');
    const onSpeakerStart = (speaker: any) => setActiveSpeaker(speaker.speaker);
    const onSpeakerEnd = () => setActiveSpeaker('none');
    
    const onMessage = (message: any) => {
      if (message.type === 'transcript' && message.transcriptType === 'final') {
        setTranscript(prev => [...prev, { role: message.role, content: message.transcript }]);
      }
    };

    vapi.on('call-start', onCallStart);
    vapi.on('call-end', handleCallEnd);
    vapi.on('error', onError);
    vapi.on('speaker-start', onSpeakerStart);
    vapi.on('speaker-end', onSpeakerEnd);
    vapi.on('message', onMessage);

    return () => {
      vapi.off('call-start', onCallStart);
      vapi.off('call-end', handleCallEnd);
      vapi.off('error', onError);
      vapi.off('speaker-start', onSpeakerStart);
      vapi.off('speaker-end', onSpeakerEnd);
      vapi.off('message', onMessage);
    };
  }, [vapi, onError, handleCallEnd]);

  const startInterview = async () => {
    setCallState('connecting');
    const systemPrompt = `You are a friendly and professional interviewer conducting a mock interview for a teaching position. Your name is Eva. The user's name is ${userName}. Your task is to ask the user the following questions one by one. Do not ask them all at once. After you ask a question, wait for the user's full response before moving to the next one. After the last question, thank the user for their time and end the conversation by saying 'Interview complete.' Here are the questions:\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

    try {
      const assistantId = "ff4be168-7389-4c38-b4bd-10b12882a94f";
      await vapi.start(assistantId, {
        variableValues: {
          userName: userName,
          systemPrompt: systemPrompt
        }
      });
    } catch (e) {
      onError(e);
    }
  };

  const endInterview = () => vapi.stop();
  const toggleMute = () => {
    const newMutedState = !isMuted;
    vapi.setMuted(newMutedState);
    setIsMuted(newMutedState);
  };

  // Loading and initial states
      if (callState === 'idle') {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 via-white to-cyan-50 p-4">
        <div className="text-center max-w-3xl mx-auto">
          <img src="/teacher-students.svg" alt="Teacher and Student" className="w-56 h-56 mx-auto mb-6" />
          
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-gray-200/80 mb-8">
            <TypeAnimation
              sequence={[
                `You're about to practice teaching "${topic}". Take a deep breath. You've got this!`,
                2000,
                `Remember to be clear, engaging, and patient. Your passion will shine through.`,
                2000,
                `This is a great opportunity to refine your skills. Let's begin when you're ready.`,
                3000,
              ]}
              wrapper="p"
              speed={60}
              className="text-2xl font-medium text-gray-800 h-20"
              repeat={Infinity}
              cursor={true}
            />
          </div>

          <h2 className="text-4xl font-bold text-gray-900 mb-2">Ready to Start?</h2>
          <p className="text-lg text-gray-600 mb-8">Press the button below to begin your mock interview.</p>
          
          <Button onClick={startInterview} size="lg" className="bg-green-500 hover:bg-green-600 text-white rounded-full px-10 py-8 text-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 animate-shake">
            <Phone className="mr-4 h-7 w-7" /> Start Interview
          </Button>
        </div>
      </div>
    );
  }
  
  if (['connecting', 'loading'].includes(callState)) {
      return (
          <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
              <Loader2 className="h-12 w-12 animate-spin mb-6" />
              <h2 className="text-3xl font-bold">Connecting...</h2>
              <p className="text-gray-400">Please wait while we set up the session.</p>
          </div>
      );
  }

  // Post-call states
  if (callState === 'ended') {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <h2 className="text-4xl font-bold text-gray-800 mb-3">Interview Complete!</h2>
        <p className="text-lg text-gray-600 mb-8">Your transcript has been saved. Ready to see how you did?</p>
        <Button 
          size="lg" 
          onClick={() => navigate(`/dashboard/teacher-training/results/${interviewId}`)} 
          className="bg-green-500 hover:bg-green-600 text-white rounded-full px-8 py-6 text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300">
          View Results & Feedback
        </Button>
      </div>
    );
  }

  if (callState === 'error') {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <h2 className="text-3xl font-bold mb-2 text-red-600">Connection Error</h2>
        <p className="text-gray-500 mb-6">{error || 'An unknown error occurred.'}</p>
        <Button onClick={() => navigate('/dashboard/teacher-training')}>Back to Dashboard</Button>
      </div>
    );
  }

  // Main interview UI
  return (
    <div className="w-full h-screen bg-mama-dark text-white flex flex-col p-4 sm:p-6 lg:p-8 gap-4">
      {/* Video/Avatar Boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-shrink-0">
        {/* User Box */}
        <div className={cn('relative aspect-video bg-gray-800 rounded-2xl flex items-center justify-center transition-all duration-300 ring-4 ring-transparent', activeSpeaker === 'user' && 'ring-green-500')}>
          <User className="h-24 w-24 text-gray-600" />
          <div className="absolute bottom-3 left-4 bg-black/50 px-3 py-1 rounded-lg text-base font-semibold">{userName}</div>
          {activeSpeaker === 'user' && <Volume2 className="absolute top-4 right-4 h-6 w-6 text-green-500 animate-pulse" />}
        </div>
        {/* AI Box */}
        <div className={cn('relative aspect-video bg-gray-800/50 rounded-2xl flex items-center justify-center transition-all duration-300 ring-4 ring-transparent', activeSpeaker === 'assistant' && 'ring-gray-500')}>
          <Bot className="h-24 w-24 text-gray-600" />
          <div className="absolute bottom-3 left-4 bg-black/50 px-3 py-1 rounded-lg text-base font-semibold">AI Interviewer</div>
           {activeSpeaker === 'assistant' && <Volume2 className="absolute top-4 right-4 h-6 w-6 text-gray-400 animate-pulse" />}
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-grow bg-black/30 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-4 overflow-y-auto">
        <div className="space-y-6">
          {transcript.map((msg, i) => (
            <div key={i} className={cn('flex items-start gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0"><Bot className="h-5 w-5" /></div>}
              <div className={cn('max-w-xl p-3 rounded-lg text-sm', msg.role === 'user' ? 'bg-green-600/90' : 'bg-gray-800/90')}>
                <p className="leading-relaxed">{msg.content}</p>
              </div>
              {msg.role === 'user' && <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0"><User className="h-5 w-5" /></div>}
            </div>
          ))}
           <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 flex justify-center items-center gap-4 p-2">
        <Button onClick={toggleMute} variant="outline" size="icon" className="bg-gray-700/50 hover:bg-gray-700 border-gray-600 rounded-full w-14 h-14">
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
        <Button onClick={endInterview} variant="destructive" size="lg" className="rounded-full px-8 py-6 text-lg">
          <PhoneOff className="mr-3 h-6 w-6" /> End Call
        </Button>
      </div>
    </div>
  );
};

