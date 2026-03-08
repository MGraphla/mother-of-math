import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { isTeacher } from "@/types";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";
import {
  FileText, Loader2, ArrowLeft, CheckCircle2, Clock, Users,
  GraduationCap, Send, AlertTriangle, Eye, Download, MessageSquare,
  BarChart3, Star
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Student, StudentAssignment, AssignmentSubmission,
  getAssignmentById, getAssignmentStudents, getSubmissionsForAssignment,
  getStudentsByTeacher, gradeSubmission, returnSubmission,
} from "@/services/studentService";

// ── Types ──────────────────────────────────────────────

interface SubmissionWithStudent extends AssignmentSubmission {
  student: Student | null;
}

// ── Component ──────────────────────────────────────────

const FeedbackView = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // Data state
  const [assignment, setAssignment] = useState<StudentAssignment | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionWithStudent[]>([]);
  const [assignedStudentIds, setAssignedStudentIds] = useState<string[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState("all");
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithStudent | null>(null);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // ── Load Data ──────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!assignmentId || !user?.id) return;
    setLoading(true);
    try {
      const [assignmentData, rawSubmissions, studentIds, students] = await Promise.all([
        getAssignmentById(assignmentId),
        getSubmissionsForAssignment(assignmentId),
        getAssignmentStudents(assignmentId),
        getStudentsByTeacher(user.id),
      ]);

      setAssignment(assignmentData);
      setAssignedStudentIds(studentIds);
      setAllStudents(students);

      // Enrich submissions with student data
      const enriched: SubmissionWithStudent[] = rawSubmissions.map((s) => ({
        ...s,
        student: students.find((st) => st.id === s.student_id) || null,
      }));
      setSubmissions(enriched);
    } catch (err) {
      console.error("Error fetching assignment data:", err);
      toast({ title: "Error", description: "Failed to load assignment data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [assignmentId, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Guard ──────────────────────────────────────────

  if (!isTeacher(profile)) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Only teachers can access this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading submissions...</p>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertTriangle className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Assignment not found.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/assignments")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Assignments
        </Button>
      </div>
    );
  }

  // ── Derived Data ───────────────────────────────────

  const getStudentName = (id: string) => allStudents.find((s) => s.id === id)?.full_name || "Unknown Student";

  const submittedStudentIds = new Set(submissions.map((s) => s.student_id));
  const assignedStudents = allStudents.filter((s) => assignedStudentIds.includes(s.id));
  const missingStudents = assignedStudents.filter((s) => !submittedStudentIds.has(s.id));

  const gradedCount = submissions.filter((s) => s.status === "graded" || s.status === "returned").length;
  const pendingCount = submissions.filter((s) => s.status === "submitted").length;
  const averageScore = (() => {
    const scored = submissions.filter((s) => s.score !== null && s.score !== undefined);
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((sum, s) => sum + (s.score || 0), 0) / scored.length);
  })();

  const filteredSubmissions = submissions.filter((s) => {
    if (activeTab === "submitted") return s.status === "submitted";
    if (activeTab === "graded") return s.status === "graded" || s.status === "returned";
    return true;
  });

  // ── Handlers ───────────────────────────────────────

  const openGradeDialog = (sub: SubmissionWithStudent) => {
    setSelectedSubmission(sub);
    setGradeScore(sub.score?.toString() || "");
    setGradeFeedback(sub.teacher_feedback || "");
    setGradeDialogOpen(true);
  };

  const handleGrade = async () => {
    if (!selectedSubmission) return;
    const score = gradeScore ? Number(gradeScore) : null;

    setActionLoading(true);
    try {
      await gradeSubmission(
        selectedSubmission.id,
        score || 0,
        gradeFeedback.trim()
      );
      toast({ title: "Graded!", description: `Submission graded successfully.` });
      setGradeDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to grade submission.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!selectedSubmission) return;
    const score = gradeScore ? Number(gradeScore) : null;

    setActionLoading(true);
    try {
      await returnSubmission(
        selectedSubmission.id,
        score,
        gradeFeedback.trim()
      );
      toast({ title: "Returned!", description: `Submission returned to student with feedback.` });
      setGradeDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to return submission.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "submitted":
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 border-0">Pending Review</Badge>;
      case "graded":
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0">Graded</Badge>;
      case "returned":
        return <Badge className="bg-primary/20 text-primary border-0">Returned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // ── Render ─────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="container max-w-7xl py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex items-start gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate("/dashboard/assignments")} className="shrink-0 mt-1">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{assignment.title}</h1>
              <div className="flex items-center flex-wrap gap-3 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {assignment.grade_level}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Due {format(new Date(assignment.due_date), "MMM d, yyyy")}
                </span>
                {assignment.max_score && (
                  <span className="font-medium">Max Score: {assignment.max_score}</span>
                )}
              </div>
              {assignment.description && (
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{assignment.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard icon={<Users className="h-5 w-5" />} label="Assigned" value={assignedStudentIds.length} color="text-primary" bg="bg-primary/10" />
          <StatCard icon={<FileText className="h-5 w-5" />} label="Submitted" value={submissions.length} color="text-primary" bg="bg-primary/5" />
          <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Graded" value={gradedCount} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950" />
          <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="Pending" value={pendingCount} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-950" />
          <StatCard icon={<BarChart3 className="h-5 w-5" />} label="Avg Score" value={averageScore !== null ? averageScore : "—"} color="text-violet-600" bg="bg-violet-50 dark:bg-violet-950" />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All ({submissions.length})</TabsTrigger>
            <TabsTrigger value="submitted">Pending ({pendingCount})</TabsTrigger>
            <TabsTrigger value="graded">Graded ({gradedCount})</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submissions List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold">Submissions</h2>

            {filteredSubmissions.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="font-medium">No submissions yet</p>
                  <p className="text-sm text-muted-foreground">
                    {activeTab === "submitted" ? "All submissions have been graded." : "Students haven't submitted work yet."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredSubmissions.map((sub) => (
                  <Card
                    key={sub.id}
                    className={cn(
                      "transition-all hover:shadow-md cursor-pointer border-l-4",
                      sub.status === "submitted" ? "border-l-amber-400" :
                      sub.status === "graded" ? "border-l-emerald-400" : "border-l-blue-400",
                      selectedSubmission?.id === sub.id && !gradeDialogOpen && "ring-2 ring-primary/30"
                    )}
                    onClick={() => setSelectedSubmission(sub)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                            {sub.student?.full_name?.substring(0, 2).toUpperCase() || "??"}
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-base truncate">
                              {sub.student?.full_name || "Unknown Student"}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              Submitted {format(new Date(sub.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {sub.score !== null && sub.score !== undefined && (
                            <span className="text-lg font-bold text-primary">
                              {sub.score}{assignment.max_score ? `/${assignment.max_score}` : ""}
                            </span>
                          )}
                          {getStatusBadge(sub.status)}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0 pb-3">
                      {sub.notes && (
                        <div className="bg-muted/50 p-2.5 rounded-md text-sm mb-2">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Student Notes:</p>
                          <p className="line-clamp-2">{sub.notes}</p>
                        </div>
                      )}
                      {sub.teacher_feedback && (
                        <div className="bg-primary/5 p-2.5 rounded-md text-sm border border-primary/10">
                          <p className="text-xs font-medium text-primary mb-0.5">Your Feedback:</p>
                          <p className="line-clamp-2">{sub.teacher_feedback}</p>
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="pt-0 pb-3 flex items-center gap-2">
                      {sub.file_url && (
                        <Button variant="outline" size="sm" asChild onClick={(e) => e.stopPropagation()}>
                          <a href={sub.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5 mr-1.5" /> View File
                          </a>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={sub.status === "submitted" ? "default" : "outline"}
                        onClick={(e) => { e.stopPropagation(); openGradeDialog(sub); }}
                      >
                        <Star className="h-3.5 w-3.5 mr-1.5" />
                        {sub.status === "submitted" ? "Grade" : "Update Grade"}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Missing Students Sidebar */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Missing Submissions ({missingStudents.length})
            </h2>
            {missingStudents.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="font-medium text-sm">All students have submitted!</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-3">
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-2">
                      {missingStudents.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                          <div className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-xs font-bold shrink-0">
                            {s.full_name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{s.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.class_name || s.grade_level}
                            </p>
                          </div>
                          <Badge variant="destructive" className="ml-auto text-xs shrink-0">Missing</Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Assignment Instructions */}
            {assignment.instructions && (
              <>
                <h2 className="text-lg font-semibold flex items-center gap-2 pt-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Instructions
                </h2>
                <Card>
                  <CardContent className="py-3">
                    <p className="text-sm">{assignment.instructions}</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* ── Grade / Feedback Dialog ──────────────── */}
        <Dialog open={gradeDialogOpen} onOpenChange={setGradeDialogOpen}>
          {selectedSubmission && (
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  Grade Submission — {selectedSubmission.student?.full_name || "Student"}
                </DialogTitle>
                <DialogDescription>
                  Submitted on {format(new Date(selectedSubmission.submitted_at), "MMMM d, yyyy 'at' h:mm a")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Student notes */}
                {selectedSubmission.notes && (
                  <div className="bg-muted/50 p-3 rounded-md">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Student Notes</Label>
                    <p className="text-sm mt-1">{selectedSubmission.notes}</p>
                  </div>
                )}

                {/* Attached file */}
                {selectedSubmission.file_url && (
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Attached File</p>
                      <p className="text-xs text-muted-foreground truncate">{selectedSubmission.file_url}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <a href={selectedSubmission.file_url} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </a>
                    </Button>
                  </div>
                )}

                <Separator />

                {/* Score */}
                <div className="grid gap-2">
                  <Label htmlFor="grade-score" className="font-medium">
                    Score {assignment.max_score ? `(out of ${assignment.max_score})` : ""}
                  </Label>
                  <Input
                    id="grade-score"
                    type="number"
                    min="0"
                    max={assignment.max_score || undefined}
                    placeholder={assignment.max_score ? `0 – ${assignment.max_score}` : "Enter score"}
                    value={gradeScore}
                    onChange={(e) => setGradeScore(e.target.value)}
                    className="h-10"
                  />
                </div>

                {/* Feedback */}
                <div className="grid gap-2">
                  <Label htmlFor="grade-feedback" className="font-medium">Teacher Feedback</Label>
                  <Textarea
                    id="grade-feedback"
                    rows={4}
                    placeholder="Provide constructive feedback on the student's work..."
                    value={gradeFeedback}
                    onChange={(e) => setGradeFeedback(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 flex-col sm:flex-row">
                <Button variant="outline" onClick={() => setGradeDialogOpen(false)} disabled={actionLoading}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleGrade}
                  disabled={actionLoading}
                >
                  {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Save Grade
                </Button>
                <Button onClick={handleReturn} disabled={actionLoading}>
                  {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="h-4 w-4 mr-1.5" />
                  Grade & Return to Student
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

// ── Sub-components ─────────────────────────────────────

function StatCard({ icon, label, value, color, bg }: {
  icon: React.ReactNode; label: string; value: number | string; color: string; bg: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("rounded-lg p-2.5 shrink-0", bg, color)}>{icon}</div>
        <div>
          <p className="text-xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default FeedbackView;
