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
import { getCurriculumContent, getCurriculumContentAsync, getDefaultClassLevel, getClassLevelsForCountry, formatCurriculumForPrompt, formatSelectedTopicForPrompt, getTopicsForClassLevel, type CurriculumContent, type TopicItem } from '@/data/curriculumContent';
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
  const [selectedTopicId, setSelectedTopicId] = useState<string>(''); // For dropdown selection
  const [availableTopics, setAvailableTopics] = useState<TopicItem[]>([]); // Topics for current class level
  const [selectedTopicData, setSelectedTopicData] = useState<TopicItem | null>(null); // Full topic data
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
    
    // Load topics for the default class level
    const topics = getTopicsForClassLevel(selectedCountry, defaultLevel);
    setAvailableTopics(topics);
    setSelectedTopicId('');
    setSelectedTopicData(null);
    setTopic('');
    
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

  // Handle class level change - update available topics
  const handleLevelChange = (newLevel: string) => {
    setLevel(newLevel);
    if (country) {
      const topics = getTopicsForClassLevel(country, newLevel);
      setAvailableTopics(topics);
      setSelectedTopicId('');
      setSelectedTopicData(null);
      setTopic('');
    }
  };

  // Handle topic selection from dropdown
  const handleTopicSelect = (topicId: string) => {
    setSelectedTopicId(topicId);
    const topicData = availableTopics.find(t => t.id === topicId);
    if (topicData) {
      setSelectedTopicData(topicData);
      setTopic(topicData.title);
    }
  };

  // Group topics by strand for better organization in dropdown
  const getTopicsGroupedByStrand = (): Record<string, TopicItem[]> => {
    return availableTopics.reduce((acc, topic) => {
      if (!acc[topic.strand]) {
        acc[topic.strand] = [];
      }
      acc[topic.strand].push(topic);
      return acc;
    }, {} as Record<string, TopicItem[]>);
  };

  // Get available class levels based on selected country
  const getAvailableLevels = (): string[] => {
    if (!country) return [];
    return getClassLevelsForCountry(country);
  };

  // Generate initial lesson structure using AI based on topic
  const handleTopicSubmit = async () => {
    if (!topic || !level || !selectedTopicId) {
      toast({
        title: "Missing Information",
        description: "Please select a topic and class level.",
        variant: "destructive",
      });
      return;
    }

    // Topics from dropdown are all math-related, no need to check

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
      
      // Generate detailed topic-specific curriculum context using the selected topic data
      const topicCurriculumContext = selectedTopicData && country 
        ? formatSelectedTopicForPrompt(selectedTopicData, level, country)
        : (curriculum ? formatCurriculumForPrompt(curriculum) : '');
      
      const prompt = `Based on the topic "${topic}" for ${level} students in ${countryName}, generate a structured lesson plan outline that strictly aligns with the official national curriculum standards.

${languageInstruction}

${topicCurriculumContext}

CRITICAL: Your lesson plan structure MUST:
1. Use the EXACT learning objectives from the curriculum alignment above
2. Incorporate the suggested teaching activities and methodology
3. Include the teaching aids/materials specified
4. Follow the assessment methods provided
5. Design homework based on the real-life applications listed

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

      // Generate curriculum context for the AI prompt (general curriculum)
      const generalCurriculumContext = curriculum ? formatCurriculumForPrompt(curriculum) : '';
      
      // Generate detailed topic-specific curriculum context using the selected topic data
      const topicCurriculumContext = selectedTopicData && country 
        ? formatSelectedTopicForPrompt(selectedTopicData, level, country)
        : '';
      
      // Combine both contexts - topic-specific context takes priority
      const fullCurriculumContext = topicCurriculumContext || generalCurriculumContext || undefined;

      // Call the robust service function with the correctly typed data, curriculum context, and language
      const response = await generateLessonPlanService(
        topic, 
        level, 
        sectionsForService, 
        fullCurriculumContext,
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
        <div className="w-full max-w-3xl mx-auto mt-6 px-1">
          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-emerald-50 to-teal-50 dark:from-primary/20 dark:via-primary/5 dark:to-background border border-primary/20 shadow-xl mb-8">
            {/* Soft glow blobs */}
            <div className="absolute top-0 right-0 w-56 h-56 bg-primary/10 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-44 h-44 bg-emerald-400/10 rounded-full translate-y-1/3 -translate-x-1/3 blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 w-36 h-36 bg-teal-300/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-2xl pointer-events-none" />

            {/* Floating math symbols – decorative */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
              <span className="absolute top-5 left-8 text-4xl font-black text-primary/[0.07]">∑</span>
              <span className="absolute top-10 right-14 text-3xl font-black text-primary/[0.07]">π</span>
              <span className="absolute bottom-7 left-14 text-3xl font-black text-primary/[0.07]">÷</span>
              <span className="absolute bottom-8 right-10 text-4xl font-black text-primary/[0.07]">×</span>
              <span className="absolute top-1/2 left-5 text-2xl font-black text-primary/[0.06]">√</span>
              <span className="absolute top-7 left-[38%] text-2xl font-black text-primary/[0.06]">+</span>
              <span className="absolute bottom-5 right-[35%] text-3xl font-black text-primary/[0.06]">%</span>
              <span className="absolute top-1/3 right-[20%] text-2xl font-black text-primary/[0.05]">∞</span>
            </div>

            <div className="relative p-10 text-center">
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg shadow-primary/30 mb-5 overflow-hidden">
                <img src="/mama%20math.svg" alt="Mama Math" className="w-full h-full object-cover" />
              </div>

              {/* Headline */}
              <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-3 tracking-tight">
                Welcome to{' '}
                <span className="text-primary relative">
                  Mama Math
                  <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-primary/30 rounded-full" />
                </span>
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                Choose your country to unlock curriculum-aligned, AI-generated mathematics lesson plans tailored for primary school teachers.
              </p>


            </div>
          </div>

          {/* Section label */}
          <p className="text-center text-[11px] font-bold text-muted-foreground mb-5 uppercase tracking-[0.2em]">
            Select Your Country
          </p>

          {/* Country Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Cameroon Card */}
            <button
              className="group relative overflow-hidden rounded-2xl border-2 border-transparent bg-white dark:bg-card shadow-md hover:shadow-2xl hover:border-primary/40 hover:-translate-y-1.5 active:translate-y-0 transition-all duration-300 text-left focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2"
              onClick={() => handleCountrySelect('cameroon')}
            >
              {/* Flag-colour top stripe */}
              <div className="h-1.5 w-full bg-gradient-to-r from-green-600 via-red-500 to-yellow-400" />

              {/* Hover glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />

              <div className="relative p-6">
                <div className="flex items-start justify-between mb-5">
                  <span className="text-5xl leading-none drop-shadow-sm">🇨🇲</span>
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted group-hover:bg-primary transition-colors duration-300 shadow-sm">
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-white transition-colors duration-300 group-hover:translate-x-0.5" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-1">
                  Cameroon
                </h3>
                <p className="text-sm text-muted-foreground mb-4">Primary School Mathematics</p>

                <div className="pt-4 border-t border-border/60 flex items-center gap-2 text-xs text-muted-foreground">
                  <GraduationCap className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Primary 1 – Primary 6</span>
                </div>
              </div>
            </button>

            {/* Nigeria Card */}
            <button
              className="group relative overflow-hidden rounded-2xl border-2 border-transparent bg-white dark:bg-card shadow-md hover:shadow-2xl hover:border-primary/40 hover:-translate-y-1.5 active:translate-y-0 transition-all duration-300 text-left focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2"
              onClick={() => handleCountrySelect('nigeria')}
            >
              {/* Flag-colour top stripe */}
              <div className="h-1.5 w-full bg-gradient-to-r from-green-600 via-green-100 to-green-600" />

              {/* Hover glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />

              <div className="relative p-6">
                <div className="flex items-start justify-between mb-5">
                  <span className="text-5xl leading-none drop-shadow-sm">🇳🇬</span>
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted group-hover:bg-primary transition-colors duration-300 shadow-sm">
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-white transition-colors duration-300 group-hover:translate-x-0.5" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors mb-1">
                  Nigeria
                </h3>
                <p className="text-sm text-muted-foreground mb-4">Primary School Mathematics</p>

                <div className="pt-4 border-t border-border/60 flex items-center gap-2 text-xs text-muted-foreground">
                  <GraduationCap className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Primary 1 – Primary 3</span>
                </div>
              </div>
            </button>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1.5">
            <Globe className="h-3.5 w-3.5 flex-shrink-0" />
            Lesson plans will be aligned with your selected country's national curriculum standards.
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
          <Card className="border-0 shadow-xl rounded-2xl bg-card/95 backdrop-blur-sm overflow-hidden">
            {/* Progress Indicator */}
            <div className="px-6 pt-5 pb-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Progress</span>
                <span className="text-xs font-semibold text-primary">
                  {[level, selectedTopicId, language !== 'english'].filter(Boolean).length}/3 steps
                </span>
              </div>
              <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${([level, selectedTopicId, true].filter(Boolean).length / 3) * 100}%` }}
                />
              </div>
            </div>

            <CardContent className="p-6 pt-5">
              {/* Step 1: Class Level Selection */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${level ? 'bg-primary text-white shadow-md shadow-primary/30' : 'bg-muted text-muted-foreground'}`}>
                    <span className="text-sm font-bold">1</span>
                  </div>
                  <div>
                    <Label htmlFor="level" className="text-sm font-semibold text-foreground">Class Level</Label>
                    <p className="text-xs text-muted-foreground">Select the grade you're teaching</p>
                  </div>
                </div>
                <Select value={level} onValueChange={handleLevelChange}>
                  <SelectTrigger id="level" className="h-12 rounded-xl border-2 border-border/50 bg-background hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 pl-4">
                    <SelectValue placeholder="Choose a class level..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-2 border-border/50 shadow-xl">
                    {getAvailableLevels().map((lvl) => (
                      <SelectItem key={lvl} value={lvl} className="rounded-lg my-0.5 cursor-pointer hover:bg-primary/10 focus:bg-primary/10">
                        <span className="font-medium">{lvl}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/40"></div></div>
              </div>

              {/* Step 2: Topic Selection from Curriculum */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${selectedTopicId ? 'bg-primary text-white shadow-md shadow-primary/30' : level ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <span className="text-sm font-bold">2</span>
                  </div>
                  <div>
                    <Label htmlFor="topic" className="text-sm font-semibold text-foreground">Curriculum Topic</Label>
                    <p className="text-xs text-muted-foreground">Select from the {country === 'cameroon' ? 'Cameroon' : 'Nigeria'} curriculum</p>
                  </div>
                </div>
                <Select value={selectedTopicId} onValueChange={handleTopicSelect} disabled={availableTopics.length === 0}>
                  <SelectTrigger 
                    id="topic" 
                    className={`h-12 rounded-xl border-2 transition-all duration-200 pl-4 ${
                      availableTopics.length === 0 
                        ? 'border-border/30 bg-muted/30 text-muted-foreground cursor-not-allowed' 
                        : 'border-border/50 bg-background hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20'
                    }`}
                  >
                    <SelectValue placeholder={availableTopics.length === 0 ? "Select a class level first" : "Browse curriculum topics..."} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-2 border-border/50 shadow-xl max-h-[320px]">
                    {Object.entries(getTopicsGroupedByStrand()).map(([strand, topics]) => (
                      <div key={strand} className="mb-1">
                        <div className="px-3 py-2 text-xs font-bold text-primary uppercase tracking-wider bg-gradient-to-r from-primary/10 to-transparent sticky top-0 backdrop-blur-sm border-b border-primary/10">
                          📚 {strand}
                        </div>
                        {topics.map((t) => (
                          <SelectItem 
                            key={t.id} 
                            value={t.id} 
                            className="pl-5 py-2.5 rounded-lg my-0.5 cursor-pointer hover:bg-primary/10 focus:bg-primary/10"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{t.title}</span>
                              <span className="text-[10px] text-muted-foreground mt-0.5">{t.objectives[0]?.slice(0, 50)}...</span>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
                {availableTopics.length === 0 && level && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <span className="text-amber-600 dark:text-amber-400">⚠️</span>
                    <p className="text-xs text-amber-700 dark:text-amber-300">Topics for {level} are coming soon. Please select Primary 1 or Primary 2.</p>
                  </div>
                )}
              </div>

              {/* Selected Topic Details Card */}
              {selectedTopicData && (
                <div className="mb-6 p-4 bg-gradient-to-br from-primary/8 via-primary/5 to-transparent rounded-xl border border-primary/20 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-foreground text-base leading-tight">{selectedTopicData.title}</h4>
                      <span className="inline-flex items-center px-2 py-0.5 mt-1.5 text-[10px] font-semibold text-primary bg-primary/10 rounded-full">
                        {selectedTopicData.strand}
                      </span>
                      <div className="mt-3 space-y-2">
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Learning Objectives</p>
                          <ul className="space-y-1">
                            {selectedTopicData.objectives.slice(0, 3).map((obj, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-xs text-foreground/80">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{obj}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {selectedTopicData.suggestedMaterials && selectedTopicData.suggestedMaterials.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Materials Needed</p>
                            <div className="flex flex-wrap gap-1">
                              {selectedTopicData.suggestedMaterials.map((mat, idx) => (
                                <span key={idx} className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-background border border-border/60 rounded-md text-muted-foreground">
                                  {mat}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/40"></div></div>
              </div>

              {/* Step 3: Language Selection */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary text-white shadow-md shadow-primary/30 transition-all duration-300">
                    <span className="text-sm font-bold">3</span>
                  </div>
                  <div>
                    <Label htmlFor="language" className="text-sm font-semibold text-foreground">Lesson Language</Label>
                    <p className="text-xs text-muted-foreground">Choose the language for your lesson plan</p>
                  </div>
                </div>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language" className="h-12 rounded-xl border-2 border-border/50 bg-background hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 pl-4">
                    <SelectValue placeholder="Select language..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-2 border-border/50 shadow-xl">
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value} className="rounded-lg my-0.5 cursor-pointer hover:bg-primary/10 focus:bg-primary/10">
                        <span className="font-medium">{lang.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Button */}
              <Button
                size="lg"
                onClick={handleTopicSubmit}
                disabled={!selectedTopicId || !level || isGenerating}
                className={`w-full h-14 rounded-xl text-base font-bold transition-all duration-300 ${
                  !selectedTopicId || !level 
                    ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                    : 'bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {isGenerating ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Generating Your Lesson Plan...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5" />
                    <span>Generate Lesson Plan</span>
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </Button>

              {/* Helper text */}
              {!selectedTopicId && level && availableTopics.length > 0 && (
                <p className="text-center text-xs text-muted-foreground mt-3">
                  Select a topic above to continue
                </p>
              )}
            </CardContent>
          </Card>

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