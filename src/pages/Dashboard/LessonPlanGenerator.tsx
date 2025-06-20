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
import { PlusCircle, Trash2, Download, FileText, FileType, Send, Edit, Save, Plus, X, Loader2, Lightbulb } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendMessage } from '@/services/api'; // Import sendMessage
import { generateLessonPlan as generateLessonPlanService, exportToPDF, exportToPowerPoint, formatAIResponseAsMarkdown } from '@/services/lessonPlan';

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

const LessonPlanGenerator: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast(); // Use the toast from the hook
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);
  const [topic, setTopic] = useState<string>('');
  const [level, setLevel] = useState<string>('');
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
  const [savedLessonPlans, setSavedLessonPlans] = useState<LessonPlan[]>([]);

  // Load saved lesson plans from localStorage on mount
  useEffect(() => {
    const storedPlans = localStorage.getItem('lessonPlans');
    if (storedPlans) {
      setSavedLessonPlans(JSON.parse(storedPlans));
    }
  }, []);

  // Update lessonPlan state (used for saving)
  useEffect(() => {
    setLessonPlan({
      topic,
      level,
      sections,
      generatedContent: generatedContent // Use generatedContent for the final save
    });
  }, [topic, level, sections, generatedContent]); // Depend on generatedContent

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
      // New prompt asking for a JSON object
      const prompt = `Based on the topic "${topic}" for ${level} students in Cameroon, generate a structured lesson plan outline. You must provide between 5 and 7 sections. Respond with ONLY a valid JSON object in the following format: { "sections": [{"title": "SECTION_TITLE", "keyPoints": "KEY_POINTS_HERE"}] }`;
      
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
      // Map the sections to match the service's expected type, removing UI-specific fields.
      const sectionsForService = sections.map(s => ({
        id: s.id,
        title: s.title,
        keyPoints: s.keyPoints,
      }));

      // Call the robust service function with the correctly typed data
      const rawJsonResponse = await generateLessonPlanService(topic, level, sectionsForService);
      
      if (rawJsonResponse) {
        setRawJsonContent(rawJsonResponse);
        const formattedMarkdown = formatAIResponseAsMarkdown(rawJsonResponse);
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
  const saveLessonPlan = () => {
    if (!editedContent) {
      toast({
        title: 'Content is empty',
        description: 'There is no content to save.',
        variant: 'destructive',
      });
      return;
    }

    const planToSave: LessonPlan = {
      id: lessonPlan.id || `lesson-${Date.now()}`,
      topic,
      level, // Fix: Add level to saved plan
      sections,
      generatedContent: editedContent,
    };

    // Add the new plan to the array and save to localStorage
    const updatedPlans = [...savedLessonPlans, planToSave];
    setSavedLessonPlans(updatedPlans);
    localStorage.setItem('lessonPlans', JSON.stringify(updatedPlans));

    toast({
      title: "Lesson Plan Saved",
      description: `'${topic}' has been saved.`,
    });

    // Optionally navigate to the lessons page
    navigate('/lessons');
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

    try {
      if (!rawJsonContent) {
      toast({
        title: 'Missing Lesson Data',
        description: 'Cannot export PDF without the generated lesson plan data.',
        variant: 'destructive',
      });
      return;
    }
    await exportToPDF(rawJsonContent, topic, level);
      toast({
        title: 'Export Successful',
        description: 'Your lesson plan has been exported as a PDF.',
      });
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast({
        title: 'Export Failed',
        description: 'Could not export the lesson plan as a PDF.',
        variant: 'destructive',
      });
    }
  };

  // Handle exporting as PowerPoint
  const handleExportPowerPoint = async () => {
    try {
      // Show loading toast
      toast({
        title: "Exporting as PowerPoint",
        description: "Your lesson plan is being prepared for download...",
      });
      
      // Use the actual export function
      await exportToPowerPoint(editedContent, topic);
      
      // Show success toast
      toast({
        title: "Success!",
        description: "Your lesson plan has been downloaded as PowerPoint.",
      });
    } catch (error) {
      console.error('Error exporting to PowerPoint:', error);
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
      return Math.max(1, prevPhase - 1) as 1 | 2 | 3 | 4;
    });
  };

  // Handler for the "Continue Generation" button
  // const handleContinueGeneration = () => {
  //   generateLessonPlan('part2');
  // };

  // Handler for the "Merge Generations" button
  // const handleMergeGenerations = () => {
  //   const combinedContent = generatedContentPart1 + '\n\n' + generatedContentPart2;
  //   setGeneratedContent(combinedContent); // Set final generated content state
  //   setEditedContent(combinedContent); // Set initial editable content
  //   setGenerationStep('complete');
  //   toast({
  //     title: "Lesson Plan Merged!",
  //     description: "The two parts have been combined. Review and edit below.",
  //     variant: "default", 
  //   });
  // };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      {/* Phase 1: Welcome Screen */}
      {phase === 1 && (
        <Card className="w-full max-w-3xl mx-auto mt-10">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-primary">Mama Math Lesson Plan Generator</CardTitle>
            <CardDescription className="text-xl mt-2">
              I'm Mama Math, your lesson plan generator assistant. Tell me what you want to teach and I'll help you create your lesson.
            </CardDescription>
          </CardHeader>

          {/* Suggested Questions Section (Card UI) */}
          <Card className="mt-4 mx-6 bg-primary/5 border border-border shadow-sm mb-6">
            <CardHeader className="pb-2 flex items-center">
               <Lightbulb className="h-5 w-5 text-primary mr-2" />
               <CardTitle className="text-lg font-semibold text-foreground m-0">Examples:</CardTitle>
            </CardHeader>
            <CardContent className="py-3 px-4">
              <ul className="list-disc pl-10 text-muted-foreground space-y-2">
                <li>"understanding shapes for primary 2"</li>
                <li>"Counting from one to 20 in primary 1"</li>
                <li>"Long Division for Primary 5"</li>
                <li>"BODMAS with local examples for primary 6"</li>
                <li>"Introduction Algebra for primary 6"</li>
                <li>"Adition,substraction and division of numbers"</li>
              </ul>
            </CardContent>
          </Card>

          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic</Label>
                  <div className="relative">
                    <Input
                      id="topic"
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Introduction to Addition"
                      className="pr-10"
                    />
                    <Lightbulb className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">Class Level</Label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger id="level">
                      <SelectValue placeholder="Select a class level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Primary 1">Primary 1</SelectItem>
                      <SelectItem value="Primary 2">Primary 2</SelectItem>
                      <SelectItem value="Primary 3">Primary 3</SelectItem>
                      <SelectItem value="Primary 4">Primary 4</SelectItem>
                      <SelectItem value="Primary 5">Primary 5</SelectItem>
                      <SelectItem value="Primary 6">Primary 6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button 
                size="lg" 
                onClick={handleTopicSubmit}
                disabled={!topic.trim() || !level || isGenerating}
                className="mt-4 px-8"
              >
                Start <Send className="ml-2 h-4 w-4" />
              </Button>
            </div>

          </CardContent>
        </Card>
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
                    <h3 className="text-xl font-semibold">{section.heading}</h3>
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
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Your Detailed Lesson Plan</h2>
            <div className="flex space-x-2">
              {/* Save Button - only enabled when generation is complete */}
              <Button onClick={saveLessonPlan} variant="outline" disabled={generationStep !== 'complete'}>
                <Save className="h-4 w-4 mr-2" /> Save Lesson Plan
              </Button>
              {/* Export Buttons - only enabled when generation is complete */}
              <Button onClick={handleExportPDF} variant="outline" disabled={generationStep !== 'complete'}>
                <FileText className="h-4 w-4 mr-2" /> Download as PDF
              </Button>
              <Button onClick={handleExportPowerPoint} disabled={generationStep !== 'complete'}>
                <FileType className="h-4 w-4 mr-2" /> Download as PowerPoint
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
    </div>
  );
};

export default LessonPlanGenerator;