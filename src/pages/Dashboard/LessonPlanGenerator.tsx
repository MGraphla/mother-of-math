import React, { useState, useRef, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { PlusCircle, Trash2, Download, FileText, FileType, Send, Edit, Save, Plus, X, Loader2, Lightbulb, BookOpen, GraduationCap, Sparkles, ArrowRight, Globe } from 'lucide-react';
import { getCurriculumContent, getCurriculumContentAsync, getDefaultClassLevel, getClassLevelsForCountry, formatCurriculumForPrompt, type CurriculumContent } from '@/data/curriculumContent';
import { useToast } from '@/components/ui/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendMessage } from '@/services/api'; // Import sendMessage
import { generateLessonPlan as generateLessonPlanService, formatAIResponseAsMarkdown, exportToPDF, exportToPowerPoint } from '@/services/lessonPlan';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import ExportProgressModal from '@/components/ExportProgressModal';

// Type definitions
interface LessonSection {
  id: string;
  title: string;
  keyPoints: string;
  isEditing: boolean;
  time: string; // New field for time allocation
  teacherActivities: string; // New field for teacher actions
  learnerActivities: string; // New field for learner actions
}

interface LessonPlan {
  id?: string; // Add optional ID for saved plans
  topic: string;
  level: string;
  sections: LessonSection[];
  generatedContent?: string; // Add generated content to the saved plan structure
}

const defaultSections: LessonSection[] = [
  { 
    id: '1', 
    title: 'INTRODUCTION', 
    keyPoints: 'Lesson objectives, write a brief hook to engage students, link to prior knowledge.',
    isEditing: false,
    time: '', // Initialize new fields
    teacherActivities: '',
    learnerActivities: '',
  },
  { 
    id: '2', 
    title: 'PRESENTATION', 
    keyPoints: 'generate a detailed lesson plan for this topic. Step-by-step explanation of the new concept, examples to use, materials needed.',
    isEditing: false,
    time: '',
    teacherActivities: '',
    learnerActivities: '',
  },
  { 
    id: '3', 
    title: 'EVALUATION', 
    keyPoints: 'generate a detailed lesson plan for this topic. Classroom exercises, questions to ask, worksheet activities.',
    isEditing: false,
    time: '',
    teacherActivities: '',
    learnerActivities: '',
  },
  { 
    id: '4', 
    title: 'STUDENT EXERCISES', 
    keyPoints: 'generate a detailed lesson plan for this topic. Practice problems, application exercises, differentiated tasks for various skill levels.',
    isEditing: false,
    time: '',
    teacherActivities: '',
    learnerActivities: '',
  },
  { 
    id: '5', 
    title: 'CONCLUSION', 
    keyPoints: 'generate a detailed lesson plan for this topic. Summary of key takeaways, assignment for homework.',
    isEditing: false,
    time: '',
    teacherActivities: '',
    learnerActivities: '',
  }
];

// Remove or adapt the mock getAIGeneratedContent function as we'll use sendMessage directly
// const getAIGeneratedContent = async (lessonPlan: LessonPlan): Promise<string> => { ... };

// Helper function to check for math-related topics
const isMathTopic = (topic: string): boolean => {
  const mathKeywords = [
    'math', 'mathematics', 'algebra', 'geometry', 'trigonometry', 'calculus',
    'statistics', 'probability', 'number', 'count', 'addition', 'subtraction',
    'multiplication', 'division', 'fraction', 'decimal', 'percent', 'equation',
    'graph', 'shape', 'measure', 'angle', 'volume', 'area', 'perimeter'
  ];
  const topicLower = topic.toLowerCase();
  return mathKeywords.some(keyword => topicLower.includes(keyword));
};

// Available languages for lesson plans
const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'french', label: 'French' },
  { value: 'pidgin', label: 'English Pidgin' }
];

const LessonPlanGenerator: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast(); // Use the toast from the hook
  const [phase, setPhase] = useState<0 | 1 | 2 | 3 | 4>(0); // Start at phase 0 (country selection)
  const [topic, setTopic] = useState<string>('');
  const [level, setLevel] = useState<string>('');
  const [language, setLanguage] = useState<string>('english'); // Default to English
  const [country, setCountry] = useState<'cameroon' | 'nigeria' | ''>('');
  const [curriculum, setCurriculum] = useState<CurriculumContent | null>(null);
  const [lessonPlan, setLessonPlan] = useState<LessonPlan>({
    topic: '',
    level: '',
    sections: [...defaultSections],
    generatedContent: ''
  });
  const [sections, setSections] = useState<LessonSection[]>([...defaultSections]);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [rawJsonContent, setRawJsonContent] = useState<string>('');
  const [isEditingContent, setIsEditingContent] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<'idle' | 'generating' | 'complete'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();
  const [savedLessonPlans, setSavedLessonPlans] = useState<LessonPlan[]>([]);

  // Export progress modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'pptx'>('pdf');
  const [exportProgress, setExportProgress] = useState('');
  const [exportComplete, setExportComplete] = useState(false);

  // Saved lesson plans are now in Supabase - localStorage loading removed

  // Update lessonPlan state (used for saving)
  useEffect(() => {
    setLessonPlan({
      topic,
      level,
      sections,
      generatedContent: generatedContent // Use generatedContent for the final save
    });
  }, [topic, level, sections, generatedContent]); // Depend on generatedContent

  // Handle country selection with automatic class level assignment
  const handleCountrySelect = async (selectedCountry: 'cameroon' | 'nigeria') => {
    setCountry(selectedCountry);
    const defaultLevel = getDefaultClassLevel(selectedCountry);
    setLevel(defaultLevel);
    
    // Fetch curriculum content from JSON file
    try {
      const curriculumContent = await getCurriculumContentAsync(selectedCountry);
      setCurriculum(curriculumContent);
      console.log('Loaded curriculum from JSON:', curriculumContent.description);
    } catch (error) {
      console.error('Failed to fetch curriculum, using fallback:', error);
      const fallbackCurriculum = getCurriculumContent(selectedCountry);
      setCurriculum(fallbackCurriculum);
    }
    
    setPhase(1); // Move to topic selection
  };

  // Get available class levels based on selected country
  const getAvailableLevels = (): string[] => {
    if (!country) return [];
    return getClassLevelsForCountry(country);
  };

  // Generate initial lesson structure using AI based on topic
  const handleTopicSubmit = async () => {
    if (!topic || !level) {
      toast({
        title: "Missing Information",
        description: "Please enter a topic and select a level.",
        variant: "destructive",
      });
      return;
    }

    // NEW: Check if the topic is math-related
    if (!isMathTopic(topic)) {
      toast({
        title: "Invalid Topic",
        description: "Please enter a mathematics-related topic. This generator specializes in math lesson plans.",
        variant: "destructive",
        duration: 5000,
      });
      return; // Stop execution
    }

    setIsGenerating(true);
    setPhase(2); // Move to the structure generation/display phase

    try {
      // Determine country name for prompt
      const countryName = country === 'nigeria' ? 'Nigeria' : 'Cameroon';
      
      // Language instruction for the AI
      const languageInstruction = language === 'french' 
        ? 'IMPORTANT: Generate all content in French.'
        : language === 'pidgin'
        ? 'IMPORTANT: Generate all content in English Pidgin (Cameroonian/Nigerian Pidgin English).'
        : 'IMPORTANT: Generate all content in English.';
      
      // New prompt asking for a JSON object with curriculum alignment
      const curriculumContext = curriculum ? formatCurriculumForPrompt(curriculum) : '';
      const prompt = `Based on the topic "${topic}" for ${level} students in ${countryName}, generate a structured lesson plan outline that aligns with the national curriculum standards.

${languageInstruction}

${curriculumContext}

You must provide between 5 and 7 sections. Respond with ONLY a valid JSON object in the following format: { "sections": [{"title": "SECTION_TITLE", "keyPoints": "KEY_POINTS_HERE"}] }`;
      
      const response = await sendMessage(prompt, undefined, 'json');

      if (response && response.sections && Array.isArray(response.sections)) {
        // The API now directly returns the parsed JSON object
        const newSections = response.sections.map((s: any, index: number) => ({
          id: `section-${Date.now()}-${index}`,
          title: s.title || 'Untitled Section',
          keyPoints: s.keyPoints || '',
          isEditing: false,
          // Initialize new fields
          time: '',
          teacherActivities: '',
          learnerActivities: '',
        }));
        setSections(newSections);
      } else {
        // This case handles if the response is not in the expected format
        console.error("AI response was not in the expected format:", response);
        toast({
          title: "Generation Error",
          description: "The AI returned an unexpected data structure. Please try again.",
          variant: "destructive",
        });
        setPhase(1); // Go back to the input phase on error
      }
    } catch (error) {
      console.error("Failed to generate lesson plan structure:", error);
      toast({
        title: "Generation Failed",
        description: `Could not generate the lesson plan structure. ${error instanceof Error ? error.message : 'Please check your connection or API key and try again.'}`,
        variant: "destructive",
      });
      setPhase(1); // Go back to the input phase on error
    } finally {
      setIsGenerating(false);
    }
  };

  // Add a new section
  const addSection = () => {
    const newSection: LessonSection = {
      id: Date.now().toString(),
      title: 'NEW SECTION',
      keyPoints: 'Add key points here...',
      isEditing: false,
      time: '',
      teacherActivities: '',
      learnerActivities: '',
    };
    
    setSections([...sections, newSection]);
  };

  // Delete a section
  const deleteSection = (id: string) => {
    setSections(sections.filter(section => section.id !== id));
  };

  // Toggle edit mode for a section
  const toggleEditSection = (id: string) => {
    setSections(sections.map(section => 
        section.id === id 
          ? { ...section, isEditing: !section.isEditing } 
          : section
    ));
  };

  // Update section title
  const updateSectionTitle = (id: string, title: string) => {
    setSections(sections.map(section => 
        section.id === id 
          ? { ...section, title } 
          : section
    ));
  };

  // Update section key points
  const updateSectionKeyPoints = (id: string, keyPoints: string) => {
    setSections(sections.map(section => 
        section.id === id 
          ? { ...section, keyPoints } 
          : section
    ));
  };

  // Update section detail
  const updateSectionDetail = (id: string, field: string, value: string) => {
    setSections(sections.map(section => 
        section.id === id 
          ? { ...section, [field]: value } 
          : section
    ));
  };

  // --- Primary function to generate the *final* detailed lesson plan ---
  const generateLessonPlan = async () => {
    if (!topic.trim() || !level.trim()) {
      toast({ title: "Missing Information", description: "Please provide both a topic and a class level.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGenerationStep('generating');
    toast({ title: "Generating Lesson Plan", description: "The AI is working its magic..." });

    try {
      // Map the sections to match the service's expected type, including detail fields.
      const sectionsForService = sections.map(s => ({
        id: s.id,
        title: s.title,
        keyPoints: s.keyPoints
          + (s.time ? `\nTime Allocation: ${s.time}` : '')
          + (s.teacherActivities ? `\nTeacher Activities: ${s.teacherActivities}` : '')
          + (s.learnerActivities ? `\nLearner Activities: ${s.learnerActivities}` : ''),
      }));

      // Generate curriculum context for the AI prompt
      const curriculumContext = curriculum ? formatCurriculumForPrompt(curriculum) : undefined;

      // Call the robust service function with the correctly typed data, curriculum context, and language
      const response = await generateLessonPlanService(
        topic, 
        level, 
        sectionsForService, 
        curriculumContext,
        country || undefined,
        language as 'english' | 'french' | 'pidgin'
      );
      console.log('Response received in component:', response);
      
      if (response && response.jsonString) {
        // Store the JSON string for PDF export
        setRawJsonContent(response.jsonString);
        // Format the markdown using the JSON string
        const formattedMarkdown = formatAIResponseAsMarkdown(response.jsonString);
        console.log('Formatted markdown:', formattedMarkdown);
        setGeneratedContent(formattedMarkdown);
        setEditedContent(formattedMarkdown);
        setGenerationStep('complete');
        toast({ title: "Lesson Plan Generated!", description: "Your detailed lesson plan is ready for review." });
      } else {
        throw new Error("The AI returned an empty response.");
      }
    } catch (error) {
      console.error("Error generating detailed lesson plan:", error);
      toast({ title: "Generation Failed", description: `Could not generate the lesson plan. ${error instanceof Error ? error.message : 'Please try again.'}`, variant: "destructive" });
      setGenerationStep('idle');
    } finally {
      setIsGenerating(false);
    }
  };

  // Function to save the current lesson plan
  const saveLessonPlan = async () => {
    if (!rawJsonContent) {
      toast({
        title: "Error",
        description: "No lesson plan content to save.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to save a lesson plan.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Enhanced logging for debugging
      console.log("Attempting to save lesson plan...");
      console.log("User object:", user);
      console.log("Raw JSON content:", rawJsonContent);

      const lessonPlanData = {
        title: topic || 'Untitled Lesson Plan',
        level: level,
        content: JSON.parse(rawJsonContent),
        created_at: new Date().toISOString(),
        user_id: user.id,
      };

      console.log("Data to be saved:", lessonPlanData);

      const { data, error } = await supabase
        .from('lesson_plans')
        .insert(lessonPlanData)
        .select('id')
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: `Lesson plan saved successfully with ID: ${data.id}`,
      });
    } catch (error) {
      console.error("Error saving lesson plan to Supabase:", error);
      toast({
        title: "Error",
        description: "Failed to save lesson plan. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle exporting as PDF
  const handleExportPDF = async () => {
    if (!editedContent) {
      toast({
        title: 'Content is empty',
        description: 'There is no content to export.',
        variant: 'destructive',
      });
      return;
    }

    if (!rawJsonContent) {
      toast({
        title: 'Missing Lesson Data',
        description: 'Cannot export PDF without the generated lesson plan data.',
        variant: 'destructive',
      });
      return;
    }

    // Open the progress modal
    setExportType('pdf');
    setExportProgress('Preparing your lesson plan...');
    setExportComplete(false);
    setExportModalOpen(true);

    try {
      await exportToPDF(rawJsonContent, topic, level, (msg) => {
        setExportProgress(msg);
      });

      setExportComplete(true);
      setExportProgress('Your lesson plan PDF has been downloaded!');
    } catch (error) {
      console.error('PDF Export Error:', error);
      setExportModalOpen(false);
      toast({
        title: 'Export Failed',
        description: 'Could not export the lesson plan as a PDF.',
        variant: 'destructive',
      });
    }
  };

  // Handle exporting as PowerPoint
  const handleExportPowerPoint = async () => {
    // Open the progress modal
    setExportType('pptx');
    setExportProgress('Preparing your presentation...');
    setExportComplete(false);
    setExportModalOpen(true);

    try {
      // Use the actual export function with rawJsonContent for structured output
      await exportToPowerPoint(rawJsonContent || editedContent, topic, level, (msg) => {
        setExportProgress(msg);
      });

      setExportComplete(true);
      setExportProgress('Your PowerPoint presentation has been downloaded!');
    } catch (error) {
      console.error('Error exporting to PowerPoint:', error);
      setExportModalOpen(false);
      toast({
        title: "Export Failed",
        description: "There was a problem exporting your lesson plan to PowerPoint.",
        variant: "destructive",
      });
    }
  };

  // Function to move to the next phase
  const moveToNextPhase = () => {
    if (phase === 2) {
      setPhase(3);
    } else if (phase === 3) {
      // First, trigger the generation (side effect), then update the phase.
      // This avoids calling a state-updating function from within another state update.
      generateLessonPlan();
      setPhase(4);
    } else if (phase === 4) {
      // Loop back to the start
      setPhase(1);
    }
  };

  // Function to go back to the previous phase
  const goBack = () => {
    setPhase(prevPhase => {
      // If going back from Phase 4, clear generated content parts and reset step
      if (prevPhase === 4) {
        setGeneratedContent('');
        setEditedContent('');
        setGenerationStep('idle');
      }
      // If going back from Phase 1, go to country selection (Phase 0)
      if (prevPhase === 1) {
        setCountry('');
        setCurriculum(null);
        setLevel('');
        return 0 as 0 | 1 | 2 | 3 | 4;
      }
      return Math.max(0, prevPhase - 1) as 0 | 1 | 2 | 3 | 4;
    });
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      {/* Phase Stepper - shows progress through the workflow */}
      {phase > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            {[
              { num: 1, label: 'Topic' },
              { num: 2, label: 'Structure' },
              { num: 3, label: 'Review' },
              { num: 4, label: 'Generate' },
            ].map((step, idx) => (
              <React.Fragment key={step.num}>
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    phase >= step.num 
                      ? 'bg-primary text-white shadow-lg' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {phase > step.num ? '✓' : step.num}
                  </div>
                  <span className={`text-xs mt-1 hidden sm:block ${phase >= step.num ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
                {idx < 3 && (
                  <div className={`h-0.5 w-8 sm:w-16 transition-all duration-300 ${
                    phase > step.num ? 'bg-primary' : 'bg-muted'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Phase 0: Country Selection Screen */}
      {phase === 0 && (
        <div className="w-full max-w-2xl mx-auto mt-8">
          {/* Hero Section */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/15 shadow-lg mb-8">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative p-8 pb-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 mb-4 shadow-sm">
                <Globe className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 tracking-tight">
                Welcome to Mama Math
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                Select your country to get started with curriculum-aligned lesson plans.
              </p>
            </div>
          </div>

          {/* Country Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Cameroon Card */}
            <Card 
              className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 group"
              onClick={() => handleCountrySelect('cameroon')}
            >
              <CardContent className="pt-8 pb-8 text-center">
                <div className="text-6xl mb-4">🇨🇲</div>
                <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">Cameroon</h3>
                <p className="text-sm text-muted-foreground mt-2">Primary School Curriculum</p>
                <p className="text-xs text-muted-foreground mt-1">(Primary 1 - Primary 6)</p>
              </CardContent>
            </Card>

            {/* Nigeria Card */}
            <Card 
              className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 group"
              onClick={() => handleCountrySelect('nigeria')}
            >
              <CardContent className="pt-8 pb-8 text-center">
                <div className="text-6xl mb-4">🇳🇬</div>
                <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">Nigeria</h3>
                <p className="text-sm text-muted-foreground mt-2">Primary School Curriculum</p>
                <p className="text-xs text-muted-foreground mt-1">(Primary 1 - Primary 6)</p>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Lesson plans will be aligned with the selected country's national curriculum standards.
          </p>
        </div>
      )}

      {/* View Lesson Plans Button */}
      {phase === 1 && (
        <div className="flex justify-center mb-4">
          <Button onClick={() => navigate('/dashboard/view-lesson-plans')} variant="outline" className="shadow-sm border-primary/30 hover:bg-primary/5">
            <BookOpen className="h-4 w-4 mr-2 text-primary" />
            View Your Lesson Plans
          </Button>
        </div>
      )}

      {/* Phase 1: Welcome Screen */}
      {phase === 1 && (
        <div className="w-full max-w-2xl mx-auto mt-4">
          {/* Hero Section */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/15 shadow-lg mb-6">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative p-8 pb-6 text-center">
              {/* Icon badge */}
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 mb-4 shadow-sm">
                <GraduationCap className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2 tracking-tight">
                Mama Math Lesson Planner
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                Tell me what you want to teach, and I'll create a complete lesson plan tailored to the Cameroon primary curriculum.
              </p>
            </div>
          </div>

          {/* Input Section */}
          <Card className="border-border/60 shadow-md rounded-xl">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="topic" className="text-sm font-medium text-foreground">Topic</Label>
                  <div className="relative">
                    <Input
                      id="topic"
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Introduction to Addition"
                      className="pr-10 h-11 rounded-lg border-border/70 focus:border-primary focus:ring-primary/20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && topic.trim() && level) handleTopicSubmit();
                      }}
                    />
                    <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="level" className="text-sm font-medium text-foreground">Class Level</Label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger id="level" className="h-11 rounded-lg border-border/70 focus:border-primary focus:ring-primary/20">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableLevels().map((lvl) => (
                        <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Language Selection */}
              <div className="mb-5">
                <Label htmlFor="language" className="text-sm font-medium text-foreground">Lesson Plan Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language" className="h-11 rounded-lg border-border/70 focus:border-primary focus:ring-primary/20 mt-1.5">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">The lesson plan will be generated in this language.</p>
              </div>

              <Button
                size="lg"
                onClick={handleTopicSubmit}
                disabled={!topic.trim() || !level || isGenerating}
                className="w-full h-12 rounded-xl text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200 bg-primary hover:bg-primary/90"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    Get Started <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Examples Section */}
          <div className="mt-5">
            <div className="flex items-center gap-2 mb-3 px-1">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Try an example</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { text: 'Counting from 1 to 20', lvl: 'Primary 1' },
                { text: 'Basic Addition (Sums to 10)', lvl: 'Primary 1' },
                { text: 'Basic Subtraction', lvl: 'Primary 1' },
                { text: 'Shapes and Patterns', lvl: 'Primary 2' },
                { text: 'Measurement - Length', lvl: 'Primary 2' },
                { text: 'Introduction to Multiplication', lvl: 'Primary 3' },
              ].map((example) => (
                <button
                  key={example.text}
                  onClick={() => { setTopic(example.text); setLevel(example.lvl); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-border/70 bg-background hover:bg-primary/5 hover:border-primary/30 hover:text-primary text-muted-foreground transition-all duration-200 cursor-pointer"
                >
                  {example.text}
                  <span className="text-[10px] text-muted-foreground/60">· {example.lvl}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Change Country Button */}
          <div className="mt-4 text-center">
            <Button variant="ghost" size="sm" onClick={goBack} className="text-muted-foreground hover:text-primary">
              <Globe className="h-4 w-4 mr-2" />
              Change Country ({country === 'cameroon' ? 'Cameroon' : 'Nigeria'})
            </Button>
          </div>
        </div>
      )}

      {/* Phase 2: Lesson Scaffolding Screen (Structure Definition) */}
      {phase === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column (Canvas) - Takes 2/3 of the space */}
          <div className="md:col-span-2 space-y-4">
            <h2 className="text-2xl font-bold mb-4">Lesson Plan Structure</h2>
            <p className="text-muted-foreground mb-4">
              Customize the sections below to structure your lesson plan. Edit titles and key points, add or remove sections as needed.
            </p>

            <div className="space-y-4">
              {sections.map((section) => (
                <Card key={section.id} className="relative">
                  <CardContent className="pt-6">
                    {section.isEditing ? (
                      <div className="space-y-4">
                        <Input
                          value={section.title}
                          onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                          className="font-bold"
                        />
                        <Textarea
                          value={section.keyPoints}
                          onChange={(e) => updateSectionKeyPoints(section.id, e.target.value)}
                          rows={3}
                        />
                        <Input
                          value={section.time}
                          onChange={(e) => updateSectionDetail(section.id, 'time', e.target.value)}
                          placeholder="Time Allocation"
                          className="mt-2"
                        />
                        <Textarea
                          value={section.teacherActivities}
                          onChange={(e) => updateSectionDetail(section.id, 'teacherActivities', e.target.value)}
                          placeholder="Teacher's Activities"
                          rows={3}
                          className="mt-2"
                        />
                        <Textarea
                          value={section.learnerActivities}
                          onChange={(e) => updateSectionDetail(section.id, 'learnerActivities', e.target.value)}
                          placeholder="Learner's Activities"
                          rows={3}
                          className="mt-2"
                        />

                        <Button onClick={() => toggleEditSection(section.id)}>
                          <Save className="h-4 w-4 mr-2" /> Save
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-xl font-semibold">{section.title}</h3>
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => toggleEditSection(section.id)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteSection(section.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-muted-foreground">{section.keyPoints}</p>
                        {section.time && <p className="text-muted-foreground">Time: {section.time}</p>}
                        {section.teacherActivities && <p className="text-muted-foreground">Teacher's Activities: {section.teacherActivities}</p>}
                        {section.learnerActivities && <p className="text-muted-foreground">Learner's Activities: {section.learnerActivities}</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex space-x-4 mt-6">
              <Button variant="outline" onClick={addSection}>
                <PlusCircle className="h-4 w-4 mr-2" /> Add Section
              </Button>
              {/* Button to move to the next phase (Review Structure) */}
              <Button onClick={moveToNextPhase} disabled={sections.length === 0}>
                Review Structure <Send className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goBack}>
                Back
              </Button>
            </div>
          </div>

          {/* Right Column - Takes 1/3 of the space */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">Your Topic</h2>
            <Card className="bg-primary/10">
              <CardContent className="pt-6">
                <p className="text-xl">{topic}</p>
              </CardContent>
            </Card>
            
            <h3 className="text-xl font-semibold mt-8">Tips:</h3>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Be specific in your key points to get better AI-generated content</li>
              <li>Add custom sections for specialized lesson components</li>
              <li>Consider your audience's age and knowledge level</li>
              <li>Include hands-on activities for better engagement</li>
            </ul>
          </div>
        </div>
      )}

      {/* Phase 3: Structure Review and Finalize (New Phase) */}
      {phase === 3 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Review Lesson Plan Structure</h2>
          <p className="text-muted-foreground">Review the structure you've defined before generating the detailed lesson plan. Go back to make changes if needed.</p>
          
          <Card>
            <CardHeader>
              <CardTitle>Your Lesson Plan Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sections.map((section) => (
                  <div key={section.id} className="border-b pb-4 last:border-b-0">
                    <h3 className="text-xl font-semibold">{section.title}</h3>
                    <p className="text-muted-foreground">{section.keyPoints}</p>
                    {section.time && <p className="text-muted-foreground">Time: {section.time}</p>}
                    {section.teacherActivities && <p className="text-muted-foreground">Teacher's Activities: {section.teacherActivities}</p>}
                    {section.learnerActivities && <p className="text-muted-foreground">Learner's Activities: {section.learnerActivities}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between items-center mt-6">
            <Button variant="outline" onClick={goBack}>
              Back
            </Button>
            {/* Button to trigger final generation and move to Phase 4 */}
            <Button onClick={moveToNextPhase} disabled={isGenerating}>
               {isGenerating ? (
                 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
               ) : (
                 <Send className="h-4 w-4 mr-2" />
               )}
              {isGenerating ? "Generating..." : "Generate Detailed Lesson Plan"}
            </Button>
          </div>
        </div>
      )}

      {/* Phase 4: Final AI Generation, Display, and Editing */}
      {phase === 4 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-2xl font-bold">Your Detailed Lesson Plan</h2>
            <div className="flex flex-wrap gap-2">
              {/* Save Button - only enabled when generation is complete */}
              <Button onClick={saveLessonPlan} variant="outline" disabled={generationStep !== 'complete'}>
                <Save className="h-4 w-4 mr-2" /> Save
              </Button>
              {/* Export Buttons - only enabled when generation is complete */}
              <Button onClick={handleExportPDF} variant="outline" disabled={generationStep !== 'complete'} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-none">
                <FileText className="h-4 w-4 mr-2" /> PDF
              </Button>
              <Button onClick={handleExportPowerPoint} disabled={generationStep !== 'complete'} className="bg-orange-500 hover:bg-orange-600 text-white">
                <FileType className="h-4 w-4 mr-2" /> PowerPoint
              </Button>
            </div>
          </div>
          
          {/* Display content or loading based on generation step */}
          {generationStep === 'generating' && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-primary">
              <Loader2 className="h-12 w-12 animate-spin mb-4" />
               <p className="text-xl">Generating your detailed lesson plan...</p>
            </div>
          )}

          {generationStep === 'complete' && (
            <Card className="mb-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Complete Lesson Plan</CardTitle>
                <Button onClick={() => setIsEditingContent(!isEditingContent)} variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  {isEditingContent ? 'Preview Plan' : 'Edit Plan'}
                </Button>
              </CardHeader>
              <CardContent className="pt-6">
                {isEditingContent ? (
                  <Textarea
                    ref={textareaRef}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="min-h-[60vh] font-sans text-base bg-white dark:bg-gray-900 p-4 border rounded-md"
                    rows={20}
                  />
                ) : (
                  <div className="p-6 bg-gray-50 rounded-lg border min-h-[60vh] overflow-y-auto prose prose-indigo max-w-none whitespace-pre-wrap break-words">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{editedContent}</ReactMarkdown>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Back button in Phase 4 - visible unless generating */}
           {!isGenerating && (
             <div className="flex justify-start mt-6">
               <Button variant="outline" onClick={goBack}>
                 Back
               </Button>
             </div>
           )}

          {/* Next Steps section - visible only when complete */}
          {generationStep === 'complete' && (
          <div className="bg-primary/5 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">Next Steps</h3>
            <p className="mb-4">Your lesson plan is ready to use! You can:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Download as PDF to print or share with colleagues</li>
              <li>Export as PowerPoint for classroom presentation</li>
              <li>Create another lesson plan for a different topic</li>
            </ul>
          </div>
          )}
        </div>
      )}
      {/* Export Progress Modal */}
      <ExportProgressModal
        isOpen={exportModalOpen}
        exportType={exportType}
        progressMessage={exportProgress}
        isComplete={exportComplete}
        onClose={() => setExportModalOpen(false)}
      />
    </div>
  );
};

export default LessonPlanGenerator;