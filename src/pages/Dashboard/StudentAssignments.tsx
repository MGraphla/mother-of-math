import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format, isPast, differenceInDays, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, Upload, AlertTriangle, CheckCircle2, Clock, BookCheck, FileText,
  Paperclip, X, Star, Download, Send, Sparkles, Award, TrendingUp,
  MessageSquare, Eye, ArrowRight, Target, RotateCcw, Info,
  Calendar as CalendarIcon, RefreshCw, ChevronRight, BookOpen,
  Camera, GraduationCap, CheckCheck
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { parseAiFeedback } from "@/utils/grading";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Learner, StudentAssignment, AssignmentSubmission,
  getStudentSession, getAssignmentsForStudent, getSubmissionsForStudent,
  submitAssignment as submitAssignmentService,
  uploadSubmissionFileWithHash,
  refreshStudentSession,
  recordAssignmentEngagement,
  upsertPeerReviewCriterion,
  fetchPeerReviewsForStudentAssignment,
} from "@/services/studentService";
import { parseRubricFromDb } from "@/services/assignmentTeacherFeatures";
import { DEFAULT_RUBRIC_CRITERIA } from "@/utils/grading";
import { AssignmentComments } from "@/components/AssignmentComments";
import { gradeSubmissionWithAI, saveAiGrading } from "@/services/aiGrading";
import { celebrateSuccess, celebrateSparkle } from "@/lib/studentDelight";
import { motion } from "framer-motion";

const REFRESH_INTERVAL_MS = 60_000;

// ── Main component ─────────────────────────────────────
const StudentAssignments = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [student, setStudent] = useState<Learner | null>(null);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("pending");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [submittingAssignment, setSubmittingAssignment] = useState<StudentAssignment | null>(null);
  const [studentNotes, setStudentNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiGrading, setIsAiGrading] = useState(false);

  const [viewingAssignment, setViewingAssignment] = useState<StudentAssignment | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [viewingAttachment, setViewingAttachment] = useState<{ url: string; type: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [peerReflections, setPeerReflections] = useState<Record<string, string>>({});

  // Draft persistence
  useEffect(() => {
    if (submittingAssignment) {
      const draft = localStorage.getItem(`assignment_draft_${submittingAssignment.id}`);
      if (draft) setStudentNotes(draft);
    }
  }, [submittingAssignment]);

  useEffect(() => {
    if (submittingAssignment) {
      if (studentNotes) localStorage.setItem(`assignment_draft_${submittingAssignment.id}`, studentNotes);
      else localStorage.removeItem(`assignment_draft_${submittingAssignment.id}`);
    }
  }, [studentNotes, submittingAssignment]);

  useEffect(() => {
    if (!viewingAssignment || !student) return;
    void recordAssignmentEngagement(student.id, viewingAssignment.id, false);
  }, [viewingAssignment?.id, student?.id]);

  useEffect(() => {
    if (!submittingAssignment || !student) return;
    const t = window.setTimeout(() => {
      void recordAssignmentEngagement(student.id, submittingAssignment.id, !!studentNotes.trim());
    }, 900);
    return () => window.clearTimeout(t);
  }, [studentNotes, submittingAssignment?.id, student?.id]);

  useEffect(() => {
    if (!submittingAssignment || !student || !submittingAssignment.peer_review_enabled) {
      setPeerReflections({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const rows = await fetchPeerReviewsForStudentAssignment(student.id, submittingAssignment.id);
      if (cancelled) return;
      const m: Record<string, string> = {};
      rows.forEach((r) => { m[r.criterion_id] = r.body; });
      setPeerReflections(m);
    })();
    return () => { cancelled = true; };
  }, [submittingAssignment?.id, student?.id, submittingAssignment?.peer_review_enabled]);

  useEffect(() => {
    const s = getStudentSession();
    if (!s) { navigate("/student-login", { replace: true }); return; }
    setStudent(s);
    loadData(s.id);
    refreshStudentSession().then(fresh => { if (fresh) setStudent(fresh); });
  }, []);

  useEffect(() => {
    if (!student) return;
    const interval = setInterval(() => silentRefresh(student.id), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [student]);

  const loadData = useCallback(async (studentId: string) => {
    setIsLoading(true);
    try {
      const [a, sub] = await Promise.all([
        getAssignmentsForStudent(studentId),
        getSubmissionsForStudent(studentId),
      ]);
      setAssignments(a); setSubmissions(sub);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Error loading assignments:", e);
      toast({ title: "Error", description: "Failed to load assignments.", variant: "destructive" });
    } finally { setIsLoading(false); }
  }, []);

  const silentRefresh = useCallback(async (studentId: string) => {
    try {
      const [a, sub] = await Promise.all([
        getAssignmentsForStudent(studentId),
        getSubmissionsForStudent(studentId),
      ]);
      const previousIds = new Set(assignments.map(x => x.id));
      const newOnes = a.filter(x => !previousIds.has(x.id));
      if (newOnes.length > 0) toast({ title: "📚 New Assignment!", description: `${newOnes.length} new assignment${newOnes.length > 1 ? "s" : ""}.` });
      const prevGraded = new Set(submissions.filter(s => s.status === "graded").map(s => s.id));
      const newlyGraded = sub.filter(s => s.status === "graded" && !prevGraded.has(s.id));
      if (newlyGraded.length > 0) toast({ title: "⭐ Assignment Graded!", description: `${newlyGraded.length} submission${newlyGraded.length > 1 ? "s" : ""} graded.` });
      setAssignments(a); setSubmissions(sub);
      setLastRefresh(new Date());
    } catch (e) { console.error("Silent refresh error:", e); }
  }, [assignments, submissions]);

  const handleRefresh = async () => {
    if (!student || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await loadData(student.id);
      toast({ title: "Refreshed!", description: "Assignments are up to date." });
      celebrateSparkle();
    }
    finally { setIsRefreshing(false); }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFileSelected(e.dataTransfer.files[0]);
  };

  const handleFileSelected = (file: File | null) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast({ title: "File too large", description: "Max 10 MB.", variant: "destructive" }); return; }
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = e => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else { setImagePreview(null); }
  };

  const clearFile = () => {
    setSelectedFile(null); setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!submittingAssignment || !student) return;
    setIsSubmitting(true);
    const snap = submittingAssignment;
    try {
      if (snap.peer_review_enabled) {
        const criteria = parseRubricFromDb(snap.rubric_criteria);
        const useCriteria = criteria.length ? criteria : [...DEFAULT_RUBRIC_CRITERIA];
        for (const c of useCriteria) {
          const body = (peerReflections[c.id] || "").trim();
          if (body) {
            try {
              await upsertPeerReviewCriterion(student.id, snap.id, c.id, body);
            } catch (e) {
              console.warn("peer review save", e);
            }
          }
        }
      }

      let fileUrl: string | undefined;
      let fileHash: string | undefined;
      if (selectedFile) {
        try {
          const up = await uploadSubmissionFileWithHash(selectedFile, student.id, snap.id);
          fileUrl = up.url;
          fileHash = up.contentHash;
        } catch { toast({ title: "File upload issue", description: "Submitting without attachment." }); }
      }
      const newSub = await submitAssignmentService({
        assignment_id: snap.id,
        student_id: student.id,
        notes: studentNotes || undefined,
        file_url: fileUrl,
        file_hash: fileHash,
      });
      setSubmissions(prev => [newSub, ...prev]);
      setSubmittingAssignment(null);
      localStorage.removeItem(`assignment_draft_${snap.id}`);
      setStudentNotes(""); setSelectedFile(null); setImagePreview(null); setIsSubmitting(false);
      toast({ title: "Submitted! ✅", description: "Your assignment has been submitted." });
      celebrateSuccess();

      if (fileUrl && newSub.id) {
        setIsAiGrading(true);
        try {
          const aiResult = await gradeSubmissionWithAI({ ...newSub, file_url: fileUrl }, snap, student.full_name);
          if (aiResult.success) {
            await saveAiGrading(newSub.id, aiResult.score, aiResult.feedback);
            const updated = await getSubmissionsForStudent(student.id);
            setSubmissions(updated);
            toast({ title: "🤖 AI Review Complete", description: `Score: ${aiResult.score}. Check your feedback!` });
          } else if (aiResult.error) {
            toast({
              title: "AI review unavailable",
              description: aiResult.error,
              variant: "destructive",
            });
          }
        } catch {
          toast({
            title: "AI review failed",
            description: "Your submission was saved. Your teacher can still grade it.",
            variant: "destructive",
          });
        } finally {
          setIsAiGrading(false);
        }
      }
      return;
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to submit.", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  const getSubmission = (id: string) => submissions.find(s => s.assignment_id === id);
  const openViewDialog = (a: StudentAssignment) => setViewingAssignment(a);
  const startSubmitFromView = (a: StudentAssignment) => {
    setViewingAssignment(null); setSubmittingAssignment(a);
    setStudentNotes(""); setSelectedFile(null); setImagePreview(null);
    setPeerReflections({});
  };

  // ── Loading state ──────────────────────────────────
  if (isLoading) return (
    <div className="mx-auto flex min-h-[50dvh] w-full max-w-2xl items-center justify-center gap-3 rounded-2xl border border-border bg-background px-4 py-16 text-muted-foreground shadow-sm lg:my-1">
      <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary" />
      <span className="text-sm font-medium">Loading your assignments...</span>
    </div>
  );

  if (!student) return null;

  // ── Derived values ─────────────────────────────────
  const submittedIds = new Set(submissions.map(s => s.assignment_id));
  const pendingCount = assignments.filter(a => !submittedIds.has(a.id) && new Date(a.due_date) > new Date()).length;
  const submittedCount = submissions.length;
  const gradedCount = submissions.filter(s => s.status === "graded" || s.status === "returned").length;
  const lateCount = assignments.filter(a => !submittedIds.has(a.id) && new Date(a.due_date) < new Date()).length;
  const gradedSubs = submissions.filter(s => (s.status === "graded" || s.status === "returned") && s.score != null);
  const avgScore = gradedSubs.length > 0 ? Math.round(gradedSubs.reduce((sum, s) => sum + (s.score || 0), 0) / gradedSubs.length) : null;
  const overallPct = assignments.length > 0 ? Math.round((submittedCount / assignments.length) * 100) : 0;

  const filteredAssignments = assignments.filter(a => {
    const submitted = submittedIds.has(a.id);
    const late = new Date(a.due_date) < new Date();
    if (activeFilter === "pending") return !submitted && !late;
    if (activeFilter === "submitted") return submitted;
    if (activeFilter === "graded") return submitted && submissions.some(s => s.assignment_id === a.id && (s.status === "graded" || s.status === "returned"));
    if (activeFilter === "late") return !submitted && late;
    return true;
  }).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  const FILTERS = [
    { key: "pending",   label: "Pending",   count: pendingCount },
    { key: "submitted", label: "Submitted", count: submittedCount },
    { key: "graded",    label: "Graded",    count: gradedCount },
    { key: "late",      label: "Late",      count: lateCount },
    { key: "all",       label: "All",       count: assignments.length },
  ];

  return (
    <div className="mx-auto flex min-h-0 w-full min-w-0 max-w-2xl flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-background pb-6 shadow-sm lg:my-1 lg:max-w-[min(42rem,calc(100%-0.5rem))]">

      {/* ── Header ── */}
      <div className="relative overflow-x-hidden bg-primary text-primary-foreground lg:rounded-t-2xl">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/10 rounded-full" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/5 rounded-full" />
        </div>
        <div className="container relative z-10 max-w-2xl px-3 pt-4 pb-5 sm:px-4 sm:pt-6 sm:pb-7">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1 pr-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/55">My homework</p>
              <p className="mt-1 text-sm text-primary-foreground/60">{greeting},</p>
              <h1 className="mt-0.5 break-words text-xl font-bold leading-tight sm:text-2xl">{student.full_name}</h1>
              <div className="flex items-center gap-2 mt-1 text-primary-foreground/70 text-xs flex-wrap">
                {student.grade_level && (
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" /> {student.grade_level}
                  </span>
                )}
                {student.class_name && <><span className="opacity-40">·</span><span>{student.class_name}</span></>}
                {student.student_code && (
                  <><span className="opacity-40">·</span>
                  <code className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{student.student_code}</code></>
                )}
              </div>
              <p className="text-primary-foreground/50 text-xs mt-2 italic">
                {pendingCount === 0 ? "🎉 All caught up! Great job!" : pendingCount === 1 ? "💪 Just 1 assignment to go!" : `📚 ${pendingCount} assignments waiting.`}
              </p>
              <p className="text-primary-foreground/70 text-[11px] mt-2 sm:mt-3 leading-snug max-w-md hidden sm:block">
                <span className="font-semibold text-primary-foreground/90">Tip:</span> Tap <strong>View assignment</strong> to read what your teacher asked. Use <strong>Submit work</strong> when you are ready.<span className="hidden md:inline"> Send your file or photo.</span>
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 touch-manipulation rounded-xl text-primary-foreground hover:bg-white/20" onClick={handleRefresh} disabled={isRefreshing} title="Refresh list">
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>

          {/* Stats — one row on mobile */}
          <div className="mt-3 sm:mt-4 flex divide-x divide-white/15 rounded-xl border border-white/10 bg-white/10 overflow-hidden sm:grid sm:grid-cols-4 sm:gap-2 sm:divide-x-0 sm:bg-transparent sm:border-0 sm:rounded-none">
            {[
              { label: "Pending",   value: pendingCount,                          icon: Clock },
              { label: "Submitted", value: submittedCount,                        icon: CheckCircle2 },
              { label: "Graded",    value: gradedCount,                           icon: Star },
              { label: "Avg",       value: avgScore !== null ? `${avgScore}%` : "—", icon: TrendingUp },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex-1 min-w-0 py-2 px-1 text-center sm:rounded-xl sm:border sm:border-white/10 sm:bg-white/15 sm:p-2.5">
                  <Icon className="mx-auto mb-0.5 h-3 w-3 text-primary-foreground/60 sm:mb-1 sm:h-3 sm:w-3" />
                  <p className="text-sm font-bold leading-none sm:text-base">{s.value}</p>
                  <p className="mt-0.5 text-[8px] font-medium uppercase tracking-tighter text-primary-foreground/70 sm:text-[9px]">{s.label}</p>
                </div>
              );
            })}
          </div>

          {/* Overall progress */}
          {assignments.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/70 rounded-full transition-all duration-700" style={{ width: `${overallPct}%` }} />
              </div>
              <span className="text-[10px] text-primary-foreground/60 whitespace-nowrap">{overallPct}% done</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="container max-w-2xl min-w-0 px-3 sm:px-4">

        {/* Filter chips */}
        <div className="pt-4 pb-2 flex flex-col gap-2">
          <div className="flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p>
              <span className="font-medium text-foreground">Filters:</span> Pending = not sent yet and still on time. Late = past due and not sent. Submitted = your teacher received your work. Graded = teacher gave a score.
            </p>
          </div>
          <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
          <div className="-mx-1 flex touch-pan-x gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1">
            {FILTERS.map(f => (
              <button key={f.key} type="button" onClick={() => setActiveFilter(f.key)}
                className={cn(
                  "flex min-h-9 shrink-0 touch-manipulation items-center gap-1 rounded-full px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-150 sm:py-1.5",
                  activeFilter === f.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/60"
                )}>
                {f.label}
                {f.count > 0 && (
                  <span className={cn("text-[10px] font-bold", activeFilter === f.key ? "text-primary-foreground/70" : "text-muted-foreground/60")}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">{formatDistanceToNow(lastRefresh, { addSuffix: true })}</span>
          </div>
        </div>

        {/* Late warning */}
        {lateCount > 0 && activeFilter !== "late" && (
          <button onClick={() => setActiveFilter("late")}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 mb-3 bg-destructive/5 border border-destructive/20 rounded-xl text-left hover:bg-destructive/10 transition-colors">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-medium">{lateCount} overdue assignment{lateCount > 1 ? "s" : ""}</p>
            <ChevronRight className="h-4 w-4 text-destructive/50 ml-auto shrink-0" />
          </button>
        )}

        {/* AI grading indicator */}
        {isAiGrading && (
          <div className="flex items-center gap-3 px-4 py-3 mb-3 bg-primary/5 border border-primary/20 rounded-xl">
            <Sparkles className="h-4 w-4 text-primary animate-pulse shrink-0" />
            <p className="text-sm text-primary font-medium">AI is reviewing your submission...</p>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary/60 ml-auto shrink-0" />
          </div>
        )}

        {/* Empty state */}
        {filteredAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <BookCheck className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-foreground/60">
              {activeFilter === "pending" ? "All caught up! 🎉" : activeFilter === "late" ? "No overdue assignments!" : `No ${activeFilter} assignments`}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {activeFilter === "pending" ? "You have no pending assignments right now." : activeFilter === "late" ? "Great job keeping on top of your work!" : "Nothing to show here yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAssignments.map((assignment, index) => {
              const submission = getSubmission(assignment.id);
              const dueDate = new Date(assignment.due_date);
              return (
                <AssignmentItem
                  key={assignment.id}
                  listIndex={index}
                  assignment={assignment}
                  submission={submission}
                  dueDate={dueDate}
                  onView={() => openViewDialog(assignment)}
                  onSubmit={() => startSubmitFromView(assignment)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════ DIALOGS ═══════ */}

      {/* View Detail */}
      <Dialog open={!!viewingAssignment} onOpenChange={o => { if (!o) setViewingAssignment(null); }}>
        <DialogContent className="max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem))] w-[min(100vw-0.5rem,calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right)))] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-xl">
          {viewingAssignment && (
            <AssignmentDetailView
              assignment={viewingAssignment}
              submission={getSubmission(viewingAssignment.id)}
              onClose={() => setViewingAssignment(null)}
              onSubmit={() => startSubmitFromView(viewingAssignment)}
              onViewAttachment={(url: string, type: string) => setViewingAttachment({ url, type })}
              studentName={student.full_name}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Submit */}
      <Dialog open={!!submittingAssignment} onOpenChange={o => { if (!o) setSubmittingAssignment(null); }}>
        <DialogContent className="max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem))] w-[min(100vw-0.5rem,calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right)))] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md">
          {submittingAssignment && (
            <>
              <div className="bg-primary text-primary-foreground px-6 py-5 relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full" />
                <div className="relative z-10">
                  <DialogTitle className="text-base font-bold flex items-center gap-2"><Send className="h-4 w-4" /> Submit Assignment</DialogTitle>
                  <DialogDescription className="text-primary-foreground/70 text-sm mt-0.5">{submittingAssignment.title}</DialogDescription>
                  <div className="flex items-center gap-2 mt-2">
                    {submittingAssignment.max_score && (
                      <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full">{submittingAssignment.max_score} pts</span>
                    )}
                    <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CalendarIcon className="h-2.5 w-2.5" /> {format(new Date(submittingAssignment.due_date), "MMM d")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {studentNotes && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-1.5">
                    <CheckCheck className="h-3.5 w-3.5 text-primary" /> Draft saved
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium mb-2 block">Upload Your Work</Label>
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200",
                      isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40 hover:bg-muted/20"
                    )}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  >
                    <input type="file" className="hidden" ref={fileInputRef} onChange={e => handleFileSelected(e.target.files?.[0] || null)} accept="image/*,application/pdf,.doc,.docx" />
                    <input type="file" className="hidden" ref={cameraInputRef} accept="image/*" capture="environment" onChange={e => handleFileSelected(e.target.files?.[0] || null)} />

                    {imagePreview ? (
                      <div className="relative w-full max-h-48 overflow-hidden rounded-lg group">
                        <img src={imagePreview} alt="Preview" className="w-full object-contain" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                          <Button variant="destructive" size="sm" onClick={e => { e.stopPropagation(); clearFile(); }}>Remove</Button>
                        </div>
                      </div>
                    ) : selectedFile ? (
                      <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-xl border border-primary/20 w-full">
                        <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0"><FileText className="h-4 w-4 text-primary" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{selectedFile.name}</p>
                          <p className="text-[10px] text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:text-destructive" onClick={e => { e.stopPropagation(); clearFile(); }}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <>
                        <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center transition-colors", isDragging ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                          <Upload className="h-5 w-5" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm"><span className="font-semibold text-primary">Tap to upload</span> or drag & drop</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Images, PDF or Docs (max 10 MB)</p>
                        </div>
                      </>
                    )}
                  </div>
                  {!selectedFile && (
                    <Button variant="outline" size="sm" className="mt-2 w-full rounded-xl border-dashed text-muted-foreground h-8 text-xs"
                      onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                      <Camera className="mr-2 h-3.5 w-3.5" /> Take a photo
                    </Button>
                  )}
                </div>

                {submittingAssignment.peer_review_enabled && (
                  <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
                    <div>
                      <Label className="text-sm font-semibold">Rubric reflection</Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        Optional but helpful: one short note per row before you submit — your teacher can read these while grading.
                      </p>
                    </div>
                    {(parseRubricFromDb(submittingAssignment.rubric_criteria).length
                      ? parseRubricFromDb(submittingAssignment.rubric_criteria)
                      : DEFAULT_RUBRIC_CRITERIA
                    ).map((c) => (
                      <div key={c.id}>
                        <Label className="text-xs text-muted-foreground">{c.name} (max {c.maxScore})</Label>
                        <Textarea
                          placeholder={`Reflect on "${c.name}"…`}
                          value={peerReflections[c.id] || ""}
                          onChange={e => setPeerReflections(prev => ({ ...prev, [c.id]: e.target.value }))}
                          className="mt-1 min-h-[52px] rounded-lg text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium mb-2 block">Notes for Teacher</Label>
                  <Textarea placeholder="Add any comments or questions..." value={studentNotes} onChange={e => setStudentNotes(e.target.value)} className="resize-none h-20 rounded-xl" />
                </div>
              </div>

              <div className="px-5 pb-5 flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setSubmittingAssignment(null)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 rounded-xl">
                  {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : <><Send className="h-4 w-4 mr-2" />Submit</>}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Attachment viewer */}
      <Dialog open={!!viewingAttachment} onOpenChange={o => { if (!o) setViewingAttachment(null); }}>
        <DialogContent className="flex max-h-[min(96dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] w-[min(100vw-0.5rem,calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right)))] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-4xl">
          <VisuallyHidden><DialogDescription>Attachment preview</DialogDescription></VisuallyHidden>
          <div className="flex items-center justify-between p-4 border-b shrink-0">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Attachment
            </DialogTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setViewingAttachment(null)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex min-h-[40dvh] flex-1 items-center justify-center overflow-auto bg-muted/10 p-2 sm:min-h-[50vh] sm:p-4">
            {viewingAttachment?.type === "image" ? (
              <img src={viewingAttachment.url} alt="Attachment" className="max-h-[min(70dvh,75vh)] w-full max-w-full object-contain rounded-lg shadow sm:rounded-xl" />
            ) : (
              <iframe src={viewingAttachment?.url} title="Document" className="h-[min(65dvh,70vh)] w-full min-h-[50dvh] rounded-lg border bg-white sm:min-h-[60vh]" />
            )}
          </div>
          <div className="p-4 border-t flex justify-end gap-2 shrink-0">
            <Button variant="outline" className="rounded-xl" asChild>
              <a href={viewingAttachment?.url} target="_blank" rel="noopener noreferrer" download>
                <Download className="mr-2 h-4 w-4" /> Download
              </a>
            </Button>
            <Button className="rounded-xl" onClick={() => setViewingAttachment(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Assignment list item (explicit View + Submit — no hidden “click whole row”) ──
const AssignmentItem = ({ assignment, submission, dueDate, onView, onSubmit, listIndex = 0 }: any) => {
  const isPastDue = isPast(dueDate);
  const isSubmitted = !!submission;
  const isGraded = submission?.status === "graded";
  const isReturned = submission?.status === "returned";
  const daysLeft = differenceInDays(dueDate, new Date());

  const getDueLabel = () => {
    if (isPastDue && !isSubmitted) return "Overdue";
    if (isToday(dueDate)) return "Due today";
    if (isTomorrow(dueDate)) return "Due tomorrow";
    if (daysLeft <= 3) return `${daysLeft}d left`;
    return format(dueDate, "MMM d");
  };

  const isUrgent = !isSubmitted && (isPastDue || daysLeft <= 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(listIndex * 0.04, 0.24), type: "spring", stiffness: 380, damping: 30 }}
      whileHover={{ y: -2 }}
      className={cn(
        "overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md",
        isUrgent && "border-destructive/35 ring-1 ring-destructive/10"
      )}
    >
      <div className="flex gap-0">
        <div
          className={cn(
            "w-1.5 shrink-0 self-stretch",
            isGraded ? "bg-primary"
              : isReturned ? "bg-destructive"
              : isSubmitted ? "bg-primary/50"
              : isPastDue ? "bg-destructive"
              : daysLeft <= 3 ? "bg-primary/70"
              : "bg-primary/25"
          )}
        />
        <div className="flex-1 min-w-0 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex gap-3 min-w-0 flex-1">
            <div
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm",
                isGraded ? "bg-primary/10 text-primary"
                  : isReturned ? "bg-destructive/10 text-destructive"
                  : isSubmitted ? "bg-primary/10 text-primary"
                  : isPastDue ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              )}
            >
              {isGraded ? <Star className="h-5 w-5" />
                : isReturned ? <RotateCcw className="h-5 w-5" />
                : isSubmitted ? <CheckCircle2 className="h-5 w-5" />
                : isPastDue ? <AlertTriangle className="h-5 w-5" />
                : assignment.title.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground leading-snug line-clamp-2">{assignment.title}</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-muted-foreground">
                {assignment.subject && (
                  <span className="bg-muted px-2 py-0.5 rounded-full">{assignment.subject}</span>
                )}
                <span className="inline-flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" /> Due {format(dueDate, "MMM d, yyyy")}
                </span>
                {assignment.max_score != null && (
                  <span className="inline-flex items-center gap-1">
                    <Target className="h-3 w-3" /> {assignment.max_score} pts max
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "inline-flex mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                  isPastDue && !isSubmitted ? "bg-destructive/10 text-destructive"
                    : isReturned ? "bg-destructive/10 text-destructive"
                    : isGraded ? "bg-primary/10 text-primary"
                    : isSubmitted ? "bg-primary/10 text-primary"
                    : daysLeft <= 3 ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isGraded ? "Graded" : isReturned ? "Needs revision" : isSubmitted ? "Submitted" : getDueLabel()}
              </span>
              {isGraded && submission?.score != null && (
                <div className="flex items-center gap-2 mt-2 max-w-[220px]">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${Math.min(100, submission.score)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-primary">{submission.score}%</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[200px]">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full touch-manipulation rounded-xl border-primary/40 text-primary hover:bg-primary/10 sm:w-full"
              onClick={onView}
            >
              <Eye className="mr-2 h-4 w-4" /> View assignment
            </Button>
            {!isSubmitted && (
              <Button type="button" className="min-h-11 w-full touch-manipulation rounded-xl sm:w-full" onClick={onSubmit}>
                <Upload className="mr-2 h-4 w-4" /> Submit work
              </Button>
            )}
            {isReturned && (
              <Button type="button" variant="destructive" className="min-h-11 w-full touch-manipulation rounded-xl sm:w-full" onClick={onSubmit}>
                <RotateCcw className="mr-2 h-4 w-4" /> Resubmit work
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ── Assignment detail view ─────────────────────────────
const AssignmentDetailView = ({ assignment, submission, onClose, onSubmit, onViewAttachment, studentName }: any) => {
  const isPastDueDate = isPast(new Date(assignment.due_date));
  const isGraded = submission?.status === "graded";
  const isReturned = submission?.status === "returned";
  const isSubmitted = !!submission;

  return (
    <div className="flex h-full max-h-[min(85dvh,90vh)] flex-col">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-5 py-5 shrink-0 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full pointer-events-none" />
        <VisuallyHidden><DialogDescription>Details for {assignment.title}</DialogDescription></VisuallyHidden>
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {assignment.subject && <Badge className="bg-white/20 text-primary-foreground border-0 text-xs">{assignment.subject}</Badge>}
                {isGraded && <Badge className="bg-white/20 text-primary-foreground border-0 text-xs"><Star className="w-3 h-3 mr-1" />Graded</Badge>}
                {isReturned && <Badge className="bg-destructive/80 text-destructive-foreground border-0 text-xs"><RotateCcw className="w-3 h-3 mr-1" />Revision</Badge>}
              </div>
              <DialogTitle className="text-lg font-bold text-primary-foreground leading-snug">{assignment.title}</DialogTitle>
              <div className="flex items-center gap-3 mt-1.5 text-primary-foreground/70 text-xs flex-wrap">
                <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {format(new Date(assignment.due_date), "PPP")}</span>
                {assignment.max_score && <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {assignment.max_score} pts</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isGraded && submission?.score != null && (
                <div className="text-center bg-white/20 rounded-xl px-3 py-1.5">
                  <p className="text-lg font-bold leading-none">{submission.score}%</p>
                  <p className="text-[9px] text-primary-foreground/60 mt-0.5">score</p>
                </div>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary-foreground hover:bg-white/20 rounded-xl" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-5">
          <p className="text-xs text-muted-foreground rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 leading-relaxed">
            Read everything below. When you are finished, use <strong className="text-foreground">Submit work</strong> from the list (or the button at the bottom) to send your file to your teacher.
          </p>

          {/* Instructions */}
          {(assignment.description || assignment.instructions) && (
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <BookOpen className="h-3.5 w-3.5" /> Instructions
              </h3>
              <div className="bg-muted/20 rounded-xl p-4 border text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>
                  {assignment.description || assignment.instructions || "No instructions provided."}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Teacher attachment */}
          {assignment.attachment_url && (
            <div className="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-xl p-4">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Paperclip className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Attached Resource</p>
                <p className="text-xs text-muted-foreground">From your teacher</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 rounded-xl text-xs"
                  onClick={() => { const type = /\.(jpeg|jpg|gif|png|webp|svg|avif|bmp)(\?|$)/i.test(assignment.attachment_url) ? "image" : "file"; onViewAttachment(assignment.attachment_url, type); }}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> View
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl" asChild>
                  <a href={assignment.attachment_url} target="_blank" rel="noopener noreferrer" download><Download className="h-3.5 w-3.5" /></a>
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Your work */}
          <div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
              <Upload className="h-3.5 w-3.5" /> Your Work
            </h3>

            {!isSubmitted ? (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
                  <Upload className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">You haven't submitted this assignment yet.</p>
                <Button onClick={onSubmit} className="rounded-xl">
                  <Upload className="h-4 w-4 mr-2" />
                  {isPastDueDate ? "Submit Late" : "Start Submission"}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Submitted card */}
                <div className="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-xl p-3.5">
                  <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">Submitted</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(submission.submitted_at), "PPP 'at' p")}</p>
                  </div>
                  {submission.file_url && (
                    <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs"
                      onClick={() => { const type = /\.(jpeg|jpg|gif|png|webp|svg|avif|bmp)(\?|$)/i.test(submission.file_url!) ? "image" : "file"; onViewAttachment(submission.file_url!, type); }}>
                      <Eye className="h-3 w-3 mr-1" /> View
                    </Button>
                  )}
                </div>

                {submission.notes && (
                  <div className="bg-muted/20 rounded-xl p-3 border-l-4 border-primary/30 text-sm italic text-muted-foreground">
                    "{submission.notes}"
                  </div>
                )}

                {/* Score */}
                {isGraded && submission.score != null && (
                  <div className="flex items-center gap-4 bg-background rounded-xl border p-4 shadow-sm">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-xl text-primary shrink-0">
                      {submission.score}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Your Score</p>
                      <p className="text-sm font-medium text-foreground mt-0.5">
                        {assignment.max_score ? `${submission.score} / ${assignment.max_score} points` : `${submission.score}%`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {submission.score >= 80 ? "Excellent work! 🌟" : submission.score >= 60 ? "Good job! Keep it up 💪" : "Keep practising — you can do it! 📚"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Teacher feedback */}
                {submission.teacher_feedback && (
                  <div className="bg-primary/5 border-l-4 border-primary rounded-xl p-4">
                    <h4 className="font-semibold text-primary text-xs uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Award className="h-3.5 w-3.5" /> Teacher Feedback
                    </h4>
                    <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{String(submission.teacher_feedback)}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Revision banner */}
                {isReturned && (
                  <div className="flex items-center gap-3 bg-destructive/5 border border-destructive/20 rounded-xl p-3.5">
                    <RotateCcw className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-sm text-destructive font-medium">Your teacher returned this for revision. Please resubmit.</p>
                  </div>
                )}

                {/* AI feedback */}
                {submission.ai_graded_at && submission.ai_feedback && (() => {
                  const sections = parseAiFeedback(submission.ai_feedback!);
                  const maxScore = assignment.max_score || 100;
                  const pct = submission.ai_score != null ? Math.round((submission.ai_score / maxScore) * 100) : null;
                  return (
                    <div className="rounded-xl border border-primary/20 overflow-hidden bg-primary/5">
                      <div className="px-4 py-2.5 border-b border-primary/10 flex items-center justify-between bg-primary/10">
                        <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                          <Sparkles className="h-3.5 w-3.5" /> AI Preliminary Review
                        </div>
                        {pct !== null && (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 bg-primary/20 rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-bold text-primary">{pct}%</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 space-y-2">
                        {sections.analysis && (
                          <div className="rounded-lg bg-background border border-primary/10 p-3">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">📋 Analysis</p>
                            <p className="text-sm text-foreground/80 leading-relaxed">{sections.analysis}</p>
                          </div>
                        )}
                        {sections.error_type && (
                          <div className="rounded-lg bg-background border border-primary/10 p-3">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">⚠️ Error Type</p>
                            <p className="text-sm text-foreground/80 leading-relaxed">{sections.error_type}</p>
                          </div>
                        )}
                        {sections.remediation && (
                          <div className="rounded-lg bg-background border border-primary/10 p-3">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">🛠️ Practice This</p>
                            <p className="text-sm text-foreground/80 leading-relaxed">{sections.remediation}</p>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground px-4 pb-3">* Preliminary review. Final grade set by your teacher.</p>
                    </div>
                  );
                })()}

                {/* Discussion */}
                <div className="pt-1">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <MessageSquare className="h-3.5 w-3.5" /> Discussion
                  </h4>
                  <div className="border rounded-xl overflow-hidden bg-muted/10">
                    <AssignmentComments assignmentId={assignment.id} isStudent={true} studentId={submission.student_id} studentName={studentName} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t shrink-0 flex flex-wrap items-center justify-between gap-3 bg-background">
        <Button variant="outline" className="rounded-xl" onClick={onClose}>Back to list</Button>
        {!isSubmitted && (
          <Button onClick={onSubmit} className="rounded-xl">
            <Upload className="h-4 w-4 mr-2" /> Submit Assignment
          </Button>
        )}
        {isReturned && (
          <Button onClick={onSubmit} variant="destructive" className="rounded-xl">
            <RotateCcw className="h-4 w-4 mr-2" /> Resubmit
          </Button>
        )}
      </div>
    </div>
  );
};

export default StudentAssignments;
