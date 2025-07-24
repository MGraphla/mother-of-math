import React, { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trash2, FileText, FileType, Loader2, BookOpen, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import { exportToPDF, exportToPowerPoint, formatAIResponseAsMarkdown } from '@/services/lessonPlan';
import { useNavigate } from 'react-router-dom';

interface SavedLessonPlan {
  id: string;
  title: string;
  level: string;
  content: any;
  createdAt: any;
  userId: string;
}

const ViewLessonPlans = () => {
  const [lessonPlans, setLessonPlans] = useState<SavedLessonPlan[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch lesson plans from Firebase
  useEffect(() => {
    const fetchLessonPlans = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const lessonPlansRef = collection(db, `users/${user.uid}/lesson_plans`);
        const q = query(lessonPlansRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const plans: SavedLessonPlan[] = [];
        querySnapshot.forEach((doc) => {
          plans.push({
            id: doc.id,
            ...doc.data()
          } as SavedLessonPlan);
        });
        
                setLessonPlans(plans);
        if (plans.length > 0) {
          setSelectedLessonId(plans[0].id);
        }
      } catch (error) {
        console.error("Error fetching lesson plans:", error);
        toast({
          title: "Error",
          description: "Failed to load lesson plans. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchLessonPlans();
  }, [user, toast]);

  // Delete a lesson plan
  const deleteLessonPlan = async (planId: string) => {
    if (!user) return;

    try {
      await deleteDoc(doc(db, `users/${user.uid}/lesson_plans`, planId));
      setLessonPlans(lessonPlans.filter(plan => plan.id !== planId));
      if (selectedLessonId === planId) {
        setSelectedLessonId(null);
      }
      toast({
        title: "Success",
        description: "Lesson plan deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting lesson plan:", error);
      toast({
        title: "Error",
        description: "Failed to delete lesson plan. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Export lesson plan as PDF
  const handleExportPDF = async (lessonPlan: SavedLessonPlan) => {
    setIsExporting(true);
    try {
      const jsonString = JSON.stringify(lessonPlan.content);
            await exportToPDF(jsonString, lessonPlan.title, lessonPlan.level);
      toast({
        title: "Success",
        description: "PDF exported successfully!",
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Error",
        description: "Failed to export PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Export lesson plan as PowerPoint
  const handleExportPowerPoint = async (lessonPlan: SavedLessonPlan) => {
    setIsExporting(true);
    try {
      const jsonString = JSON.stringify(lessonPlan.content);
            await exportToPowerPoint(jsonString, lessonPlan.title, lessonPlan.level);
      toast({
        title: "Success",
        description: "PowerPoint exported successfully!",
      });
    } catch (error) {
      console.error("Error exporting PowerPoint:", error);
      toast({
        title: "Error",
        description: "Failed to export PowerPoint. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

    const selectedLesson = lessonPlans.find(plan => plan.id === selectedLessonId);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your lesson plans...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
        <p className="text-muted-foreground">Please log in to view your lesson plans.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard/lessons')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Lessons
          </Button>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-800">Your Lesson Plans</h1>
            <p className="text-muted-foreground">
              {lessonPlans.length} lesson plan{lessonPlans.length !== 1 ? 's' : ''} saved
            </p>
          </div>
        </div>
      </div>

      {lessonPlans.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No lesson plans yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first lesson plan to get started!
          </p>
          <Button onClick={() => navigate('/dashboard/generator')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Generator
          </Button>
          Create Lesson Plan
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 relative">
          {/* Lesson Plans List */}
                    <div className={`xl:col-span-1 ${selectedLessonId ? 'hidden xl:block' : 'block'} space-y-4`}>
            <h2 className="text-xl font-semibold mb-4 text-gray-700">All Lesson Plans ({lessonPlans.length})</h2>
            <div className="space-y-4">
              {lessonPlans.map((plan) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card 
                    key={plan.id}
                    onClick={() => setSelectedLessonId(plan.id)}
                    className={`cursor-pointer transition-all duration-300 rounded-xl ${selectedLessonId === plan.id ? 'ring-2 ring-primary shadow-xl scale-105' : 'hover:shadow-lg hover:-translate-y-1 bg-white'}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg font-bold text-gray-800 truncate">
                            {plan.title}
                          </CardTitle>
                          <CardDescription className="text-sm text-gray-500 mt-1">
                            {plan.level} • {plan.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently created'}
                          </CardDescription>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLessonPlan(plan.id);
                          }}
                          className="text-gray-400 hover:text-destructive hover:bg-destructive/10 rounded-full"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Lesson Plan Details */}
                    <div className={`xl:col-span-2 ${selectedLessonId ? 'block' : 'hidden xl:block'}`}>
            {selectedLesson ? (
              <motion.div
                key={selectedLesson.id}
                initial="hidden"
                animate="visible"
                variants={cardVariants}
                transition={{ duration: 0.5 }}
                                className="space-y-6 relative"
              >
                                <Button 
                  onClick={() => setSelectedLessonId(null)} 
                  className="xl:hidden absolute top-4 left-4 bg-white/70 backdrop-blur-sm shadow-lg hover:bg-white"
                  variant="outline"
                  size="icon"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                                <Card className="shadow-lg rounded-2xl border-none">
                                                      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-12 sm:pt-8">
                    <div>
                      <CardTitle className="text-3xl font-extrabold text-gray-900">{selectedLesson.title}</CardTitle>
                      <CardDescription className="text-md text-gray-600">
                        {selectedLesson.level} • Created {selectedLesson.createdAt?.toDate?.()?.toLocaleDateString() || 'recently'}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleExportPDF(selectedLesson)} 
                        size="lg"
                        disabled={isExporting}
                        className="bg-red-500 hover:bg-red-600 text-white"
                      >
                        {isExporting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4 mr-2" />
                        )}
                        PDF
                      </Button>
                                            <Button 
                        onClick={() => handleExportPowerPoint(selectedLesson)} 
                        size="lg"
                        disabled={isExporting}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        {isExporting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileType className="h-4 w-4 mr-2" />
                        )}
                        PowerPoint
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                                        <div className="prose prose-lg max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:text-primary-dark">
                      <ReactMarkdown>
                        {formatAIResponseAsMarkdown(JSON.stringify(selectedLesson.content))}
                      </ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
                            <Card className="h-full flex items-center justify-center bg-gray-100/50 border-2 border-dashed border-gray-300 rounded-2xl">
                <CardContent className="text-center py-12">
                                    <BookOpen className="h-16 w-16 mx-auto mb-6 text-gray-400" />
                                    <p className="text-lg text-gray-500">
                    Select a lesson plan from the list to view its details
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewLessonPlans;
