import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import ChatbotService, { ChatMessage } from '@/services/chatbot';
import {
  Send,
  Bot,
  User,
  Copy,
  RefreshCw,
  BookOpen,
  GraduationCap,
  MapPin,
  AlertTriangle,
  Library,
  Sigma, 
  Percent, 
  Ruler
} from 'lucide-react';
import { cn } from '@/lib/utils';

const Chatbot: React.FC = () => {
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatbotService] = useState(() => new ChatbotService());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, profile } = useAuth();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (messageContent?: string) => {
    const content = (messageContent || inputMessage).trim();
    if (!content || isLoading) return;

    if (!selectedGrade) {
      toast({
        title: "Please select a grade level first",
        variant: "destructive",
      });
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content,
      timestamp: new Date()
    };

    setMessages(prev => [...prev.filter(m => m.id !== 'welcome'), userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await chatbotService.sendMessage(
        content,
        messages.filter(msg => msg.id !== 'welcome'),
        selectedGrade
      );

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (!response.success) {
        toast({
          title: "Error",
          description: response.error || "Failed to get response from AI assistant",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: "Copied!",
      description: "Message copied to clipboard",
    });
  };

  const formatMessageContent = (content: string) => {
    return content
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/## /g, '')
      .replace(/#/g, '');
  };

  const curriculumTopics = [
    { icon: Sigma, title: 'Numbers & Operations', description: 'Counting, place value, arithmetic' },
    { icon: Library, title: 'Geometry & Shapes', description: '2D/3D shapes, patterns, spatial sense' },
    { icon: Ruler, title: 'Measurement', description: 'Length, weight, time, money (CFA)' },
    { icon: Percent, title: 'Data & Graphs', description: 'Simple statistics, charts, probability' },
  ];

  const showChat = messages.length > 0 && messages[0].id !== 'welcome';

  return (
    <div className="bg-[#F9F7F2] min-h-full p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Hello {profile?.fullName}, I am MAMA Math!
          </h1>
          <p className="text-gray-600">Your Mathematics Teaching Assistant for Cameroon's National Curriculum</p>
        </header>

        <Card className="mb-6 overflow-hidden rounded-xl">
          <CardHeader className="bg-[#1E8449] text-white p-4">
            <CardTitle>Select Your Grade Level</CardTitle>
          </CardHeader>
          <CardContent className="p-4 bg-white">
            <label htmlFor="grade-select" className="text-sm font-medium text-gray-700 mb-2 block">Choose the grade you're teaching...</label>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger id="grade-select" className="w-full">
                <SelectValue placeholder="Select a grade..." />
              </SelectTrigger>
              <SelectContent>
                {[...Array(6)].map((_, i) => (
                  <SelectItem key={i + 1} value={`${i + 1}`}>
                    Primary {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {showChat ? (
          <Card>
            <CardHeader className="bg-yellow-700 text-white rounded-t-lg p-4">
              <CardTitle>MAMA - Math Assistant</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px] p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className={cn("flex gap-3 group", message.role === 'user' ? "justify-end" : "justify-start")}>
                      {message.role === 'assistant' && <Avatar className="w-8 h-8"><AvatarFallback className="bg-yellow-700 text-white"><Bot size={20} /></AvatarFallback></Avatar>}
                      <div className={cn("max-w-[85%] rounded-lg px-4 py-2 relative", message.role === 'user' ? "bg-green-600 text-white" : "bg-gray-100")}>
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">{formatMessageContent(message.content)}</div>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2 absolute top-1 right-1" onClick={() => copyMessage(message.content)}><Copy className="h-3 w-3" /></Button>
                      </div>
                      {message.role === 'user' && <Avatar className="w-8 h-8"><AvatarFallback className="bg-green-600 text-white"><User size={20} /></AvatarFallback></Avatar>}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3 justify-start">
                      <Avatar className="w-8 h-8"><AvatarFallback className="bg-[#8B572A] text-white"><Bot size={20} /></AvatarFallback></Avatar>
                      <div className="bg-gray-100 rounded-lg px-4 py-3"><div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /><span className="text-sm">MAMA is thinking...</span></div></div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden rounded-xl">
            <CardHeader className="bg-[#8B572A] text-white p-4">
              <CardTitle className="flex items-center gap-2"><BookOpen /> Mathematics Curriculum Assistant</CardTitle>
            </CardHeader>
            <CardContent className="p-6 bg-white">
              <p className="text-center text-gray-600 mb-6">Welcome! I'm specialized in Cameroon's primary mathematics curriculum. Select a grade level above, then choose a topic to get started.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {curriculumTopics.map((topic) => (
                  <button key={topic.title} onClick={() => handleSendMessage(`Tell me about ${topic.title} for Primary ${selectedGrade}`)} disabled={!selectedGrade} className="text-left p-4 border bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    <div className="flex items-center gap-3 mb-1">
                      <topic.icon className="h-5 w-5 text-[#8B572A]" />
                      <h3 className="font-semibold text-gray-800">{topic.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 ml-8">{topic.description}</p>
                  </button>
                ))}
              </div>
              {!selectedGrade && (
                <div className="bg-green-50 border-l-4 border-green-400 text-green-800 p-4 rounded-md flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5" />
                  <p>Please select a grade level first to get curriculum-specific guidance.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-6">
          <div className="relative">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={selectedGrade ? "Select a topic above or ask your own question..." : "Select a grade level first, then ask your question..."}
              className="pr-12 h-12"
              disabled={!selectedGrade || isLoading}
            />
            <Button onClick={() => handleSendMessage()} disabled={!inputMessage.trim() || isLoading || !selectedGrade} className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-[#48BB78] hover:bg-[#3FAD6F]" size="icon">
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xs text-center text-gray-500 mt-2">Curriculum Focus: Aligned with Cameroon National Primary Mathematics Standards. Tip: Mention specific competencies, local contexts, or resource constraints for better guidance.</p>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
