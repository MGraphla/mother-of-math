import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Trash2, Download, FileText, Presentation, Loader2, BookOpen, FileType } from "lucide-react";
import { toast } from "sonner";
import { generateLessonPlan, exportToPDF, exportToPowerPoint } from "@/services/lessonPlan";
import ReactMarkdown from 'react-markdown';

interface LessonSection {
  id: string;
  title: string;
  keyPoints: string;
}

const defaultSections: LessonSection[] = [
  {
    id: "1",
    title: "INTRODUCTION",
    keyPoints: "Lesson objectives, brief hook to engage students, link to prior knowledge."
  },
  {
    id: "2",
    title: "PRESENTATION",
    keyPoints: "Step-by-step explanation of the new concept, create examples to use, materials needed."
  },
  {
    id: "3",
    title: "EVALUATION",
    keyPoints: "write and generate a detailed lesson plan for this topic. Classroom exercises, questions to ask, worksheet activities."
  },
  {
    id: "4",
    title: "CONCLUSION",
    keyPoints: "write and generate a detailed lesson plan for this topic. Summary of key takeaways, assignment for homework."
  }
];

// Define the structure for a saved lesson plan (should match the saved format)
interface SavedLessonPlan {
  id: string;
  topic: string;
  level: string; // Added level
  generatedContent: string;
  // Add other fields if saved, like sections or creation date
}

const Lessons = () => {
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState(""); // Add state for level
  const [sections, setSections] = useState<LessonSection[]>(defaultSections);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState("");
  const [currentPhase, setCurrentPhase] = useState<"welcome" | "scaffolding" | "editing">("welcome");
  const [isExporting, setIsExporting] = useState(false);
  const [savedLessonPlans, setSavedLessonPlans] = useState<SavedLessonPlan[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  // Load saved lesson plans from localStorage on component mount
    useEffect(() => {
    const storedPlans = localStorage.getItem('lessonPlans');
    if (storedPlans) {
      try {
        const parsedPlans = JSON.parse(storedPlans);
        // Add level property for backward compatibility
        const plansWithLevel = parsedPlans.map((plan: any) => ({
          ...plan,
          level: plan.level || 'N/A', 
        }));
        setSavedLessonPlans(plansWithLevel);
      } catch (error) {
        console.error("Failed to parse lesson plans from localStorage:", error);
        toast.error("Could not load saved lesson plans.");
      }
    }
  }, []);

  const handleStart = () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic to teach");
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
      title: "NEW SECTION",
      keyPoints: "Enter key points for this section..."
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

  const handleGenerateLessonPlan = async () => {
    setIsGenerating(true);
    try {
      const plan = await generateLessonPlan(topic, sections);
      setGeneratedPlan(plan);
      setCurrentPhase("editing");
      toast.success("Lesson plan generated successfully!");
    } catch (error) {
      toast.error("Failed to generate lesson plan. Please try again.");
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

  // Function to delete a lesson plan
  const deleteLessonPlan = (id: string) => {
    const updatedPlans = savedLessonPlans.filter(plan => plan.id !== id);
    setSavedLessonPlans(updatedPlans);
    localStorage.setItem('lessonPlans', JSON.stringify(updatedPlans));
    toast.success("Lesson plan deleted.");
    // If the deleted plan was the one being viewed, close the view
    if (selectedLessonId === id) {
      setSelectedLessonId(null);
    }
  };

  // Handle exporting as PDF
  const handleExportPDF = async (lessonPlan: SavedLessonPlan) => {
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
  const handleExportPowerPoint = async (lessonPlan: SavedLessonPlan) => {
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
  const selectedLesson = savedLessonPlans.find(plan => plan.id === selectedLessonId);

  if (currentPhase === "welcome") {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6"
        >
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-mama-purple">Welcome to Mama Math</h1>
            <p className="text-lg text-muted-foreground">
              I'm Mama Math, your lesson plan generator assistant. Tell me what you want to teach and I'll help you create your lesson.
            </p>
          </div>
          <div className="flex gap-4">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Adition and Subtraction"
              className="w-full"
            />
            <Input
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="e.g., primary 5, primary 6"
              className="w-full mt-4"
            />
            <Button onClick={handleStart}>Start</Button>
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
            <h2 className="text-xl font-semibold mb-4">Lesson Plan Structure</h2>
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
                    placeholder="Enter key points..."
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
                Add Section
              </Button>
            </div>
            <Button
              className="w-full mt-6"
              onClick={handleGenerateLessonPlan}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Lesson Plan Now"
              )}
            </Button>
          </Card>
        </div>

        {/* Right Column - Topic Display */}
        <div className="w-80">
          <Card className="p-6">
            <h3 className="font-semibold mb-2">Your Topic</h3>
            <div className="bg-mama-purple/10 p-4 rounded-lg">
              <p className="text-mama-purple">{topic}</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Editing Phase
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-mama-dark mb-4">Saved Lesson Plans</h1>

      {savedLessonPlans.length === 0 ? (
        <div className="text-center text-muted-foreground">
          No lesson plans saved yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedLessonPlans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`cursor-pointer hover:shadow-lg transition-shadow ${
                selectedLessonId === plan.id ? 'border-mama-purple border-2' : ''
              }`}
              onClick={() => setSelectedLessonId(plan.id)}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">{plan.topic}</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent card click when deleting
                    deleteLessonPlan(plan.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardHeader>
              <CardContent>
                {/* Display a snippet or metadata if available */}
                <CardDescription>Saved lesson plan on {plan.topic}</CardDescription> {/* Placeholder description */}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedLesson && (
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-2xl font-bold">{selectedLesson.topic}</CardTitle>
            <div className="flex gap-2">
               <Button onClick={() => handleExportPDF(selectedLesson)} variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" /> Download PDF
              </Button>
              <Button onClick={() => handleExportPowerPoint(selectedLesson)} variant="outline" size="sm">
                <FileType className="h-4 w-4 mr-2" /> Download PowerPoint
              </Button>
            </div>
          </CardHeader>
          <CardContent>
             <div className="prose prose-sm max-w-none">
               <ReactMarkdown>{selectedLesson.generatedContent}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Lessons; 