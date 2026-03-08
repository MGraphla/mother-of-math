import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, isPast, differenceInDays, formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  Loader2, Upload, AlertTriangle, CheckCircle2, Clock, BookCheck, FileText,
  Paperclip, X, Star, Download, Send, Sparkles, Brain, Trophy, Award, TrendingUp, LogOut, MessageSquare, Eye, ArrowRight, Target, RotateCcw
} from "lucide-react";
import {
  Calendar as CalendarIcon, RefreshCw
} from "lucide-react";
import ReactMarkdown from "react-markdown"; // kept for other potential uses

import { parseAiFeedback } from "@/utils/grading";

import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Student,
  StudentAssignment,
  AssignmentSubmission,
  getStudentSession,
  getAssignmentsForStudent,
  getSubmissionsForStudent,
  submitAssignment as submitAssignmentService,
  uploadSubmissionFile,
  refreshStudentSession,
  getStudentStats,
  StudentStats,
  clearStudentSession
} from "@/services/studentService";
import { AssignmentComments } from "@/components/AssignmentComments";
import { gradeSubmissionWithAI, saveAiGrading } from "@/services/aiGrading";

// Auto-refresh interval (60 seconds)
const REFRESH_INTERVAL_MS = 60_000;

const StudentAssignments = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [student, setStudent] = useState<Student | null>(null);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [studentStats, setStudentStats] = useState<StudentStats | null>(null);

  // Submission dialog state
  const [submittingAssignment, setSubmittingAssignment] = useState<StudentAssignment | null>(null);
  const [studentNotes, setStudentNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // View assignment details dialog
  const [viewingAssignment, setViewingAssignment] = useState<StudentAssignment | null>(null);

  // Image preview
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // AI grading state
  const [isAiGrading, setIsAiGrading] = useState(false);

  useEffect(() => {
    const s = getStudentSession();
    if (!s) { navigate("/student-login", { replace: true }); return; }
    setStudent(s);
    loadData(s.id);

    // Auto-refresh session periodically
    const refreshSession = async () => {
      const fresh = await refreshStudentSession();
      if (fresh) setStudent(fresh);
    };
    refreshSession();
  }, []);

  // Auto-refresh assignments periodically
  useEffect(() => {
    if (!student) return;
    const interval = setInterval(() => {
      silentRefresh(student.id);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [student]);

  const loadData = useCallback(async (studentId: string) => {
    setIsLoading(true);
    try {
      const [a, sub, stats] = await Promise.all([
        getAssignmentsForStudent(studentId),
        getSubmissionsForStudent(studentId),
        getStudentStats(studentId),
      ]);
      setAssignments(a);
      setSubmissions(sub);
      setStudentStats(stats);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Error loading assignments:", e);
      toast({ title: "Error", description: "Failed to load assignments.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Silent refresh (no loading spinner, just updates data)
  const silentRefresh = useCallback(async (studentId: string) => {
    try {
      const [a, sub, stats] = await Promise.all([
        getAssignmentsForStudent(studentId),
        getSubmissionsForStudent(studentId),
        getStudentStats(studentId),
      ]);
      // Check for new assignments
      const previousIds = new Set(assignments.map(x => x.id));
      const newOnes = a.filter(x => !previousIds.has(x.id));
      if (newOnes.length > 0) {
        toast({ 
          title: "📚 New Assignment!", 
          description: `You have ${newOnes.length} new assignment${newOnes.length > 1 ? 's' : ''} to complete.` 
        });
      }
      // Check for newly graded submissions
      const prevSubmissions = new Set(submissions.filter(s => s.status === 'graded').map(s => s.id));
      const newlyGraded = sub.filter(s => s.status === 'graded' && !prevSubmissions.has(s.id));
      if (newlyGraded.length > 0) {
        toast({ 
          title: "⭐ Assignment Graded!", 
          description: `Your teacher graded ${newlyGraded.length} submission${newlyGraded.length > 1 ? 's' : ''}.`
        });
      }
      setAssignments(a);
      setSubmissions(sub);
      setStudentStats(stats);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Silent refresh error:", e);
    }
  }, [assignments, submissions]);

  // Manual refresh
  const handleRefresh = async () => {
    if (!student || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadData(student.id);
      toast({ title: "Refreshed!", description: "Your assignments are up to date." });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSignOut = () => {
      clearStudentSession();
      navigate("/student-login", { replace: true });
    };

  const handleFileSelected = (file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 10 MB.", variant: "destructive" });
      return;
    }
    setSelectedFile(file);
    // Generate image preview if it's an image
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!submittingAssignment || !student) return;

    setIsSubmitting(true);
    const assignmentSnapshot = submittingAssignment;
    try {
      // Upload file first if selected
      let fileUrl: string | undefined;
      if (selectedFile) {
        try {
          fileUrl = await uploadSubmissionFile(selectedFile, student.id, assignmentSnapshot.id);
        } catch (uploadErr: any) {
          console.warn("File upload failed, submitting without file:", uploadErr);
          toast({ title: "File upload issue", description: "File couldn't be uploaded. Submitting without attachment.", variant: "default" });
        }
      }

      const newSub = await submitAssignmentService({
        assignment_id: assignmentSnapshot.id,
        student_id: student.id,
        notes: studentNotes || undefined,
        file_url: fileUrl,
      });

      setSubmissions((prev) => [newSub, ...prev]);
      setSubmittingAssignment(null);
      setStudentNotes("");
      setSelectedFile(null);
      setImagePreview(null);
      setIsSubmitting(false);
      toast({ title: "Submitted! ✅", description: "Your assignment has been submitted. AI is now reviewing your work..." });

      // Auto-trigger AI grading in background if a file was uploaded
      if (fileUrl && newSub.id) {
        setIsAiGrading(true);
        try {
          const aiResult = await gradeSubmissionWithAI(
            { ...newSub, file_url: fileUrl },
            assignmentSnapshot,
            student.full_name
          );
          if (aiResult.success) {
            await saveAiGrading(newSub.id, aiResult.score, aiResult.feedback);
            // Refresh submissions to show AI feedback
            const updated = await getSubmissionsForStudent(student.id);
            setSubmissions(updated);
            toast({ title: "🤖 AI Review Complete", description: `Your work has been reviewed. Score: ${aiResult.score}` });
          }
        } catch (aiErr) {
          console.warn("AI grading failed (non-fatal):", aiErr);
        } finally {
          setIsAiGrading(false);
        }
      }
      return;
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to submit.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSubmission = (assignmentId: string) =>
    submissions.find((s) => s.assignment_id === assignmentId);

  const openViewDialog = (assignment: StudentAssignment) => {
    setViewingAssignment(assignment);
  };

  const startSubmitFromView = (assignment: StudentAssignment) => {
    setViewingAssignment(null);
    setSubmittingAssignment(assignment);
    setStudentNotes("");
    setSelectedFile(null);
    setImagePreview(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground font-medium">Loading assignments...</span>
      </div>
    );
  }

  if (!student) return null;

  const submittedIds = new Set(submissions.map((s) => s.assignment_id));
  const filteredAssignments = assignments.filter((a) => {
    const isSubmitted = submittedIds.has(a.id);
    const isPastDue = new Date(a.due_date) < new Date();
    if (activeTab === "pending") return !isSubmitted && !isPastDue;
    if (activeTab === "submitted") return isSubmitted;
    if (activeTab === "graded") return isSubmitted && submissions.some((s) => s.assignment_id === a.id && (s.status === "graded" || s.status === "returned"));
    if (activeTab === "late") return !isSubmitted && isPastDue;
    return true;
  });

  const pendingCount = assignments.filter((a) => !submittedIds.has(a.id) && new Date(a.due_date) > new Date()).length;
  const submittedCount = submissions.length;
  const gradedCount = submissions.filter((s) => s.status === "graded" || s.status === "returned").length;
  const lateCount = assignments.filter((a) => !submittedIds.has(a.id) && new Date(a.due_date) < new Date()).length;

  // Calculate average score
  const gradedSubmissions = submissions.filter(s => 
   (s.status === 'graded' || s.status === 'returned') && s.score !== null && s.score !== undefined
 );
 const averageScore = gradedSubmissions.length > 0
   ? Math.round(gradedSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / gradedSubmissions.length)
   : null;

  return (
    <div className="container py-8 space-y-8 max-w-7xl animate-in fade-in duration-500 pb-20">
      
      {/* ── Enhanced Header ── */}
      <div className="relative overflow-hidden rounded-xl bg-primary p-6 text-white shadow-lg">
        {/* Decorative shapes */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-10 -translate-x-10" />
        
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-white/70 text-sm mb-1">
                {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"},
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                {student?.full_name || "Student"}
                {studentStats && studentStats.averageScore !== null && studentStats.averageScore >= 90 && (
                  <span className="text-base">⭐</span>
                )}
              </h1>
              <p className="text-white/70 text-sm mt-1 flex items-center gap-2 flex-wrap">
                {student?.grade_level && (
                   <span className="flex items-center gap-1">
                      {/* Using Star instead of GraduationCap temporarily as default icon */}
                      <Star className="h-3.5 w-3.5" /> {student?.grade_level}
                   </span>
                )}
                {student?.class_name && (
                  <>
                    <span>·</span>
                    <span>{student.class_name}</span>
                  </>
                )}
                {student?.student_code && (
                  <>
                    <span>·</span>
                    <code className="text-xs bg-white/20 px-1.5 py-0.5 rounded">{student.student_code}</code>
                  </>
                )}
              </p>
              {/* Motivational subtitle */}
              <p className="text-white/50 text-xs mt-2 italic">
                {pendingCount === 0 
                  ? "All caught up! Great job keeping up with your work! 🎉" 
                  : pendingCount === 1 
                    ? "Just 1 assignment to go — you've got this! 💪"
                    : `${pendingCount} assignments waiting — let's make progress! 📚`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="secondary" 
                size="sm" 
                className="bg-white/15 hover:bg-white/25 text-white border-white/20"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-4 w-4 mr-1.5", isRefreshing && "animate-spin")} />
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white/80 hover:text-white hover:bg-white/10"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2.5 border border-white/10 group hover:bg-white/20 transition-colors cursor-default">
              <div className="flex items-center justify-between">
                <Clock className="h-4 w-4 text-primary-foreground opacity-70" />
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
              <p className="text-[10px] text-white/70 uppercase tracking-wider mt-1">Pending</p>
              {pendingCount > 0 && (
                <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-foreground/70 rounded-full animate-pulse" style={{ width: '100%' }} />
                </div>
              )}
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2.5 border border-white/10 group hover:bg-white/20 transition-colors cursor-default">
              <div className="flex items-center justify-between">
                <Upload className="h-4 w-4 text-primary-foreground opacity-70" />
                <p className="text-2xl font-bold">{submittedCount}</p>
              </div>
              <p className="text-[10px] text-white/70 uppercase tracking-wider mt-1">Submitted</p>
              {assignments.length > 0 && (
                <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-foreground/80 rounded-full transition-all duration-500" style={{ width: `${(submittedCount / assignments.length) * 100}%` }} />
                </div>
              )}
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2.5 border border-white/10 group hover:bg-white/20 transition-colors cursor-default">
              <div className="flex items-center justify-between">
                <Star className="h-4 w-4 text-primary-foreground opacity-70" />
                <p className="text-2xl font-bold">{gradedCount}</p>
              </div>
              <p className="text-[10px] text-white/70 uppercase tracking-wider mt-1">Graded</p>
              {submittedCount > 0 && (
                <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-foreground rounded-full transition-all duration-500" style={{ width: `${(gradedCount / submittedCount) * 100}%` }} />
                </div>
              )}
            </div>
            <div className={cn(
              "backdrop-blur-sm rounded-lg px-3 py-2.5 border group hover:bg-white/20 transition-colors cursor-default",
              averageScore !== null && averageScore >= 60 
                ? "bg-white/15 border-white/20" 
                : "bg-destructive/20 border-destructive/30"
            )}>
              <div className="flex items-center justify-between">
                <TrendingUp className={cn(
                  "h-4 w-4 opacity-70",
                  averageScore !== null && averageScore >= 60 ? "text-primary-foreground" : "text-destructive-foreground"
                )} />
                <p className="text-2xl font-bold">
                  {averageScore !== null ? `${averageScore}%` : "—"}
                </p>
              </div>
              <p className="text-[10px] text-white/70 uppercase tracking-wider mt-1">Avg Score</p>
              {averageScore !== null && (
                <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className={cn(
                    "h-full rounded-full transition-all duration-500",
                    averageScore >= 60 ? "bg-primary-foreground" : "bg-destructive-foreground"
                  )} style={{ width: `${averageScore}%` }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Last updated indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground p-1">
        <span>Last updated: {formatDistanceToNow(lastRefresh, { addSuffix: true })}</span>
        {lateCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" /> {lateCount} overdue
          </Badge>
        )}
      </div>

       {/* Detailed Student Performance Card */}
       {studentStats && studentStats.totalAssignments > 0 && (
        <Card className="border shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              {/* Performance metrics */}
              <div className="flex items-center gap-6 flex-wrap">
                {/* Completion Rate Ring */}
                <div className="flex items-center gap-2.5">
                  <div className="relative w-12 h-12">
                    <svg className="w-12 h-12 -rotate-90">
                      <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="none" className="text-muted-foreground/20" />
                      <circle 
                        cx="24" cy="24" r="20" 
                        stroke="currentColor" 
                        strokeWidth="4" 
                        fill="none" 
                        strokeDasharray={`${Math.PI * 40 * (studentStats.completionRate / 100)} ${Math.PI * 40}`}
                        className="text-primary transition-all duration-500"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold">{Math.round(studentStats.completionRate)}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Completion</p>
                    <p className="text-[10px] text-muted-foreground">{studentStats.submittedCount}/{studentStats.totalAssignments}</p>
                  </div>
                </div>

                {/* Average Score */}
                {studentStats.averageScore !== null && (
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm",
                      studentStats.averageScore >= 60 ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground" :
                      "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive-foreground"
                    )}>
                      {Math.round(studentStats.averageScore)}%
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">Avg Score</p>
                      <p className="text-[10px] text-muted-foreground">{gradedCount} graded</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick tip */}
              <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/10">
                <Award className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground">
                  {studentStats.pendingCount > 0 
                    ? `${studentStats.pendingCount} assignment${studentStats.pendingCount !== 1 ? 's' : ''} waiting for you!`
                    : studentStats.averageScore && studentStats.averageScore >= 80
                      ? "Great work! Keep it up! 🌟"
                      : "Keep pushing! You're doing great! 💪"
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Separator */}
      <Separator />

      {/* Main Content */}
      <Tabs defaultValue="pending" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList className="bg-background/50 backdrop-blur-sm border p-1 h-auto hidden md:flex">
             <TabsTrigger value="pending" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs px-3 py-1.5 h-8">
                Pending
             </TabsTrigger>
             <TabsTrigger value="submitted" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs px-3 py-1.5 h-8">
                Submitted
             </TabsTrigger>
             <TabsTrigger value="graded" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs px-3 py-1.5 h-8">
                Graded
             </TabsTrigger>
             <TabsTrigger value="late" className="data-[state=active]:bg-destructive/10 data-[state=active]:text-destructive text-xs px-3 py-1.5 h-8">
                Late
             </TabsTrigger>
             <TabsTrigger value="all" className="data-[state=active]:bg-muted data-[state=active]:text-foreground text-xs px-3 py-1.5 h-8">
                All
             </TabsTrigger>
          </TabsList>

          {/* Mobile Tab Select (if needed) or just the header title for mobile */}
           <div className="md:hidden">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                {activeTab === 'pending' && <Clock className="h-5 w-5 text-primary" />}
                {activeTab === 'submitted' && <Upload className="h-5 w-5 text-primary" />}
                {activeTab === 'graded' && <Star className="h-5 w-5 text-primary" />}
                {activeTab === 'late' && <AlertTriangle className="h-5 w-5 text-destructive" />}
                {activeTab === 'all' && <BookCheck className="h-5 w-5 text-muted-foreground" />}
                <span className="capitalize">{activeTab} Assignments</span>
              </h2>
           </div>
           
           <div className="flex items-center gap-2 md:hidden">
              <Button 
                variant={activeTab === 'all' ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setActiveTab('all')}
                className="text-xs"
              >
                View All
              </Button>
           </div>
        </div>

        {filteredAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl bg-gray-50/50">
             <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <BookCheck className="h-8 w-8 text-gray-400" />
             </div>
             <h3 className="text-lg font-medium text-gray-900">No assignments found</h3>
             <p className="text-muted-foreground max-w-sm mt-1">
               There are no {activeTab} assignments to show right now.
             </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssignments.map((assignment) => {
              const submission = getSubmission(assignment.id);
              const dueDate = new Date(assignment.due_date);
              const isPastDue = isPast(dueDate);
              const daysLeft = differenceInDays(dueDate, new Date());
              return (
                <AssignmentCard 
                   key={assignment.id} 
                   assignment={assignment} 
                   submission={submission}
                   dueDate={dueDate}
                   isPastDue={isPastDue}
                   daysLeft={daysLeft}
                   onView={() => openViewDialog(assignment)}
                   onSubmit={() => startSubmitFromView(assignment)}
                />
              );
            })}
          </div>
        )}
      </Tabs>

      {/* ── View Dialog ── */}
      <Dialog open={!!viewingAssignment} onOpenChange={(o) => { if(!o) setViewingAssignment(null); }}>
         <DialogContent className="sm:max-w-2xl p-0 overflow-hidden gap-0 max-h-[90vh]">
            {viewingAssignment && (
               <AssignmentDetailView 
                  assignment={viewingAssignment}
                  submission={getSubmission(viewingAssignment.id)}
                  onClose={() => setViewingAssignment(null)}
                  onSubmit={() => startSubmitFromView(viewingAssignment)}
                  studentName={student.full_name}
               />
            )}
         </DialogContent>
      </Dialog>

      {/* ── Submit Dialog ── */}
      <Dialog open={!!submittingAssignment} onOpenChange={(o) => { if(!o) setSubmittingAssignment(null); }}>
        <DialogContent className="sm:max-w-xl">
           <DialogHeader>
             <DialogTitle>Submit Assignment</DialogTitle>
             <DialogDescription>
               Upload your work for <span className="font-semibold text-foreground">{submittingAssignment?.title}</span>
             </DialogDescription>
           </DialogHeader>
           
           <div className="space-y-4 py-4">
              <div className="grid gap-2">
                 <Label>Your Work (Optional Image/File)</Label>
                 <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
                      accept="image/*,application/pdf,.doc,.docx"
                    />
                    {imagePreview ? (
                       <div className="relative w-full max-h-60 overflow-hidden rounded-md group">
                          <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); clearFile(); }}>Remove</Button>
                          </div>
                       </div>
                    ) : selectedFile ? (
                       <div className="flex items-center gap-2 p-2 bg-primary/10 text-primary rounded-md">
                          <FileText className="h-5 w-5" />
                          <span className="font-medium text-sm">{selectedFile.name}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 ml-2" onClick={(e) => { e.stopPropagation(); clearFile(); }}>
                             <X className="h-4 w-4" />
                          </Button>
                       </div>
                    ) : (
                       <>
                          <div className="p-3 bg-primary/10 text-primary rounded-full">
                             <Upload className="h-6 w-6" />
                          </div>
                          <div className="text-center text-sm">
                             <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                             <p className="text-xs text-muted-foreground mt-1">Images, PDF, or Docs (Max 10MB)</p>
                          </div>
                       </>
                    )}
                 </div>
              </div>

              <div className="grid gap-2">
                 <Label>Notes for Teacher</Label>
                 <Textarea 
                   placeholder="Add any comments or questions here..." 
                   value={studentNotes}
                   onChange={(e) => setStudentNotes(e.target.value)}
                   className="resize-none h-24"
                 />
              </div>
           </div>

           <DialogFooter>
              <Button variant="outline" onClick={() => setSubmittingAssignment(null)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                 {isSubmitting ? (
                    <>
                       <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                    </>
                 ) : (
                    <>
                       <Send className="h-4 w-4" /> Submit Assignment
                    </>
                 )}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatsTab = ({ isActive, onClick, title, count, icon: Icon, color, bg, borderColor }: any) => (
   <button 
      onClick={onClick}
      className={cn(
         "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200",
         isActive 
            ? cn("bg-white shadow-md scale-[1.02]", borderColor) 
            : "bg-white border-transparent hover:bg-gray-50 border-gray-100"
      )}
   >
      <div className={cn("p-2 rounded-full mb-2", bg, color)}>
         <Icon className="h-5 w-5" />
      </div>
      <div className="text-center">
         <span className="text-2xl font-bold block">{count}</span>
         <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
      </div>
   </button>
);

const AssignmentCard = ({ assignment, submission, dueDate, isPastDue, daysLeft, onView, onSubmit }: any) => {
   const statusColor = !submission 
      ? (isPastDue ? "bg-destructive" : daysLeft <= 1 ? "bg-primary" : "bg-primary/80")
      : submission.status === 'graded' ? "bg-primary" : "bg-primary/60";
   
   return (
      <Card className="group overflow-hidden border-0 shadow-sm ring-1 ring-border hover:ring-2 hover:ring-primary/20 hover:shadow-lg transition-all duration-300 flex flex-col h-full bg-card">
         <div className={cn("h-1.5 w-full", statusColor)} />
         <CardContent className="p-5 flex-1 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
               <div>
                  <Badge variant="outline" className="mb-2 bg-secondary/30 text-secondary-foreground border-border/50">
                     {assignment.subject}
                  </Badge>
                  <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                     {assignment.title}
                  </h3>
               </div>
               {submission ? (
                  <StatusBadge submission={submission} />
               ) : (
                  isPastDue && (
                     <Badge variant="destructive" className="shrink-0">Overdue</Badge>
                  )
               )}
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
               <div className="flex items-center gap-2">
                 <CalendarIcon className="h-4 w-4 opacity-70" />
                 <span>Due {format(dueDate, "MMM d, yyyy")}</span>
               </div>
               {!submission && !isPastDue && (
                 <div className="flex items-center gap-2 text-primary font-medium">
                    <Clock className="h-4 w-4" />
                    <span>{daysLeft === 0 ? "Due today" : `${daysLeft} days left`}</span>
                 </div>
               )}
            </div>
            
            <div className="mt-auto pt-4 flex items-center justify-between border-t border-border">
               {assignment.max_score && (
                  <span className="text-xs font-medium text-muted-foreground">
                     Max Score: {assignment.max_score}
                  </span>
               )}
               <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={onView} className="h-8">Details</Button>
                  {!submission && (
                     <Button size="sm" onClick={onSubmit} className="h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
                        <Upload className="h-3.5 w-3.5" /> Submit
                     </Button>
                  )}
                  {submission && submission.status === 'returned' && (
                     <Button size="sm" onClick={onSubmit} className="h-8 gap-1.5 bg-amber-600 text-white hover:bg-amber-700">
                        <RotateCcw className="h-3.5 w-3.5" /> Resubmit
                     </Button>
                  )}
               </div>
            </div>
         </CardContent>
      </Card>
   );
};

const StatusBadge = ({ submission }: { submission: AssignmentSubmission }) => {
   if (submission.status === 'graded') {
      const score = submission.score;
      // Monochromatic scoring: Primary for high, Muted/Secondary for low, Destructive for fail?
      // User said "Only use app color". Let's stick to Primary vs Secondary vs Destructive for semantic meaning
      const variant = (score || 0) >= 60 ? "default" : "destructive";
      return (
         <Badge variant={variant === "default" ? "secondary" : "destructive"} className="hover:bg-opacity-80 border-0">
            <Star className="w-3 h-3 mr-1" /> {score}%
         </Badge>
      );
   }
   if (submission.status === 'returned') {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200"><RotateCcw className="w-3 h-3 mr-1" /> Returned for Revision</Badge>;
   }
   if (submission.ai_graded_at) {
      return <Badge variant="secondary" className="bg-primary/10 text-primary border border-primary/20"><Sparkles className="w-3 h-3 mr-1" /> AI Reviewed</Badge>;
   }
   return <Badge variant="outline" className="bg-muted text-muted-foreground"><CheckCircle2 className="w-3 h-3 mr-1" /> Submitted</Badge>;
};

const AssignmentDetailView = ({ assignment, submission, onClose, onSubmit, studentName }: any) => {
   const isAiGraded = submission && submission.ai_graded_at;
   const hasGrade = submission && (submission.status === 'graded' || submission.status === 'returned');
   const isPastDueDate = isPast(new Date(assignment.due_date));
   const daysLeft = Math.max(0, differenceInDays(new Date(assignment.due_date), new Date()));
   
   return (
      <div className="flex flex-col h-full max-h-[85vh]">
         {/* Dialog Header */}
         <div className={cn(
             "px-6 pt-6 pb-5 shrink-0 relative overflow-hidden",
             hasGrade
               ? (submission.score !== null && submission.score >= 60 ? "bg-primary" : "bg-destructive")
               : submission ? "bg-primary/90"
               : isPastDueDate ? "bg-destructive" : "bg-primary"
         )}>
             {/* Decorative shapes */}
             <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
             <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-10 -translate-x-10" />

             <div className="relative z-10">
               <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 text-white">
                     <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 mb-3 backdrop-blur-md">
                        {assignment.subject}
                     </Badge>
                     <DialogTitle className="text-2xl font-bold text-white leading-tight">
                        {assignment.title}
                     </DialogTitle>
                     <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-white/90 text-sm">
                        <span className="flex items-center gap-1.5">
                           <CalendarIcon className="w-4 h-4 opacity-80" />
                           Due: {format(new Date(assignment.due_date), "PPP")}
                        </span>
                        {assignment.max_score && (
                           <span className="flex items-center gap-1.5">
                              <Target className="w-4 h-4 opacity-80" />
                              Max Score: {assignment.max_score}
                           </span>
                        )}
                     </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
                     <X className="h-5 w-5" />
                  </Button>
               </div>
             </div>
         </div>

         {/* Scrollable Content */}
         <ScrollArea className="flex-1 bg-white">
            <div className="p-6 space-y-6">
               <div className="prose prose-sm max-w-none text-muted-foreground">
                  <h3 className="text-foreground font-semibold mb-2 flex items-center gap-2">
                     <BookCheck className="h-4 w-4 text-primary" /> Instructions
                  </h3>
                  <div className="text-foreground leading-relaxed bg-muted/30 p-4 rounded-lg border text-sm">
                    {assignment.description || "No specific instructions provided."}
                  </div>
               </div>

               {assignment.attachment_url && (
                  <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/20 rounded text-primary">
                           <Paperclip className="h-5 w-5" />
                        </div>
                        <div>
                           <p className="text-sm font-medium text-foreground">Attached Resource</p>
                           <p className="text-xs text-muted-foreground">Teacher provided material</p>
                        </div>
                     </div>
                     <Button variant="outline" size="sm" className="bg-background hover:bg-muted text-primary border-primary/20" asChild>
                        <a href={assignment.attachment_url} target="_blank" rel="noopener noreferrer">
                           <Download className="h-4 w-4 mr-2" /> Download
                        </a>
                     </Button>
                  </div>
               )}

               <Separator />

               {/* Submission Status Section inside Dialog */}
              <div className="space-y-3">
                 <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Upload className="h-4 w-4" /> Your Work
                 </h3>
                 
                 {!submission ? (
                    <div className="bg-gray-50 border-2 border-dashed rounded-xl p-8 text-center space-y-3">
                       <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto text-gray-400">
                          <Upload className="h-6 w-6" />
                       </div>
                       <p className="text-muted-foreground text-sm">You haven't submitted this assignment yet.</p>
                       <Button onClick={() => onSubmit()} className="gap-2">
                          Start Submission <ArrowRight className="h-4 w-4" />
                       </Button>
                    </div>
                 ) : (
                    <>
                       {/* Submission Details */}
                       <Card className="border shadow-none bg-card">
                          <CardContent className="p-4 flex items-center gap-3">
                             <div className="h-10 w-10 bg-primary/20 text-primary rounded-full flex items-center justify-center shrink-0">
                                <CheckCircle2 className="h-5 w-5" />
                             </div>
                             <div className="flex-1">
                                <p className="font-medium text-foreground">Submitted</p>
                                <p className="text-xs text-muted-foreground">{format(new Date(submission.submitted_at), "PPP 'at' p")}</p>
                             </div>
                             {submission.file_url && (
                                <Button variant="outline" size="sm" asChild>
                                   <a href={submission.file_url} target="_blank" rel="noopener noreferrer" className="gap-2 text-primary hover:text-primary">
                                      <FileText className="h-3.5 w-3.5" /> View File
                                   </a>
                                </Button>
                             )}
                          </CardContent>
                          {submission.notes && (
                             <CardFooter className="bg-muted/30 px-4 py-3 text-sm italic text-muted-foreground border-t">
                                "{submission.notes}"
                             </CardFooter>
                          )}
                       </Card>

                       {/* 🤖 AI Grading Feedback */}
                       {(submission.ai_graded_at && submission.ai_feedback) && (() => {
                          const sections = parseAiFeedback(submission.ai_feedback!);
                          const maxScore = assignment.max_score || 100;
                          const pct = submission.ai_score !== null && submission.ai_score !== undefined
                            ? Math.round((submission.ai_score / maxScore) * 100) : null;
                          const pctColor = pct === null ? 'text-primary' : pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-500' : 'text-red-500';
                          const barColor = pct === null ? 'bg-primary' : pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
                          return (
                            <div className="border border-primary/20 bg-primary/5 rounded-xl overflow-hidden">
                              {/* Header */}
                              <div className="bg-primary/10 px-4 py-2.5 border-b border-primary/10 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                                  <Sparkles className="h-4 w-4" /> AI Preliminary Review
                                </div>
                                {pct !== null && (
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-20 bg-primary/20 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className={`text-sm font-extrabold ${pctColor}`}>{pct}%</span>
                                  </div>
                                )}
                              </div>
                              {/* Sections */}
                              <div className="p-3 grid grid-cols-2 gap-2">
                                {sections.analysis && (
                                  <div className="col-span-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 p-3">
                                    <p className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">📋 Analysis</p>
                                    <p className="text-sm text-foreground/85 leading-relaxed">{sections.analysis}</p>
                                  </div>
                                )}
                                {sections.error_type && (
                                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 p-3">
                                    <p className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">⚠️ Error Type</p>
                                    <p className="text-sm text-foreground/85 leading-relaxed">{sections.error_type}</p>
                                  </div>
                                )}
                                {sections.remediation && (
                                  <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900 p-3">
                                    <p className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">🛠️ What to practise</p>
                                    <p className="text-sm text-foreground/85 leading-relaxed">{sections.remediation}</p>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground px-4 pb-3">* AI preliminary review. Final grade by your teacher.</p>
                            </div>
                          );
                       })()}

                       {/* Discussion Thread */}
                       <div id="discussion-thread" className="pt-4">
                          <h4 className="font-medium text-sm items-center flex gap-2 mb-3 text-foreground">
                             <MessageSquare className="h-4 w-4 text-primary" /> Discussion
                          </h4>
                          <div className="border rounded-xl bg-gray-50/50 p-1">
                             <AssignmentComments 
                                assignmentId={assignment.id} 
                                isStudent={true} 
                                studentId={submission.student_id} 
                                studentName={studentName} 
                             />
                          </div>
                       </div>
                    </>
                 )}
              </div>
            </div>
         </ScrollArea>
         
         {!submission && (
             <div className="p-4 border-t bg-gray-50 flex justify-end">
               <Button variant="outline" onClick={onClose} className="mr-2">Close</Button>
               <Button onClick={onSubmit}>
                  <Upload className="h-4 w-4 mr-2" /> Submit Assignment
               </Button>
             </div>
         )}
         {submission && submission.status === 'returned' && (
            <div className="p-4 border-t bg-amber-50 flex items-center justify-between">
              <p className="text-sm text-amber-700 font-medium flex items-center gap-2">
                <RotateCcw className="h-4 w-4" /> Your teacher has returned this assignment for revision.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Close</Button>
                <Button onClick={onSubmit} className="bg-amber-600 hover:bg-amber-700 text-white">
                  <RotateCcw className="h-4 w-4 mr-2" /> Resubmit
                </Button>
              </div>
            </div>
         )}
         {submission && submission.status !== 'returned' && (
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <Button onClick={onClose}>Close</Button>
            </div>
         )}
      </div>
   );
};

export default StudentAssignments;
