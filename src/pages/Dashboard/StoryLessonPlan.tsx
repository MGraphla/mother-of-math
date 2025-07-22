import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Trash2, Download, FileText, Presentation, Loader2, BookOpen, FileType, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { generateStoryLessonPlan, exportToPDF, exportToPowerPoint } from "@/services/storyLessonPlan";
import ReactMarkdown from 'react-markdown';

interface LessonSection {
  id: string;
  title: string;
  keyPoints: string;
}

const defaultSections: LessonSection[] = [
  {
    id: "1",
    title: "STORY INTRODUCTION",
    keyPoints: "Engaging story opening, character introduction, setting the scene with local context and familiar names."
  },
  {
    id: "2",
    title: "MATH PROBLEM IN STORY",
    keyPoints: "Present the mathematical challenge naturally within the story context, make it relatable and age-appropriate."
  },
  {
    id: "3",
    title: "STORY DEVELOPMENT & SOLUTION",
    keyPoints: "Guide students through solving the math problem as part of the story, use characters to demonstrate thinking."
  },
  {
    id: "4",
    title: "STORY CONCLUSION & PRACTICE",
    keyPoints: "Happy ending that reinforces the math concept, additional practice activities, story-based exercises."
  }
];

// Define the structure for a saved story lesson plan
interface SavedStoryLessonPlan {
  id: string;
  topic: string;
  level: string;
  generatedContent: string;
  createdAt?: string;
}

const StoryLessonPlan = () => {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("");
  const [sections, setSections] = useState<LessonSection[]>(defaultSections);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState("");
  const [currentPhase, setCurrentPhase] = useState<"welcome" | "scaffolding" | "editing">("welcome");
  const [isExporting, setIsExporting] = useState(false);
  const [savedStoryLessonPlans, setSavedStoryLessonPlans] = useState<SavedStoryLessonPlan[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  // Load saved story lesson plans from localStorage on component mount
  useEffect(() => {
    const storedPlans = localStorage.getItem('storyLessonPlans');
    if (storedPlans) {
      try {
        const parsedPlans = JSON.parse(storedPlans);
        // Add level property for backward compatibility
        const plansWithLevel = parsedPlans.map((plan: any) => ({
          ...plan,
          level: plan.level || 'N/A',
        }));
        setSavedStoryLessonPlans(plansWithLevel);
      } catch (error) {
        console.error("Failed to parse story lesson plans from localStorage:", error);
        toast.error("Could not load saved story lesson plans.");
      }
    }
  }, []);

  const handleStart = () => {
    if (!topic.trim()) {
      toast.error("Please enter a math topic for your story");
      return;
    }
    if (!level.trim()) {
      toast.error("Please enter the grade level");
      return;
    }
    setCurrentPhase("scaffolding");
  };

  const handleSectionChange = (id: string, field: "title" | "keyPoints", value: string) => {
    setSections(sections.map(section => 
      section.id === id ? { ...section, [field]: value } : section
    ));
  };

  const addSection = () => {
    const newSection: LessonSection = {
      id: Date.now().toString(),
      title: "NEW STORY SECTION",
      keyPoints: "Enter key story elements and math concepts for this section..."
    };
    setSections([...sections, newSection]);
  };

  const deleteSection = (id: string) => {
    if (sections.length <= 1) {
      toast.error("You must have at least one section");
      return;
    }
    setSections(sections.filter(section => section.id !== id));
  };

  const handleGenerateStoryLessonPlan = async () => {
    setIsGenerating(true);
    try {
      const plan = await generateStoryLessonPlan(topic, level, sections);
      setGeneratedPlan(plan);
      
      // Save the generated plan
      const newPlan: SavedStoryLessonPlan = {
        id: Date.now().toString(),
        topic,
        level,
        generatedContent: plan,
        createdAt: new Date().toISOString()
      };
      
      const updatedPlans = [...savedStoryLessonPlans, newPlan];
      setSavedStoryLessonPlans(updatedPlans);
      localStorage.setItem('storyLessonPlans', JSON.stringify(updatedPlans));
      
      setCurrentPhase("editing");
      toast.success("Story lesson plan generated successfully!");
    } catch (error) {
      toast.error("Failed to generate story lesson plan. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async (format: "pdf" | "pptx") => {
    setIsExporting(true);
    try {
      if (format === "pdf") {
        await exportToPDF(generatedPlan, topic, level);
        toast.success("PDF exported successfully!");
      } else {
        await exportToPowerPoint(generatedPlan, topic);
        toast.success("PowerPoint exported successfully!");
      }
    } catch (error) {
      toast.error(`Failed to export to ${format}. Please try again.`);
    } finally {
      setIsExporting(false);
    }
  };

  // Function to delete a story lesson plan
  const deleteStoryLessonPlan = (id: string) => {
    const updatedPlans = savedStoryLessonPlans.filter(plan => plan.id !== id);
    setSavedStoryLessonPlans(updatedPlans);
    localStorage.setItem('storyLessonPlans', JSON.stringify(updatedPlans));
    toast.success("Story lesson plan deleted.");
    // If the deleted plan was the one being viewed, close the view
    if (selectedLessonId === id) {
      setSelectedLessonId(null);
    }
  };

  // Handle exporting as PDF
  const handleExportPDF = async (lessonPlan: SavedStoryLessonPlan) => {
    try {
      setIsExporting(true);
      await exportToPDF(lessonPlan.generatedContent, lessonPlan.topic, lessonPlan.level);
      toast.success("PDF exported successfully!");
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast.error("Failed to export as PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Handle exporting as PowerPoint
  const handleExportPowerPoint = async (lessonPlan: SavedStoryLessonPlan) => {
    try {
      setIsExporting(true);
      await exportToPowerPoint(lessonPlan.generatedContent, lessonPlan.topic);
      toast.success("PowerPoint exported successfully!");
    } catch (error) {
      console.error("Error exporting to PowerPoint:", error);
      toast.error("Failed to export as PowerPoint. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Find the selected lesson plan
  const selectedLesson = savedStoryLessonPlans.find(plan => plan.id === selectedLessonId);

  if (currentPhase === "welcome") {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          {/* View Saved Lessons Button at Top */}
          {savedStoryLessonPlans.length > 0 && (
            <div className="mb-6">
              <Button 
                onClick={() => setCurrentPhase("editing")}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-8 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                size="lg"
              >
                <BookOpen className="h-5 w-5 mr-2" />
                View Your Saved Lessons ({savedStoryLessonPlans.length})
                <Sparkles className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="h-8 w-8 text-green-700" />
              <BookOpen className="h-8 w-8 text-green-700" />
            </div>
            <h1 className="text-3xl font-bold text-green-800">Story Lesson Plan Generator</h1>
            <p className="text-lg text-muted-foreground">
              Create engaging mathematical stories that teach concepts through culturally relevant narratives. 
              Perfect for making math fun and relatable for young learners!
            </p>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 my-4 text-gray-700">
            <h3 className="text-lg font-semibold mb-3 text-green-800">Story Features:</h3>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>Local characters with familiar names (Ambe, Manka, Chia, Ngum)</li>
              <li>Culturally relevant settings (markets, gardens, schools)</li>
              <li>Age-appropriate language and concepts</li>
              <li>Natural integration of math problems</li>
              <li>Happy endings that reinforce learning</li>
            </ul>
          </div>

          <div className="space-y-4">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Addition and Subtraction, Counting, Shapes"
              className="w-full"
            />
            <Input
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="e.g., Grade 2, Primary 2, Nursery 2"
              className="w-full"
            />
            <Button onClick={handleStart} className="w-full">
              <Sparkles className="h-4 w-4 mr-2" />
              Create Story Lesson Plan
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (currentPhase === "scaffolding") {
    return (
      <div className="flex gap-6 p-6">
        {/* Left Column - Canvas */}
        <div className="flex-1 space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-mama-purple" />
              Story Lesson Plan Structure
            </h2>
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={section.title}
                      onChange={(e) => handleSectionChange(section.id, "title", e.target.value)}
                      className="font-semibold"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSection(section.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={section.keyPoints}
                    onChange={(e) => handleSectionChange(section.id, "keyPoints", e.target.value)}
                    placeholder="Enter story elements and math concepts..."
                    className="min-h-[100px]"
                  />
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full"
                onClick={addSection}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Story Section
              </Button>
            </div>
            <Button
              className="w-full mt-6"
              onClick={handleGenerateStoryLessonPlan}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Your Story...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Story Lesson Plan Now
                </>
              )}
            </Button>
          </Card>
        </div>

        {/* Right Column - Topic Display */}
        <div className="w-80 space-y-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-2">Your Math Topic</h3>
            <div className="bg-mama-purple/10 p-4 rounded-lg">
              <p className="text-mama-purple font-medium">{topic}</p>
              <p className="text-sm text-muted-foreground mt-1">Grade: {level}</p>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-2 text-mama-purple">Story Example</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>Characters:</strong> Ambe, Manka, Chia</p>
              <p><strong>Setting:</strong> Ntarinkon Market, Mile 3</p>
              <p><strong>Math Concept:</strong> Naturally embedded</p>
              <p><strong>Ending:</strong> Happy resolution</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Editing Phase - Display saved story lesson plans
  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-mama-purple" />
        <h1 className="text-2xl sm:text-3xl font-bold text-mama-dark">Saved Story Lesson Plans</h1>
      </div>

      {savedStoryLessonPlans.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <BookOpen className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-mama-purple/30" />
          <p className="text-base sm:text-lg">No story lesson plans created yet.</p>
          <p className="text-sm">Create your first mathematical story!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedStoryLessonPlans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`cursor-pointer hover:shadow-lg transition-shadow ${
                selectedLessonId === plan.id ? 'border-mama-purple border-2' : ''
              }`}
              onClick={() => setSelectedLessonId(plan.id)}
            >
              <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <BookOpen className="h-4 w-4 text-mama-purple flex-shrink-0" />
                  <CardTitle className="text-base sm:text-lg font-semibold truncate">{plan.topic}</CardTitle>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="flex-shrink-0 ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteStoryLessonPlan(plan.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-sm">
                  Story-based lesson for {plan.level} • Math through storytelling
                </CardDescription>
                {plan.createdAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Created: {new Date(plan.createdAt).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedLesson && (
        <Card className="mt-6">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-mama-purple" />
              <CardTitle className="text-xl sm:text-2xl font-bold">{selectedLesson.topic}</CardTitle>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button 
                onClick={() => handleExportPDF(selectedLesson)} 
                variant="outline" 
                size="sm"
                disabled={isExporting}
                className="w-full sm:w-auto"
              >
                <FileText className="h-4 w-4 mr-2" /> 
                {isExporting ? "Exporting..." : "Download PDF"}
              </Button>
              <Button 
                onClick={() => handleExportPowerPoint(selectedLesson)} 
                variant="outline" 
                size="sm"
                disabled={isExporting}
                className="w-full sm:w-auto"
              >
                <FileType className="h-4 w-4 mr-2" /> 
                {isExporting ? "Exporting..." : "Download PowerPoint"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none overflow-x-auto">
              <ReactMarkdown>{selectedLesson.generatedContent}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StoryLessonPlan;
