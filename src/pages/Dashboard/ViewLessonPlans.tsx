import React, { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trash2, FileText, FileType, Loader2, BookOpen, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import { exportToPDF, exportToPowerPoint, formatAIResponseAsMarkdown } from '@/services/lessonPlan';
import { useNavigate } from 'react-router-dom';
import ExportProgressModal from '@/components/ExportProgressModal';

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
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingPPTX, setIsExportingPPTX] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'pptx'>('pdf');
  const [exportProgress, setExportProgress] = useState('');
  const [exportComplete, setExportComplete] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch lesson plans from Supabase
  useEffect(() => {
    const fetchLessonPlans = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('lesson_plans')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const plans: SavedLessonPlan[] = (data || []).map((row: any) => ({
          id: row.id,
          title: row.title,
          level: row.level,
          content: row.content,
          createdAt: row.created_at,
          userId: row.user_id,
        }));
        
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

    // Real-time subscription for lesson plans
    if (user) {
      const channel = supabase
        .channel('lesson_plans_changes')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'lesson_plans', filter: `user_id=eq.${user.id}` },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const row = payload.new as any;
              const newPlan: SavedLessonPlan = {
                id: row.id,
                title: row.title,
                level: row.level,
                content: row.content,
                createdAt: row.created_at,
                userId: row.user_id,
              };
              setLessonPlans(prev => [newPlan, ...prev]);
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              if (deletedId) {
                setLessonPlans(prev => prev.filter(p => p.id !== deletedId));
              }
            } else if (payload.eventType === 'UPDATE') {
              const row = payload.new as any;
              setLessonPlans(prev => prev.map(p => p.id === row.id ? {
                id: row.id,
                title: row.title,
                level: row.level,
                content: row.content,
                createdAt: row.created_at,
                userId: row.user_id,
              } : p));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, toast]);

  // Delete a lesson plan
  const deleteLessonPlan = async (planId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('lesson_plans')
        .delete()
        .eq('id', planId)
        .eq('user_id', user.id);

      if (error) throw error;

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
    setIsExportingPDF(true);
    setExportType('pdf');
    setExportProgress('Preparing your lesson plan...');
    setExportComplete(false);
    setExportModalOpen(true);
    try {
      const jsonString = JSON.stringify(lessonPlan.content);
      await exportToPDF(jsonString, lessonPlan.title, lessonPlan.level, (msg) => {
        setExportProgress(msg);
      });
      setExportComplete(true);
      setExportProgress('Your lesson plan PDF has been downloaded!');
    } catch (error) {
      console.error("Error exporting PDF:", error);
      setExportModalOpen(false);
      toast({
        title: "Error",
        description: "Failed to export PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Export lesson plan as PowerPoint
  const handleExportPowerPoint = async (lessonPlan: SavedLessonPlan) => {
    setIsExportingPPTX(true);
    setExportType('pptx');
    setExportProgress('Preparing your presentation...');
    setExportComplete(false);
    setExportModalOpen(true);
    try {
      const jsonString = JSON.stringify(lessonPlan.content);
      await exportToPowerPoint(jsonString, lessonPlan.title, lessonPlan.level, (msg) => {
        setExportProgress(msg);
      });
      setExportComplete(true);
      setExportProgress('Your PowerPoint presentation has been downloaded!');
    } catch (error) {
      console.error("Error exporting PowerPoint:", error);
      setExportModalOpen(false);
      toast({
        title: "Error",
        description: "Failed to export PowerPoint. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExportingPPTX(false);
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
          className="text-center py-12 px-4"
        >
          <div className="bg-white p-6 rounded-full inline-block shadow-sm mb-6">
            <BookOpen className="h-12 w-12 text-primary/40" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">No lesson plans found</h3>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            You haven't created any lesson plans yet. Use the generator to create your first comprehensive math lesson plan.
          </p>
          <Button onClick={() => navigate('/dashboard/lessons')} size="lg" className="shadow-md hover:shadow-lg transition-all rounded-full px-8">
            Create New Lesson Plan
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 relative h-[calc(100vh-140px)]">
          {/* Lesson Plans List - Hidden on mobile if viewing details */}
          <div className={`xl:col-span-1 h-full overflow-hidden flex flex-col ${selectedLessonId ? 'hidden xl:flex' : 'flex'}`}>
            <h2 className="text-lg font-semibold mb-4 text-gray-700 flex items-center justify-between px-1">
              <span>All Plans</span>
              <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">{lessonPlans.length}</span>
            </h2>
            <div className="space-y-3 overflow-y-auto pr-2 pb-20 custom-scrollbar flex-1">
              {lessonPlans.map((plan) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card 
                    key={plan.id}
                    onClick={() => setSelectedLessonId(plan.id)}
                    className={`cursor-pointer transition-all duration-300 border-l-4 ${selectedLessonId === plan.id ? 'border-l-primary ring-1 ring-primary/20 shadow-md bg-white' : 'border-l-transparent hover:border-l-primary/30 hover:shadow-sm bg-white/80'}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className={`font-semibold text-base truncate mb-1 ${selectedLessonId === plan.id ? 'text-primary' : 'text-gray-800'}`}>
                            {plan.title.replace(/^"/, '').replace(/"$/, '')}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-medium">{plan.level}</span>
                            <span>•</span>
                            <span>{plan.createdAt ? new Date(plan.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Just now'}</span>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLessonPlan(plan.id);
                          }}
                          className="text-gray-400 hover:text-destructive hover:bg-destructive/10 -mt-1 -mr-2 h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Lesson Plan Details - Full screen on mobile */}
          <div className={`xl:col-span-2 h-full overflow-hidden flex flex-col bg-white rounded-xl border shadow-sm ${selectedLessonId ? 'fixed inset-0 z-50 xl:static xl:z-auto' : 'hidden xl:flex'}`}>
            {selectedLesson ? (
              <div className="flex flex-col h-full">
                {/* Mobile Header with Back Button */}
                <div className="p-4 border-b flex items-center justify-between bg-white/95 backdrop-blur z-10 sticky top-0">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Button 
                      onClick={() => setSelectedLessonId(null)} 
                      className="xl:hidden shrink-0 h-9 w-9 rounded-full"
                      variant="ghost"
                      size="icon"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold truncate pr-2">{selectedLesson.title.replace(/^"/, '').replace(/"$/, '')}</h2>
                      <p className="text-xs text-muted-foreground truncate xl:hidden">
                        {selectedLesson.level}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button 
                      onClick={() => handleExportPDF(selectedLesson)} 
                      size="sm"
                      disabled={isExportingPDF}
                      className="h-9 w-9 p-0 sm:w-auto sm:px-3 bg-red-50 text-red-600 hover:bg-red-100 border-red-100"
                      variant="outline"
                      title="Export PDF"
                    >
                      {isExportingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 sm:mr-2" />}
                      <span className="hidden sm:inline">PDF</span>
                    </Button>
                    <Button 
                      onClick={() => handleExportPowerPoint(selectedLesson)} 
                      size="sm"
                      disabled={isExportingPPTX}
                      className="h-9 w-9 p-0 sm:w-auto sm:px-3 bg-orange-50 text-orange-600 hover:bg-orange-100 border-orange-100"
                      variant="outline"
                      title="Export PPT"
                    >
                      {isExportingPPTX ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileType className="h-4 w-4 sm:mr-2" />}
                      <span className="hidden sm:inline">PPT</span>
                    </Button>
                  </div>
                </div>

                {/* Content Scroll Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar bg-gray-50/50">
                  <div className="max-w-3xl mx-auto bg-white p-6 sm:p-10 rounded-xl shadow-sm border min-h-[500px]">
                    <div className="mb-6 pb-6 border-b text-center sm:text-left">
                       <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-3">
                         {selectedLesson.level}
                       </span>
                       <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">
                         {selectedLesson.title.replace(/^"/, '').replace(/"$/, '')}
                       </h1>
                       <p className="text-gray-500 text-sm">
                         Generated on {new Date(selectedLesson.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                       </p>
                    </div>
                    
                    <div className="prose prose-sm sm:prose-base max-w-none prose-headings:font-bold prose-headings:text-gray-800 prose-p:text-gray-600 prose-li:text-gray-600 prose-strong:text-gray-900 prose-a:text-primary hover:prose-a:underline">
                      <ReactMarkdown>
                        {formatAIResponseAsMarkdown(JSON.stringify(selectedLesson.content))}
                      </ReactMarkdown>
                    </div>
                  </div>
                  <div className="h-20" /> {/* Bottom spacer for mobile fab/nav */}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-gray-50/50 text-center p-6">
                <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                  <BookOpen className="h-10 w-10 text-gray-300" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">Select a Lesson Plan</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  Choose a lesson plan from the list to view details, edit, or export.
                </p>
                <Button 
                   onClick={() => navigate('/dashboard/lessons')} 
                   variant="outline" 
                   className="mt-6 sm:hidden"
                >
                  Create New Plan
                </Button>
              </div>
            )}
          </div>
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

export default ViewLessonPlans;
