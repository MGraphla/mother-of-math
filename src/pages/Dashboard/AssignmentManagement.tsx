import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { isTeacher, PRIMARY_GRADE_LEVELS } from "@/types";
import { format, isPast, isFuture, differenceInDays, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogTitle
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card, CardContent, CardFooter, CardHeader, CardTitle
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";
import {
  Search, Calendar as CalendarIcon, Plus, ClipboardList, Clock, AlertTriangle,
  CheckCircle2, FileText, Trash2, Edit, Loader2, Users, GraduationCap,
  BarChart3, Eye, Copy, Archive, MessageSquare, Star, Send, Sparkles, Brain,
  ExternalLink, RefreshCw, Download, Paperclip, X, Trophy, Target, ChevronDown,
  Image as ImageIcon, User as UserIcon, ArrowUpDown, RotateCcw, Undo2,
  BookOpen, Timer
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Student, StudentAssignment, AssignmentSubmission,
  createAssignment, getAssignmentsByTeacher, updateAssignment,
  deleteAssignment as deleteAssignmentService, getStudentsByTeacher,
  getAssignmentStudents, getSubmissionsForAssignment, gradeSubmission,
  updateAssignmentStudents, uploadSubmissionFile,
  getAssignmentStatsForTeacher, getSubmissionBreakdown, AssignmentStats,
  returnSubmission
} from "@/services/studentService";
import {
  gradeSubmissionWithAI, saveAiGrading, batchGradeSubmissions,
  getAiGradingSummary, checkAiGradingStatus, regradeSubmissionWithAI
} from "@/services/aiGrading";
import { createNotification } from "@/services/notificationService";
import { AssignmentComments } from "@/components/AssignmentComments";
import { formatDistanceToNow } from "date-fns";
import { parseAiFeedback, RubricCriterion, DEFAULT_RUBRIC_CRITERIA } from "@/utils/grading";
import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────

interface AssignmentWithMeta extends StudentAssignment {
  assignedStudentIds: string[];
  submissionCount: number;
}

type SortField = 'title' | 'due_date' | 'submissions' | 'created_at';
type SortDir = 'asc' | 'desc';

type FormData = {
  title: string;
  description: string;
  due_date: string;
  due_time: string;
  grade_level: string;
  subject: string;
  status: "active" | "draft" | "closed";
  max_score: string;
  instructions: string;
  selectedStudentIds: string[];
  rubric_criteria: RubricCriterion[];
};

const emptyForm: FormData = {
  title: "",
  description: "",
  due_date: "",
  due_time: "23:59",
  grade_level: "",
  subject: "Mathematics",
  status: "active",
  max_score: "",
  instructions: "",
  selectedStudentIds: [],
  rubric_criteria: [],
};

// ── Main Component ─────────────────────────────────────

const AssignmentManagement = () => {
  const { user, profile } = useAuth();
  const { t } = useLanguage();

  // Data state
  const [assignments, setAssignments] = useState<AssignmentWithMeta[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentWithMeta | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<AssignmentWithMeta | null>(null);
  const [viewTarget, setViewTarget] = useState<AssignmentWithMeta | null>(null);
  const [discussionAssignment, setDiscussionAssignment] = useState<AssignmentWithMeta | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Grading state
  const [gradingAssignment, setGradingAssignment] = useState<AssignmentWithMeta | null>(null);
  const [submissions, setSubmissions] = useState<(AssignmentSubmission & { student_name?: string; student_code?: string | null })[]>([]);
  const [gradingSubmission, setGradingSubmission] = useState<AssignmentSubmission | null>(null);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [gradingLoading, setGradingLoading] = useState(false);
  const [batchGradingProgress, setBatchGradingProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [singleAiGrading, setSingleAiGrading] = useState<string | null>(null); // submission id being AI-graded

  // Enhanced stats state
  const [teacherStats, setTeacherStats] = useState<AssignmentStats | null>(null);
  const [aiStatus, setAiStatus] = useState<{ available: boolean; model: string } | null>(null);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('due_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Subject filter
  const [filterSubject, setFilterSubject] = useState<string>("all");

  // Bulk selection state
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Deadline extension state
  const [extensionAssignment, setExtensionAssignment] = useState<AssignmentWithMeta | null>(null);
  const [extensionStudentId, setExtensionStudentId] = useState<string>("");
  const [extensionDate, setExtensionDate] = useState<string>("");
  const [extensionTime, setExtensionTime] = useState<string>("23:59");

  // Rubric grading state
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});

  // ── Data Fetching ──────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [rawAssignments, rawStudents] = await Promise.all([
        getAssignmentsByTeacher(user.id),
        getStudentsByTeacher(user.id),
      ]);

      // Enrich assignments with student links & submission counts
      const enriched: AssignmentWithMeta[] = await Promise.all(
        rawAssignments.map(async (a) => {
          const [studentIds, submissions] = await Promise.all([
            getAssignmentStudents(a.id),
            getSubmissionsForAssignment(a.id),
          ]);
          return {
            ...a,
            assignedStudentIds: studentIds,
            submissionCount: submissions.length,
          };
        })
      );

      setAssignments(enriched);
      setStudents(rawStudents);
    } catch (err) {
      console.error("Error fetching assignment data:", err);
      toast({ title: t('common.error'), description: t('common.failedToLoadAssignments'), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Fetch enhanced stats & AI status ───────────────

  const fetchEnhancedStats = useCallback(async () => {
    if (!user?.id) return;
    setIsRefreshingStats(true);
    try {
      const [stats, status] = await Promise.all([
        getAssignmentStatsForTeacher(user.id),
        checkAiGradingStatus(),
      ]);
      setTeacherStats(stats);
      setAiStatus(status);
    } catch (err) {
      console.warn("Error fetching enhanced stats:", err);
    } finally {
      setIsRefreshingStats(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchEnhancedStats();
  }, [fetchEnhancedStats]);

  // ── Real-time subscription for new submissions ─────

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('assignment-submissions-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'assignment_submissions' },
        (payload) => {
          // Check if this submission is for one of our assignments
          const newSub = payload.new as any;
          const match = assignments.find(a => a.id === newSub.assignment_id);
          if (match) {
            toast({ title: '📤 New Submission', description: `A student submitted work for "${match.title}"` });
            fetchData();
            fetchEnhancedStats();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'assignment_submissions' },
        () => {
          if (gradingAssignment) {
            refreshSubmissions(gradingAssignment);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, assignments.length]);


  // ── Grading functions ─────────────────────────────

  const refreshSubmissions = async (assignment: AssignmentWithMeta) => {
    const subs = await getSubmissionsForAssignment(assignment.id);
    const enriched = subs.map((s) => {
      const st = students.find((st) => st.id === s.student_id);
      return {
        ...s,
        student_name: st?.full_name || t('common.unknownStudent'),
        student_code: st?.student_code || null,
      };
    });
    setSubmissions(enriched);
    return enriched;
  };

  const openGradingDialog = async (assignment: AssignmentWithMeta) => {
    setGradingAssignment(assignment);
    setGradingLoading(true);
    try {
      await refreshSubmissions(assignment);
    } catch {
      toast({ title: t('common.error'), description: t('common.failedToLoadSubmissions'), variant: 'destructive' });
    } finally {
      setGradingLoading(false);
    }
  };

  const openGradeForm = (submission: AssignmentSubmission) => {
    setGradingSubmission(submission);
    // Pre-fill with AI score/feedback if teacher hasn't graded yet
    setGradeScore(submission.score?.toString() || submission.ai_score?.toString() || '');
    setGradeFeedback(submission.teacher_feedback || submission.ai_feedback || '');
  };

  const handleGradeSubmit = async () => {
    if (!gradingSubmission || !gradingAssignment) return;
    if (!gradeScore || isNaN(Number(gradeScore))) {
      toast({ title: t('assignment.grading.invalidScore'), description: t('assignment.grading.invalidScore'), variant: 'destructive' });
      return;
    }
    setActionLoading(true);
    try {
      await gradeSubmission(gradingSubmission.id, Number(gradeScore), gradeFeedback);
      toast({ title: t('assignment.graded') + ' ✅', description: t('assignment.grading.gradeSaved') });
      // Send notification to student
      try {
        await createNotification({
          recipientStudentId: gradingSubmission.student_id,
          type: 'graded',
          title: t('assignment.notify.graded').replace('{title}', gradingAssignment.title),
          message: t('assignment.notify.gradedMsg').replace('{score}', gradeScore),
          relatedAssignmentId: gradingAssignment.id,
          relatedSubmissionId: gradingSubmission.id,
          linkUrl: '/student/assignments',
        });
      } catch (notifErr) {
        console.warn('Notification failed (non-fatal):', notifErr);
      }
      setGradingSubmission(null);
      if (gradingAssignment) await refreshSubmissions(gradingAssignment);
      await fetchData();
    } catch (err: any) {
      toast({ title: t('common.error'), description: err?.message || 'Failed to grade submission.', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  /** Return a submission to the student for revision */
  const handleReturnSubmission = async (sub: AssignmentSubmission & { student_name?: string }) => {
    if (!gradingAssignment) return;
    setActionLoading(true);
    try {
      await returnSubmission(sub.id, sub.score, gradeFeedback || sub.teacher_feedback || 'Please revise and resubmit your work.');
      toast({ title: t('assignment.grading.returned') + ' ↩️', description: t('assignment.grading.submissionReturned') });
      // Notify the student
      try {
        await createNotification({
          recipientStudentId: sub.student_id,
          type: 'resubmit_request',
          title: t('assignment.notify.returned').replace('{title}', gradingAssignment.title),
          message: t('assignment.notify.returnedMsg'),
          relatedAssignmentId: gradingAssignment.id,
          relatedSubmissionId: sub.id,
          linkUrl: '/student/assignments',
        });
      } catch (notifErr) {
        console.warn('Notification failed (non-fatal):', notifErr);
      }
      await refreshSubmissions(gradingAssignment);
    } catch (err: any) {
      toast({ title: t('common.error'), description: err?.message || 'Failed to return submission.', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  /** Allow a student to resubmit by deleting their existing submission */
  const handleAllowResubmission = async (sub: AssignmentSubmission & { student_name?: string }) => {
    if (!gradingAssignment) return;
    setActionLoading(true);
    try {
      // Set status to 'returned' to allow resubmission
      await returnSubmission(sub.id, null, 'You may resubmit your work.');
      toast({ title: t('assignment.action.allowResubmit') + ' 🔄', description: t('assignment.grading.resubmissionAllowed') });
      // Notify the student
      try {
        await createNotification({
          recipientStudentId: sub.student_id,
          type: 'resubmit_request',
          title: t('assignment.notify.resubmitAllowed').replace('{title}', gradingAssignment.title),
          message: t('assignment.notify.resubmitMsg'),
          relatedAssignmentId: gradingAssignment.id,
          relatedSubmissionId: sub.id,
          linkUrl: '/student/assignments',
        });
      } catch (notifErr) {
        console.warn('Notification failed (non-fatal):', notifErr);
      }
      await refreshSubmissions(gradingAssignment);
    } catch (err: any) {
      toast({ title: t('common.error'), description: err?.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  /** Run AI grading on a single submission */
  const handleSingleAiGrade = async (sub: AssignmentSubmission & { student_name?: string }) => {
    if (!gradingAssignment || !sub.file_url) {
      toast({ title: 'No file', description: 'This submission has no attached file to analyze.', variant: 'destructive' });
      return;
    }
    setSingleAiGrading(sub.id);
    try {
      const result = await gradeSubmissionWithAI(sub, gradingAssignment, sub.student_name || 'Student');
      if (result.success) {
        await saveAiGrading(sub.id, result.score, result.feedback);
        toast({ title: '🤖 AI Graded', description: `Score: ${result.score}. Review and confirm below.` });
        if (gradingAssignment) await refreshSubmissions(gradingAssignment);
      } else {
        toast({ title: 'AI Error', description: result.error || 'AI grading failed.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message, variant: 'destructive' });
    } finally {
      setSingleAiGrading(null);
    }
  };

  /** Batch AI grade all ungraded submissions with files */
  const handleBatchAiGrade = async () => {
    if (!gradingAssignment) return;
    const toGrade = submissions.filter((s) => !s.ai_graded_at && s.file_url);
    if (toGrade.length === 0) {
      toast({ title: 'Nothing to grade', description: 'All submissions with files have already been AI-graded.' });
      return;
    }
    setBatchGradingProgress({ current: 0, total: toGrade.length, name: '' });
    try {
      const result = await batchGradeSubmissions(
        toGrade.map((s) => ({ ...s, studentName: s.student_name || 'Student' })),
        gradingAssignment,
        (completed, total, name) => setBatchGradingProgress({ current: completed, total, name })
      );
      toast({
        title: `🤖 ${t('assignment.grading.batchComplete')}`,
        description: `${result.graded} ${t('assignment.graded')}, ${result.failed} failed.`,
      });
      await refreshSubmissions(gradingAssignment);
    } catch (err: any) {
      toast({ title: 'Batch grading error', description: err?.message, variant: 'destructive' });
    } finally {
      setBatchGradingProgress(null);
    }
  };

  /** Re-run AI grading on a submission that was already graded */
  const handleRegradeAi = async (sub: AssignmentSubmission & { student_name?: string }) => {
    if (!gradingAssignment || !sub.file_url) {
      toast({ title: 'No file', description: 'This submission has no attached file to analyze.', variant: 'destructive' });
      return;
    }
    setSingleAiGrading(sub.id);
    try {
      const result = await regradeSubmissionWithAI(sub.id, gradingAssignment, sub.student_name || 'Student');
      if (result.success) {
        toast({ title: '🔄 Re-graded', description: `New AI score: ${result.score}. Review and confirm.` });
        if (gradingAssignment) await refreshSubmissions(gradingAssignment);
      } else {
        toast({ title: 'Re-grade Error', description: result.error || 'Re-grading failed.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message, variant: 'destructive' });
    } finally {
      setSingleAiGrading(null);
    }
  };

  // ── Guard ──────────────────────────────────────────

  if (!isTeacher(profile)) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Only teachers can access this page.</p>
      </div>
    );
  }

  // ── Stats ──────────────────────────────────────────

  const stats = useMemo(() => {
    const now = new Date();
    const total = assignments.length;
    const active = assignments.filter((a) => a.status === "active").length;
    const draft = assignments.filter((a) => a.status === "draft").length;
    const overdue = assignments.filter(
      (a) => a.status === "active" && isPast(new Date(a.due_date))
    ).length;
    const dueSoon = assignments.filter((a) => {
      const d = new Date(a.due_date);
      return a.status === "active" && isFuture(d) && differenceInDays(d, now) <= 3;
    }).length;
    const totalSubmissions = assignments.reduce((sum, a) => sum + a.submissionCount, 0);
    return { total, active, draft, overdue, dueSoon, totalSubmissions };
  }, [assignments]);

  // ── Filtering ──────────────────────────────────────

  const filteredAssignments = useMemo(() => {
    const filtered = assignments.filter((a) => {
      // Search
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q) ||
        (a.instructions || "").toLowerCase().includes(q);

      // Grade
      const matchesGrade = filterGrade === "all" || a.grade_level === filterGrade;

      // Status
      const matchesStatus = filterStatus === "all" || a.status === filterStatus;

      // Subject
      const matchesSubject = filterSubject === "all" || (a.subject || '').toLowerCase().includes(filterSubject.toLowerCase());

      // Tab
      let matchesTab = true;
      if (activeTab === "active") matchesTab = a.status === "active" && isFuture(new Date(a.due_date));
      else if (activeTab === "overdue") matchesTab = a.status === "active" && isPast(new Date(a.due_date));
      else if (activeTab === "draft") matchesTab = a.status === "draft";
      else if (activeTab === "closed") matchesTab = a.status === "closed";

      return matchesSearch && matchesGrade && matchesStatus && matchesSubject && matchesTab;
    });

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'due_date': cmp = new Date(a.due_date).getTime() - new Date(b.due_date).getTime(); break;
        case 'submissions': cmp = a.submissionCount - b.submissionCount; break;
        case 'created_at': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [assignments, searchTerm, filterGrade, filterStatus, filterSubject, activeTab, sortField, sortDir]);

  // ── Student helpers ────────────────────────────────

  const filteredStudentsForForm = useMemo(() => {
    if (!studentSearch) return students;
    const q = studentSearch.toLowerCase();
    return students.filter((s) => s.full_name.toLowerCase().includes(q));
  }, [students, studentSearch]);

  const getStudentName = (id: string) => students.find((s) => s.id === id)?.full_name || "Unknown";

  // ── Form Handlers ──────────────────────────────────

  const openCreateForm = () => {
    setEditingAssignment(null);
    setFormData({ ...emptyForm, grade_level: profile?.grade_levels || '' });
    setStudentSearch("");
    setSelectedFile(null);
    setFormOpen(true);
  };

  const openEditForm = (assignment: AssignmentWithMeta) => {
    setEditingAssignment(assignment);
    const dueDate = new Date(assignment.due_date);
    const hours = dueDate.getHours().toString().padStart(2, '0');
    const mins = dueDate.getMinutes().toString().padStart(2, '0');
    setFormData({
      title: assignment.title,
      description: assignment.description || "",
      due_date: assignment.due_date,
      due_time: `${hours}:${mins}`,
      grade_level: assignment.grade_level,
      subject: assignment.subject || "Mathematics",
      status: assignment.status,
      max_score: assignment.max_score?.toString() || "",
      instructions: assignment.instructions || "",
      selectedStudentIds: [...assignment.assignedStudentIds],
      rubric_criteria: [],
    });
    setStudentSearch("");
    setSelectedFile(null);
    setFormOpen(true);
  };

  const toggleStudentSelection = (studentId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedStudentIds: prev.selectedStudentIds.includes(studentId)
        ? prev.selectedStudentIds.filter((id) => id !== studentId)
        : [...prev.selectedStudentIds, studentId],
    }));
  };

  const selectAllStudents = () => {
    setFormData((prev) => ({
      ...prev,
      selectedStudentIds: students.map((s) => s.id),
    }));
  };

  const deselectAllStudents = () => {
    setFormData((prev) => ({ ...prev, selectedStudentIds: [] }));
  };

  const handleSave = async () => {
    // Validation
    if (!formData.title.trim()) {
      toast({ title: "Missing Title", description: "Please enter an assignment title.", variant: "destructive" });
      return;
    }
    if (!formData.due_date) {
      toast({ title: "Missing Due Date", description: "Please select a due date.", variant: "destructive" });
      return;
    }

    setActionLoading(true);
    try {
      // Combine due_date with due_time
      const dueDateObj = new Date(formData.due_date);
      const [hh, mm] = (formData.due_time || "23:59").split(":").map(Number);
      dueDateObj.setHours(hh, mm, 0, 0);
      const combinedDueDate = dueDateObj.toISOString();

      if (editingAssignment) {
        let fileUrl = editingAssignment.attachment_url;
        if (selectedFile) {
          try {
            fileUrl = await uploadSubmissionFile(selectedFile, user!.id, editingAssignment.id);
          } catch (uploadErr: any) {
            console.warn("File upload failed:", uploadErr);
            toast({ title: "File upload issue", description: "File couldn't be uploaded.", variant: "default" });
          }
        }

        // Update existing assignment details
        await updateAssignment(editingAssignment.id, {
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          due_date: combinedDueDate,
          grade_level: formData.grade_level || editingAssignment.grade_level,
          subject: formData.subject || "Mathematics",
          status: formData.status,
          max_score: formData.max_score ? Number(formData.max_score) : null,
          instructions: formData.instructions.trim() || null,
          attachment_url: fileUrl,
        });
        // Also update student links
        await updateAssignmentStudents(editingAssignment.id, formData.selectedStudentIds);
        toast({ title: t("assignment.updated") || "Assignment Updated", description: `"${formData.title}" updated and assigned to ${formData.selectedStudentIds.length} student(s).` });
      } else {
        // Create new
        const newAssignment = await createAssignment(
          {
            teacher_id: user!.id,
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            subject: formData.subject || "Mathematics",
            grade_level: formData.grade_level || profile?.grade_levels || "Primary",
            due_date: combinedDueDate,
            status: formData.status,
            max_score: formData.max_score ? Number(formData.max_score) : null,
            instructions: formData.instructions.trim() || null,
            attachment_url: null,
          },
          formData.selectedStudentIds
        );

        if (selectedFile) {
          try {
            const fileUrl = await uploadSubmissionFile(selectedFile, user!.id, newAssignment.id);
            await updateAssignment(newAssignment.id, { attachment_url: fileUrl });
          } catch (uploadErr: any) {
            console.warn("File upload failed:", uploadErr);
            toast({ title: "File upload issue", description: "File couldn't be uploaded.", variant: "default" });
          }
        }

        // Notify assigned students about the new assignment
        if (formData.status === "active") {
          for (const studentId of formData.selectedStudentIds) {
            try {
              await createNotification({
                recipientStudentId: studentId,
                type: 'new_assignment',
                title: t("assignment.notify.newTitle") || "New Assignment",
                message: `${t("assignment.notify.newBody") || "You have a new assignment"}: "${formData.title.trim()}"`,
                relatedAssignmentId: newAssignment.id,
                linkUrl: '/student/assignments',
              });
            } catch (notifErr) {
              console.warn("Notification failed for student:", studentId, notifErr);
            }
          }
        }

        toast({ title: t("assignment.created") || "Assignment Created", description: `"${formData.title}" has been created and assigned to ${formData.selectedStudentIds.length} student(s).` });
      }
      setFormOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error("Error saving assignment:", err);
      toast({ title: "Error", description: err?.message || "Failed to save assignment.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteAssignmentService(deleteTarget.id);
      toast({ title: "Assignment Deleted", description: `"${deleteTarget.title}" has been removed.` });
      setDeleteTarget(null);
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to delete assignment.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusToggle = async (assignment: AssignmentWithMeta, newStatus: "active" | "draft" | "closed") => {
    try {
      await updateAssignment(assignment.id, { status: newStatus });
      toast({ title: "Status Updated", description: `Assignment marked as ${newStatus}.` });
      await fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    }
  };

  const duplicateAssignment = async (assignment: AssignmentWithMeta) => {
    setActionLoading(true);
    try {
      await createAssignment(
        {
          teacher_id: user!.id,
          title: `${assignment.title} (Copy)`,
          description: assignment.description,
          subject: assignment.subject,
          grade_level: assignment.grade_level,
          due_date: assignment.due_date,
          status: "draft",
          max_score: assignment.max_score,
          instructions: assignment.instructions,
          attachment_url: assignment.attachment_url,
        },
        assignment.assignedStudentIds
      );
      toast({ title: "Assignment Duplicated", description: "A copy has been created as draft." });
      await fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to duplicate assignment.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Bulk Actions ────────────────────────────────

  const toggleBulkSelect = (id: string) => {
    setSelectedAssignmentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkClose = async () => {
    setActionLoading(true);
    try {
      for (const id of selectedAssignmentIds) {
        await updateAssignment(id, { status: "closed" });
      }
      toast({ title: t("assignment.bulk.complete") || "Bulk Action Complete", description: `${selectedAssignmentIds.size} assignment(s) closed.` });
      setSelectedAssignmentIds(new Set());
      await fetchData();
    } catch { toast({ title: "Error", description: "Bulk close failed.", variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const handleBulkReopen = async () => {
    setActionLoading(true);
    try {
      for (const id of selectedAssignmentIds) {
        await updateAssignment(id, { status: "active" });
      }
      toast({ title: t("assignment.bulk.complete") || "Bulk Action Complete", description: `${selectedAssignmentIds.size} assignment(s) reopened.` });
      setSelectedAssignmentIds(new Set());
      await fetchData();
    } catch { toast({ title: "Error", description: "Bulk reopen failed.", variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const handleBulkDelete = async () => {
    setActionLoading(true);
    try {
      for (const id of selectedAssignmentIds) {
        await deleteAssignmentService(id);
      }
      toast({ title: t("assignment.bulk.complete") || "Bulk Action Complete", description: `${selectedAssignmentIds.size} assignment(s) deleted.` });
      setSelectedAssignmentIds(new Set());
      setBulkDeleteConfirm(false);
      await fetchData();
    } catch { toast({ title: "Error", description: "Bulk delete failed.", variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  // ── Export ─────────────────────────────────────────

  const handleExportCsv = () => {
    try {
      const rows = filteredAssignments.map(a => ({
        Title: a.title,
        Subject: a.subject || "Mathematics",
        "Grade Level": a.grade_level,
        Status: a.status,
        "Due Date": format(new Date(a.due_date), "yyyy-MM-dd HH:mm"),
        "Max Score": a.max_score || "",
        "Students Assigned": a.assignedStudentIds.length,
        "Submissions": a.submissions?.length || 0,
        "Graded": a.submissions?.filter((s: any) => s.status === 'graded').length || 0,
      }));
      const headers = Object.keys(rows[0] || {});
      const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${(r as any)[h]}"`).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `assignments_${format(new Date(), "yyyyMMdd")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: t("assignment.export.complete") || "Export Complete", description: t("assignment.export.csvReady") || "CSV file downloaded." });
    } catch {
      toast({ title: "Error", description: "Failed to export.", variant: "destructive" });
    }
  };

  // ── Deadline Extension ─────────────────────────────

  const handleGrantExtension = async () => {
    if (!extensionAssignment || !extensionStudentId || !extensionDate) return;
    setActionLoading(true);
    try {
      const extDate = new Date(extensionDate);
      const [eh, em] = (extensionTime || "23:59").split(":").map(Number);
      extDate.setHours(eh, em, 0, 0);
      // Store extension as a separate record or update student-specific deadline
      // For now update the assignment_students link with an extended_due_date
      const { error } = await supabase
        .from('assignment_students')
        .update({ extended_due_date: extDate.toISOString() })
        .eq('assignment_id', extensionAssignment.id)
        .eq('student_id', extensionStudentId);
      if (error) throw error;
      await createNotification({
        recipientStudentId: extensionStudentId,
        type: 'assignment_due',
        title: t("assignment.extension.granted") || "Deadline Extended",
        message: `${t("assignment.extension.body") || "Your deadline for"} "${extensionAssignment.title}" ${t("assignment.extension.extended") || "has been extended"}.`,
        relatedAssignmentId: extensionAssignment.id,
        linkUrl: '/student/assignments',
      });
      toast({ title: t("assignment.extension.granted") || "Extension Granted", description: `Deadline extended to ${format(extDate, "PPp")}.` });
      setExtensionAssignment(null);
      setExtensionStudentId("");
      setExtensionDate("");
      setExtensionTime("23:59");
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to grant extension.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Due date helpers ───────────────────────────────

  const getDueInfo = (dueDateStr: string, status: string) => {
    const due = new Date(dueDateStr);
    const now = new Date();
    const days = differenceInDays(due, now);

    if (status === "closed") return { label: t('assignment.status.closed'), color: "text-muted-foreground", bgColor: "bg-muted" };
    if (status === "draft") return { label: t('assignment.status.draft'), color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950" };
    if (isPast(due)) return { label: t('assignment.status.overdue'), color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-950" };
    if (isToday(due)) return { label: t('assignment.status.dueToday'), color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950" };
    if (days <= 3) return { label: `${t('assignment.status.dueIn')} ${days}d`, color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950" };
    return { label: `${t('assignment.status.dueIn')} ${days}d`, color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950" };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0">{t('assignment.status.active')}</Badge>;
      case "draft": return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-0">{t('assignment.status.draft')}</Badge>;
      case "closed": return <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-0">{t('assignment.status.closed')}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  // ── Loading State ──────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">{t('assignment.loading')}</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="container max-w-7xl py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('sidebar.assignments')}</h1>
            <div className="text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <span>{t('assignment.manageAssignments')}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { fetchData(); fetchEnhancedStats(); }} disabled={isRefreshingStats}>
              <RefreshCw className={cn("h-4 w-4 mr-1.5", isRefreshingStats && "animate-spin")} />
              {t('common.refresh')}
            </Button>
            <Button onClick={openCreateForm} size="lg" className="shadow-md">
              <Plus className="mr-2 h-5 w-5" />
              {t('assignment.createNew')}
            </Button>
          </div>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatsCard icon={<ClipboardList className="h-5 w-5" />} label={t('assignment.stats.total')} value={stats.total} color="text-primary" bgColor="bg-primary/10" />
          <StatsCard icon={<CheckCircle2 className="h-5 w-5" />} label={t('assignment.stats.active')} value={stats.active} color="text-emerald-600" bgColor="bg-emerald-50 dark:bg-emerald-950" />
          <StatsCard icon={<FileText className="h-5 w-5" />} label={t('assignment.stats.drafts')} value={stats.draft} color="text-blue-600" bgColor="bg-blue-50 dark:bg-blue-950" />
          <StatsCard icon={<AlertTriangle className="h-5 w-5" />} label={t('assignment.stats.overdue')} value={stats.overdue} color="text-red-600" bgColor="bg-red-50 dark:bg-red-950" />
          <StatsCard icon={<Clock className="h-5 w-5" />} label={t('assignment.stats.dueSoon')} value={stats.dueSoon} color="text-amber-600" bgColor="bg-amber-50 dark:bg-amber-950" />
          <StatsCard icon={<BarChart3 className="h-5 w-5" />} label={t('assignment.stats.submissions')} value={stats.totalSubmissions} color="text-violet-600" bgColor="bg-violet-50 dark:bg-violet-950" />
          <StatsCard 
            icon={<Brain className="h-5 w-5" />} 
            label={t('assignment.stats.aiGraded')} 
            value={teacherStats?.aiGradedCount || 0} 
            color="text-pink-600" 
            bgColor="bg-pink-50 dark:bg-pink-950" 
          />
          <StatsCard 
            icon={<Trophy className="h-5 w-5" />} 
            label={t('assignment.stats.avgScore')} 
            value={teacherStats?.averageScore ? `${Math.round(teacherStats.averageScore)}%` : "—"} 
            color="text-amber-600" 
            bgColor="bg-amber-50 dark:bg-amber-950" 
          />
        </div>

        {/* Progress Indicator */}
        {teacherStats && teacherStats.totalSubmissions > 0 && (
          <Card className="bg-gradient-to-r from-muted/30 to-muted/10 border-dashed">
            <CardContent className="py-3">
              <div className="flex items-center justify-between text-sm gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">{t('assignment.progress.graded')}: <strong className="text-foreground">{teacherStats.gradedCount}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span className="text-muted-foreground">{t('assignment.progress.pending')}: <strong className="text-foreground">{teacherStats.pendingReviewCount}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                    <span className="text-muted-foreground">{t('assignment.progress.aiReady')}: <strong className="text-foreground">{teacherStats.aiGradedCount - teacherStats.gradedCount > 0 ? teacherStats.aiGradedCount - teacherStats.gradedCount : 0}</strong></span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {Math.round((teacherStats.gradedCount / teacherStats.totalSubmissions) * 100)}% {t('assignment.progress.overall')}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full max-w-2xl grid grid-cols-5 h-11">
            <TabsTrigger value="all" className="text-xs sm:text-sm">{t('assignment.tabs.all')} ({assignments.length})</TabsTrigger>
            <TabsTrigger value="active" className="text-xs sm:text-sm">{t('assignment.tabs.active')}</TabsTrigger>
            <TabsTrigger value="overdue" className="text-xs sm:text-sm">{t('assignment.tabs.overdue')}</TabsTrigger>
            <TabsTrigger value="draft" className="text-xs sm:text-sm">{t('assignment.tabs.drafts')}</TabsTrigger>
            <TabsTrigger value="closed" className="text-xs sm:text-sm">{t('assignment.tabs.closed')}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('assignment.searchPlaceholder')}
              className="pl-9 h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterGrade} onValueChange={setFilterGrade}>
            <SelectTrigger className="w-full sm:w-[160px] h-10">
              <GraduationCap className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder={t('assignment.filter.allLevels')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('assignment.filter.allLevels')}</SelectItem>
              {PRIMARY_GRADE_LEVELS.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-[160px]">
            <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('assignment.filter.allSubjects') || 'Filter by subject'}
              className="pl-9 h-10"
              value={filterSubject === 'all' ? '' : filterSubject}
              onChange={(e) => setFilterSubject(e.target.value || 'all')}
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[140px] h-10">
              <SelectValue placeholder={t('assignment.filter.allStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('assignment.filter.allStatus')}</SelectItem>
              <SelectItem value="active">{t('assignment.tabs.active')}</SelectItem>
              <SelectItem value="draft">{t('assignment.tabs.drafts')}</SelectItem>
              <SelectItem value="closed">{t('assignment.tabs.closed')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={`${sortField}-${sortDir}`} onValueChange={(v) => { const [f, d] = v.split('-'); setSortField(f as SortField); setSortDir(d as SortDir); }}>
            <SelectTrigger className="w-full sm:w-[170px] h-10">
              <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder={t('assignment.sort.label') || 'Sort'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due_date-asc">{t('assignment.sort.dueDateAsc') || 'Due Date ↑'}</SelectItem>
              <SelectItem value="due_date-desc">{t('assignment.sort.dueDateDesc') || 'Due Date ↓'}</SelectItem>
              <SelectItem value="created_at-desc">{t('assignment.sort.newestFirst') || 'Newest First'}</SelectItem>
              <SelectItem value="created_at-asc">{t('assignment.sort.oldestFirst') || 'Oldest First'}</SelectItem>
              <SelectItem value="title-asc">{t('assignment.sort.titleAz') || 'Title A-Z'}</SelectItem>
              <SelectItem value="title-desc">{t('assignment.sort.titleZa') || 'Title Z-A'}</SelectItem>
              <SelectItem value="submissions-desc">{t('assignment.sort.mostSubmissions') || 'Most Submissions'}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="h-10" disabled={filteredAssignments.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            {t('assignment.action.exportCsv') || 'Export CSV'}
          </Button>
        </div>

        {/* Bulk Actions Bar */}
        {selectedAssignmentIds.size > 0 && (
          <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="text-sm font-medium">
              {selectedAssignmentIds.size} {t('assignment.bulk.selected') || 'selected'}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={handleBulkClose}>
                <Archive className="h-3.5 w-3.5 mr-1.5" />
                {t('assignment.action.bulkClose') || 'Close All'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkReopen}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                {t('assignment.action.bulkReopen') || 'Reopen All'}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteConfirm(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t('assignment.action.bulkDelete') || 'Delete All'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedAssignmentIds(new Set())}>
                <X className="h-3.5 w-3.5 mr-1.5" />
                {t('assignment.bulk.clear') || 'Clear'}
              </Button>
            </div>
          </div>
        )}

        {/* Assignment List */}
        {filteredAssignments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <ClipboardList className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{t('assignment.empty.title')}</h3>
              <p className="text-muted-foreground text-sm max-w-sm mb-4">
                {assignments.length === 0
                  ? t('assignment.empty.start')
                  : t('assignment.empty.adjust')}
              </p>
              {assignments.length === 0 && (
                <Button onClick={openCreateForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('assignment.empty.createFirst')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredAssignments.map((assignment) => {
              const dueInfo = getDueInfo(assignment.due_date, assignment.status);
              const assignedCount = assignment.assignedStudentIds.length;
              const gradedCount = assignment.submissions?.filter((s: any) => s.status === 'graded').length || 0;

              return (
                <Card
                  key={assignment.id}
                  className={cn("group transition-all duration-200 hover:shadow-md border-l-4", selectedAssignmentIds.has(assignment.id) && "ring-2 ring-primary/50")}
                  style={{
                    borderLeftColor:
                      assignment.status === "draft" ? "var(--color-blue-400)" :
                      assignment.status === "closed" ? "var(--color-gray-400)" :
                      isPast(new Date(assignment.due_date)) ? "var(--color-red-400)" :
                      "var(--color-emerald-400)",
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <Checkbox
                          checked={selectedAssignmentIds.has(assignment.id)}
                          onCheckedChange={() => toggleBulkSelect(assignment.id)}
                          className="mt-1 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <CardTitle className="text-lg leading-tight">{assignment.title}</CardTitle>
                            {getStatusBadge(assignment.status)}
                          </div>
                          <div className="flex items-center flex-wrap gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <BookOpen className="h-3.5 w-3.5" />
                              {assignment.subject || "Mathematics"}
                            </span>
                            <span className="flex items-center gap-1">
                              <GraduationCap className="h-3.5 w-3.5" />
                              {assignment.grade_level}
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="h-3.5 w-3.5" />
                              {format(new Date(assignment.due_date), "MMM d, yyyy 'at' HH:mm")}
                            </span>
                            <span className={cn("flex items-center gap-1 font-medium", dueInfo.color)}>
                              <Clock className="h-3.5 w-3.5" />
                              {dueInfo.label}
                            </span>
                          </div>
                        </div>
                      </div>
                      {assignment.max_score && (
                        <Badge variant="outline" className="shrink-0 text-sm font-mono">
                          {t('assignment.card.maxPts')}: {assignment.max_score} {t('assignment.card.pts')}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  {(assignment.description || assignment.instructions) && (
                    <CardContent className="pt-0 pb-3">
                      {assignment.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{assignment.description}</p>
                      )}
                      {assignment.instructions && (
                        <p className="text-xs text-muted-foreground/70 mt-1 italic line-clamp-1">
                          {t('assignment.card.instructions')}: {assignment.instructions}
                        </p>
                      )}
                    </CardContent>
                  )}

                  <CardFooter className="pt-0 flex flex-col sm:flex-row justify-between gap-3 border-t bg-muted/30 py-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-1.5 cursor-default">
                            <Users className="h-4 w-4" />
                            <span className="font-medium">{assignedCount}</span> {assignedCount !== 1 ? t('assignment.card.students') : t('assignment.card.student')}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {assignedCount > 0
                            ? assignment.assignedStudentIds.slice(0, 5).map((id) => getStudentName(id)).join(", ") +
                              (assignedCount > 5 ? ` +${assignedCount - 5} more` : "")
                            : t('assignment.card.noStudents')}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center gap-1.5 cursor-default">
                            <FileText className="h-4 w-4" />
                            <span className="font-medium">{assignment.submissionCount} / {assignedCount}</span> {t('assignment.card.submissions')}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {assignment.submissionCount} {t('assignment.card.submitted') || 'submitted'} / {assignedCount} {t('assignment.card.assigned') || 'assigned'}
                          {gradedCount > 0 && ` · ${gradedCount} ${t('assignment.card.graded') || 'graded'}`}
                        </TooltipContent>
                      </Tooltip>
                      <span className="hidden sm:flex items-center gap-1.5 text-xs">
                        {t('assignment.card.created')} {format(new Date(assignment.created_at), "MMM d, yyyy")}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setViewTarget(assignment)}>
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            {t('assignment.action.view')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('assignment.action.viewDetails')}</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openGradingDialog(assignment)}
                            className="border-primary/30 text-primary hover:bg-primary/5"
                          >
                            <Star className="h-3.5 w-3.5 mr-1.5" />
                            {t('assignment.action.grade')} ({assignment.submissionCount})
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('assignment.action.gradeSubmissions')}</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDiscussionAssignment(assignment)}
                            className="border-blue-500/30 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                          >
                            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                            {t('assignment.action.discuss')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('assignment.action.discussThread')}</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => openEditForm(assignment)}>
                            <Edit className="h-3.5 w-3.5 mr-1.5" />
                            {t('assignment.action.edit')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('assignment.action.editDetails')}</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => duplicateAssignment(assignment)}>
                            <Copy className="h-3.5 w-3.5 mr-1.5" />
                            {t('assignment.action.duplicate') || 'Duplicate'}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('assignment.action.duplicateDraft') || 'Duplicate as draft'}</TooltipContent>
                      </Tooltip>

                      {assignment.status === "active" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => handleStatusToggle(assignment, "closed")}>
                              <Archive className="h-3.5 w-3.5 mr-1.5" />
                              {t('assignment.action.close') || 'Close'}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('assignment.action.closeAssignment') || 'Close assignment'}</TooltipContent>
                        </Tooltip>
                      ) : assignment.status === "draft" ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="default" size="sm" onClick={() => handleStatusToggle(assignment, "active")}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                              {t('assignment.action.publish') || 'Publish'}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('assignment.action.publishAssignment') || 'Publish assignment'}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => handleStatusToggle(assignment, "active")}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                              {t('assignment.action.reopen') || 'Reopen'}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('assignment.action.reopenAssignment') || 'Reopen assignment'}</TooltipContent>
                        </Tooltip>
                      )}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(assignment)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('assignment.delete.title') || 'Delete assignment'}</TooltipContent>
                      </Tooltip>
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Create / Edit Dialog ──────────────────── */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0 border-0">
            {/* Modern Gradient Header */}
            <div className="px-6 pt-6 pb-5 shrink-0 relative overflow-hidden bg-gradient-to-br from-teal-500 via-emerald-500 to-green-600">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
              <div className="absolute top-1/2 right-1/4 w-6 h-6 bg-white/10 rounded-full" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                    {editingAssignment ? (
                      <Edit className="h-6 w-6 text-white" />
                    ) : (
                      <Plus className="h-6 w-6 text-white" />
                    )}
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold text-white">
                      {editingAssignment ? (t('assignment.form.editTitle') || 'Edit Assignment') : (t('assignment.form.createTitle') || 'Create New Assignment')}
                    </DialogTitle>
                    <DialogDescription className="text-white/70 text-sm mt-0.5">
                      {editingAssignment
                        ? (t('assignment.form.editDesc') || 'Update the assignment details and student assignments')
                        : (t('assignment.form.createDesc') || 'Design an engaging assignment for your students')}
                    </DialogDescription>
                  </div>
                </div>
                
                {/* Quick stats for editing */}
                {editingAssignment && (
                  <div className="mt-4 flex items-center gap-3">
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5 text-center border border-white/10">
                      <p className="text-sm font-semibold text-white">{editingAssignment.assignedStudentIds.length}</p>
                      <p className="text-[10px] text-white/60 uppercase">Assigned</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5 text-center border border-white/10">
                      <p className="text-sm font-semibold text-white">{editingAssignment.submissionCount}</p>
                      <p className="text-[10px] text-white/60 uppercase">Submitted</p>
                    </div>
                    <Badge className={cn(
                      "border-0",
                      editingAssignment.status === 'active' ? "bg-emerald-100 text-emerald-700" :
                      editingAssignment.status === 'draft' ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-700"
                    )}>
                      {editingAssignment.status.charAt(0).toUpperCase() + editingAssignment.status.slice(1)}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto px-6" style={{ minHeight: 0 }}>
              <div className="grid gap-5 py-5">
                {/* Title */}
                <div className="grid gap-2">
                  <Label htmlFor="form-title" className="font-medium">
                    {t('assignment.form.title') || 'Assignment Title'} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="form-title"
                    placeholder="e.g., Addition & Subtraction Practice"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="h-10"
                  />
                </div>

                {/* Description */}
                <div className="grid gap-2">
                  <Label htmlFor="form-desc" className="font-medium">{t('assignment.form.description') || 'Description'}</Label>
                  <Textarea
                    id="form-desc"
                    rows={3}
                    placeholder="Describe what students need to do..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Status & Due Date Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-medium">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v as any })}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t('assignment.status.active')}</SelectItem>
                        <SelectItem value="draft">{t('assignment.status.draft')}</SelectItem>
                        <SelectItem value="closed">{t('assignment.status.closed')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-medium">
                      {t('assignment.form.dueDateTime') || 'Due Date & Time'} <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "flex-1 h-10 justify-start text-left font-normal",
                              !formData.due_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.due_date
                              ? format(new Date(formData.due_date), "PPP")
                              : t('assignment.form.pickDate') || "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[100]" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.due_date ? new Date(formData.due_date) : undefined}
                            onSelect={(date) =>
                              setFormData({ ...formData, due_date: date ? date.toISOString() : "" })
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <div className="relative">
                        <Timer className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="time"
                          value={formData.due_time}
                          onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                          className="h-10 w-[130px] pl-8"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subject & Grade Level Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="font-medium">
                      <BookOpen className="h-4 w-4 inline mr-1" />
                      {t('assignment.form.subject') || 'Subject'}
                    </Label>
                    <Input
                      placeholder="e.g., Mathematics, Algebra, Geometry"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-medium">
                      {t('assignment.form.gradeLevel') || 'Grade Level'}
                    </Label>
                    <Input
                      placeholder="e.g., Grade 5, Primary"
                      value={formData.grade_level}
                      onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Max Score */}
                <div className="grid gap-2">
                  <Label htmlFor="form-score" className="font-medium">{t('assignment.form.maxScore') || 'Max Score'} ({t('assignment.form.optional') || 'optional'})</Label>
                  <Input
                    id="form-score"
                    type="number"
                    min="0"
                    placeholder="e.g., 100"
                    value={formData.max_score}
                    onChange={(e) => setFormData({ ...formData, max_score: e.target.value })}
                    className="h-10"
                  />
                </div>

                {/* Instructions */}
                <div className="grid gap-2">
                  <Label htmlFor="form-instructions" className="font-medium">{t('assignment.form.instructions') || 'Instructions'} ({t('assignment.form.optional') || 'optional'})</Label>
                  <Textarea
                    id="form-instructions"
                    rows={2}
                    placeholder="Any additional instructions for students..."
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  />
                </div>

                {/* File Attachment */}
                <div className="grid gap-2">
                  <Label className="font-medium flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Attachment (optional)
                  </Label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('assignment-file')?.click()}
                      className="w-full sm:w-auto"
                    >
                      <Paperclip className="mr-2 h-4 w-4" />
                      {selectedFile ? 'Change File' : 'Attach File'}
                    </Button>
                    <input
                      id="assignment-file"
                      type="file"
                      className="hidden"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                    {selectedFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
                        <FileText className="h-4 w-4" />
                        <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-1 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setSelectedFile(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {!selectedFile && editingAssignment?.attachment_url && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
                        <FileText className="h-4 w-4" />
                        <a href={editingAssignment.attachment_url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[200px]">
                          Current Attachment
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Student Selection */}
                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {editingAssignment ? 'Manage Assigned Students' : 'Assign to Students'}
                      <Badge variant="secondary" className="text-xs ml-1">
                        {formData.selectedStudentIds.length}/{students.length}
                      </Badge>
                    </Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={selectAllStudents}>
                        {t('assignment.form.selectAll') || 'Select All'}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={deselectAllStudents}>
                        {t('assignment.form.clear') || 'Clear'}
                      </Button>
                    </div>
                  </div>

                  {students.length === 0 ? (
                    <div className="text-center py-6 border rounded-md bg-muted/30">
                      <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No students found. Add students first in Student Accounts.
                      </p>
                    </div>
                  ) : (
                    <>
                      <Input
                        placeholder="Search students by name..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="h-9"
                      />
                      <div className="max-h-[200px] overflow-y-auto border rounded-md">
                        <div className="p-2 space-y-1">
                          {students
                            .filter((s) =>
                              s.full_name.toLowerCase().includes(studentSearch.toLowerCase())
                            )
                            .map((s) => (
                              <label
                                key={s.id}
                                className={cn(
                                  "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                                  formData.selectedStudentIds.includes(s.id)
                                    ? "bg-primary/10"
                                    : "hover:bg-muted"
                                )}
                              >
                                <Checkbox
                                  checked={formData.selectedStudentIds.includes(s.id)}
                                  onCheckedChange={() => toggleStudentSelection(s.id)}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{s.full_name}</p>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    {s.student_code && (
                                      <code className="font-mono text-primary/70">{s.student_code}</code>
                                    )}
                                    {s.student_code && <span>·</span>}
                                    {s.class_name || s.grade_level}
                                  </p>
                                </div>
                              </label>
                            ))}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        {formData.selectedStudentIds.length} of {students.length} students selected
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="px-6 py-4 border-t bg-gradient-to-r from-muted/50 to-muted/20 shrink-0 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground hidden sm:block">
                {formData.selectedStudentIds.length > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {formData.selectedStudentIds.length} student{formData.selectedStudentIds.length !== 1 ? 's' : ''} will receive this
                  </span>
                ) : (
                  <span className="text-amber-600">Select at least one student</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setFormOpen(false)} disabled={actionLoading}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={actionLoading || !formData.title || !formData.due_date || formData.selectedStudentIds.length === 0}
                  className="shadow-md min-w-[140px]"
                >
                  {actionLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('assignment.form.saving') || 'Saving...'}</>
                  ) : editingAssignment ? (
                    <><CheckCircle2 className="mr-2 h-4 w-4" /> {t('assignment.form.saveChanges') || 'Save Changes'}</>
                  ) : (
                    <><Send className="mr-2 h-4 w-4" /> {t('assignment.form.createAndAssign') || 'Create & Assign'}</>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── View Details Dialog ───────────────────── */}
        <Dialog open={!!viewTarget} onOpenChange={() => setViewTarget(null)}>
          {viewTarget && (
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0 border-0">
              {/* Hero Header */}
              <div className={cn(
                "px-6 pt-6 pb-5 shrink-0 relative overflow-hidden",
                viewTarget.status === 'closed' ? "bg-gradient-to-br from-gray-500 to-gray-600"
                  : viewTarget.status === 'draft' ? "bg-gradient-to-br from-amber-500 to-orange-600"
                  : "bg-gradient-to-br from-primary to-primary/80"
              )}>
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-10 -translate-x-10" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="text-xl sm:text-2xl font-bold text-white leading-tight flex items-center gap-2 flex-wrap">
                        {viewTarget.title}
                        {getStatusBadge(viewTarget.status)}
                      </DialogTitle>
                      <DialogDescription className="mt-2 text-white/70 text-sm">
                        Created on {format(new Date(viewTarget.created_at), "MMMM d, yyyy")}
                      </DialogDescription>
                    </div>
                    {viewTarget.submissionCount > 0 && (
                      <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3.5 py-2 text-center border border-white/10 shrink-0">
                        <p className="text-lg font-bold text-white">{viewTarget.submissionCount}</p>
                        <p className="text-[10px] text-white/60 uppercase">Submitted</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
                <div className="space-y-4 p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl p-3 text-center border border-blue-100 dark:border-blue-900">
                      <GraduationCap className="h-4 w-4 text-blue-500 mx-auto mb-0.5" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Grade</p>
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{viewTarget.grade_level}</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950 dark:to-violet-950 rounded-xl p-3 text-center border border-purple-100 dark:border-purple-900">
                      <FileText className="h-4 w-4 text-purple-500 mx-auto mb-0.5" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Subject</p>
                      <p className="text-sm font-bold text-purple-700 dark:text-purple-300">{viewTarget.subject}</p>
                    </div>
                    <div className={cn(
                      "rounded-xl p-3 text-center border",
                      isPast(new Date(viewTarget.due_date))
                        ? "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950 border-red-100 dark:border-red-900"
                        : "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 border-emerald-100 dark:border-emerald-900"
                    )}>
                      <Clock className={cn("h-4 w-4 mx-auto mb-0.5", isPast(new Date(viewTarget.due_date)) ? "text-red-500" : "text-emerald-500")} />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Due</p>
                      <p className={cn("text-sm font-bold", isPast(new Date(viewTarget.due_date)) ? "text-red-600" : "text-emerald-600")}>
                        {format(new Date(viewTarget.due_date), "MMM d")}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 rounded-xl p-3 text-center border border-amber-100 dark:border-amber-900">
                      <Target className="h-4 w-4 text-amber-500 mx-auto mb-0.5" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Max Score</p>
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{viewTarget.max_score || "—"}</p>
                    </div>
                    <div className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950 rounded-xl p-3 text-center border border-cyan-100 dark:border-cyan-900">
                      <Users className="h-4 w-4 text-cyan-500 mx-auto mb-0.5" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Students</p>
                      <p className="text-sm font-bold text-cyan-700 dark:text-cyan-300">{viewTarget.assignedStudentIds.length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950 rounded-xl p-3 text-center border border-emerald-100 dark:border-emerald-900">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto mb-0.5" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Submitted</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{viewTarget.submissionCount}</p>
                    </div>
                  </div>

                  {viewTarget.description && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" /> Description
                      </h3>
                      <div className="bg-muted/30 rounded-xl p-4 border">
                        <p className="text-sm whitespace-pre-line leading-relaxed text-foreground/80">{viewTarget.description}</p>
                      </div>
                    </div>
                  )}

                  {viewTarget.instructions && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> Instructions
                      </h3>
                      <div className="bg-gradient-to-r from-primary/5 to-primary/10 border-l-4 border-primary rounded-r-xl p-4">
                        <p className="text-sm whitespace-pre-line leading-relaxed">{viewTarget.instructions}</p>
                      </div>
                    </div>
                  )}

                  {/* Attachment Preview */}
                  {viewTarget.attachment_url && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-muted-foreground" /> Attachment
                      </h3>
                      <div className="border rounded-xl overflow-hidden bg-muted/20">
                        {/\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i.test(viewTarget.attachment_url) ? (
                          <div className="p-4">
                            <div className="relative group rounded-lg overflow-hidden border bg-white dark:bg-black/20">
                              <img
                                src={viewTarget.attachment_url}
                                alt="Assignment attachment"
                                className="w-full max-h-60 object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="secondary" size="sm" asChild className="shadow-lg">
                                    <a href={viewTarget.attachment_url} target="_blank" rel="noopener noreferrer">
                                      <ExternalLink className="mr-1.5 h-3 w-3" /> Open Full Size
                                    </a>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 flex items-center gap-4">
                            <div className="bg-primary/10 rounded-xl p-3 shrink-0">
                              <FileText className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold">Attached File</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Click to view or download</p>
                            </div>
                            <Button variant="outline" size="sm" asChild>
                              <a href={viewTarget.attachment_url} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-1.5 h-3 w-3" /> Download
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {viewTarget.assignedStudentIds.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" /> Assigned Students
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {viewTarget.assignedStudentIds.map((id) => (
                          <Badge key={id} variant="secondary" className="text-xs">{getStudentName(id)}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t bg-muted/30 shrink-0 flex items-center justify-end gap-2 flex-wrap">
                <Button variant="outline" onClick={() => setViewTarget(null)}>Close</Button>
                <Button variant="outline" onClick={() => { setViewTarget(null); openGradingDialog(viewTarget); }}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Submissions ({viewTarget.submissionCount})
                </Button>
                <Button onClick={() => { setViewTarget(null); openEditForm(viewTarget); }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </DialogContent>
          )}
        </Dialog>

        {/* ── Delete Confirmation ───────────────────── */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('assignment.delete.title') || 'Delete Assignment'}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('assignment.delete.confirm') || 'Are you sure you want to delete'} <strong>"{deleteTarget?.title}"</strong>? {t('assignment.delete.warning') || 'This will also remove all student links and submissions. This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={actionLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('assignment.delete.action') || 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Bulk Delete Confirm Dialog ─────────── */}
        <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('assignment.bulk.deleteTitle') || 'Delete Selected Assignments'}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('assignment.bulk.deleteWarning') || 'Are you sure you want to delete'} <strong>{selectedAssignmentIds.size}</strong> {t('assignment.bulk.assignments') || 'assignment(s)'}? {t('assignment.delete.warning') || 'This action cannot be undone.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actionLoading}>{t('common.cancel') || 'Cancel'}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                disabled={actionLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('assignment.bulk.confirmDelete') || 'Delete All'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Deadline Extension Dialog ─────────── */}
        <Dialog open={!!extensionAssignment} onOpenChange={(open) => { if (!open) { setExtensionAssignment(null); setExtensionStudentId(""); setExtensionDate(""); setExtensionTime("23:59"); } }}>
          {extensionAssignment && (
            <DialogContent className="sm:max-w-[450px]">
              <DialogTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5" />
                {t('assignment.extension.title') || 'Grant Deadline Extension'}
              </DialogTitle>
              <DialogDescription>
                {t('assignment.extension.desc') || 'Extend the deadline for a specific student on'} "{extensionAssignment.title}"
              </DialogDescription>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>{t('assignment.extension.student') || 'Student'}</Label>
                  <Select value={extensionStudentId} onValueChange={setExtensionStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('assignment.extension.selectStudent') || 'Select a student'} />
                    </SelectTrigger>
                    <SelectContent>
                      {extensionAssignment.assignedStudentIds.map((sid) => (
                        <SelectItem key={sid} value={sid}>{getStudentName(sid)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-2">
                    <Label>{t('assignment.extension.newDate') || 'New Due Date'}</Label>
                    <Input
                      type="date"
                      value={extensionDate}
                      onChange={(e) => setExtensionDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t('assignment.form.time') || 'Time'}</Label>
                    <Input
                      type="time"
                      value={extensionTime}
                      onChange={(e) => setExtensionTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setExtensionAssignment(null)}>{t('common.cancel') || 'Cancel'}</Button>
                <Button onClick={handleGrantExtension} disabled={!extensionStudentId || !extensionDate || actionLoading}>
                  {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('assignment.extension.grant') || 'Grant Extension'}
                </Button>
              </div>
            </DialogContent>
          )}
        </Dialog>

        {/* ── Discussion Dialog ─────────── */}
        <Dialog open={!!discussionAssignment} onOpenChange={(open) => { if (!open) setDiscussionAssignment(null); }}>
          {discussionAssignment && (
            <DialogContent className="sm:max-w-[780px] max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0 border-0">
              <div className="px-6 pt-6 pb-5 shrink-0 relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-10 -translate-x-10" />
                <div className="relative z-10">
                  <DialogTitle className="text-xl sm:text-2xl font-bold text-white leading-tight flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Discussion: {discussionAssignment.title}
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-white/70 text-sm">
                    Chat with students about this assignment
                  </DialogDescription>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto bg-muted/10" style={{ minHeight: '500px' }}>
                <AssignmentComments 
                  assignmentId={discussionAssignment.id}
                  currentUserId={user?.id || ""}
                  currentUserRole="teacher"
                  currentUserName={profile?.full_name || "Teacher"}
                />
              </div>
            </DialogContent>
          )}
        </Dialog>

        {/* ── Grading / Submissions Dialog ─────────── */}
        <Dialog open={!!gradingAssignment} onOpenChange={(open) => { if (!open) { setGradingAssignment(null); setGradingSubmission(null); setBatchGradingProgress(null); } }}>
          {gradingAssignment && (() => {
            const totalStudents = gradingAssignment.assignedStudentIds.length;
            const gradedCount = submissions.filter(s => s.status === 'graded').length;
            const aiReviewedCount = submissions.filter(s => s.ai_graded_at).length;
            const pendingCount = submissions.filter(s => s.status !== 'graded').length;
            const gradingPercent = submissions.length > 0 ? Math.round((gradedCount / submissions.length) * 100) : 0;
            const isImageFile = (url: string) => /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i.test(url);
            
            // Students who haven't submitted
            const submittedStudentIds = new Set(submissions.map(s => s.student_id));
            const missingStudents = students.filter(
              s => gradingAssignment.assignedStudentIds.includes(s.id) && !submittedStudentIds.has(s.id)
            );
            
            // AI grading score breakdown
            const aiGradedSubmissions = submissions.filter(s => s.ai_score !== null && s.ai_score !== undefined);
            const avgAiScore = aiGradedSubmissions.length > 0 
              ? Math.round(aiGradedSubmissions.reduce((sum, s) => sum + (s.ai_score || 0), 0) / aiGradedSubmissions.length)
              : null;
            const highScoreCount = aiGradedSubmissions.filter(s => (s.ai_score || 0) >= 80).length;
            const midScoreCount = aiGradedSubmissions.filter(s => (s.ai_score || 0) >= 60 && (s.ai_score || 0) < 80).length;
            const lowScoreCount = aiGradedSubmissions.filter(s => (s.ai_score || 0) < 60).length;

            return (
            <DialogContent className="sm:max-w-[780px] max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0 border-0">
              {/* ── Hero Header ── */}
              <div className="px-6 pt-6 pb-5 shrink-0 relative overflow-hidden bg-primary text-primary-foreground">
                {/* Decorative shapes */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-10 -translate-x-10" />

                <div className="relative z-10">
                  <DialogTitle className="text-xl sm:text-2xl font-bold text-primary-foreground leading-tight flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    {gradingAssignment.title}
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-primary-foreground/70 text-sm">
                    Student submissions and grading
                  </DialogDescription>

                  {/* Stats row */}
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 text-center border border-white/10">
                      <p className="text-lg font-bold text-primary-foreground">{submissions.length}</p>
                      <p className="text-[10px] text-primary-foreground/60 uppercase tracking-wider">Received</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 text-center border border-white/10">
                      <p className="text-lg font-bold text-primary-foreground">{gradedCount}</p>
                      <p className="text-[10px] text-primary-foreground/60 uppercase tracking-wider">Graded</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 text-center border border-white/10">
                      <p className="text-lg font-bold text-primary-foreground">{aiReviewedCount}</p>
                      <p className="text-[10px] text-primary-foreground/60 uppercase tracking-wider">AI Reviewed</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 text-center border border-white/10">
                      <p className="text-lg font-bold text-primary-foreground">{pendingCount}</p>
                      <p className="text-[10px] text-primary-foreground/60 uppercase tracking-wider">Pending</p>
                    </div>
                  </div>

                  {/* Grading progress bar */}
                  {submissions.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-primary-foreground/50 uppercase tracking-wider">Grading Progress</span>
                        <span className="text-xs text-primary-foreground/70 font-medium">{gradingPercent}%</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-white/80 rounded-full transition-all duration-500" style={{ width: `${gradingPercent}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Batch AI grading progress */}
              {batchGradingProgress && (
                <div className="mx-6 mt-3 p-3 bg-primary/5 rounded-lg border border-primary/20 shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4 text-primary animate-pulse" />
                    <p className="text-sm font-medium text-primary">
                      AI Grading in progress... ({batchGradingProgress.current}/{batchGradingProgress.total})
                    </p>
                  </div>
                  {batchGradingProgress.name && (
                    <p className="text-xs text-muted-foreground">Currently reviewing: {batchGradingProgress.name}</p>
                  )}
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${(batchGradingProgress.current / batchGradingProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* AI Grading Summary Panel */}
              {aiGradedSubmissions.length > 0 && !batchGradingProgress && (
                <div className="mx-6 mt-3 p-3 bg-muted/40 rounded-lg border border-border shrink-0">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">AI Grading Summary</p>
                        <p className="text-[10px] text-muted-foreground">
                          {aiGradedSubmissions.length} submission{aiGradedSubmissions.length !== 1 ? 's' : ''} analyzed
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Score distribution mini chart */}
                      <div className="flex items-center gap-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-0.5">
                              <div className="w-3 h-6 bg-primary rounded-sm" style={{ height: `${Math.max(8, highScoreCount * 8)}px` }} />
                              <span className="text-[10px] text-primary font-medium">{highScoreCount}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>80%+ (High Scorers)</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-0.5">
                              <div className="w-3 bg-primary/60 rounded-sm" style={{ height: `${Math.max(8, midScoreCount * 8)}px` }} />
                              <span className="text-[10px] text-primary/80 font-medium">{midScoreCount}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>60-79% (Average)</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-0.5">
                              <div className="w-3 bg-destructive/60 rounded-sm" style={{ height: `${Math.max(8, lowScoreCount * 8)}px` }} />
                              <span className="text-[10px] text-destructive font-medium">{lowScoreCount}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Below 60% (Needs Help)</TooltipContent>
                        </Tooltip>
                      </div>
                      {/* Avg score */}
                      {avgAiScore !== null && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-background rounded-full border border-border">
                          <Trophy className="h-3 w-3 text-primary" />
                          <span className="text-xs font-bold text-foreground">Avg: {avgAiScore}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Missing Students Alert */}
              {missingStudents.length > 0 && !gradingLoading && (
                <div className="mx-6 mt-3 shrink-0">
                  <details className="group">
                    <summary className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/50 rounded-lg border border-orange-200 dark:border-orange-800 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-950/70 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                          <AlertTriangle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">
                            {missingStudents.length} student{missingStudents.length !== 1 ? 's' : ''} haven't submitted
                          </p>
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-orange-500 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mt-2 p-3 bg-orange-50/50 dark:bg-orange-950/30 rounded-lg border border-orange-100 dark:border-orange-900 space-y-1.5">
                      {missingStudents.slice(0, 10).map(st => (
                        <div key={st.id} className="flex items-center gap-2 text-sm">
                          <div className="w-6 h-6 rounded-full bg-orange-200 dark:bg-orange-800 flex items-center justify-center text-[10px] font-bold text-orange-700 dark:text-orange-300">
                            {st.full_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-orange-800 dark:text-orange-200">{st.full_name}</span>
                          {st.student_code && (
                            <code className="text-[10px] font-mono bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 px-1 py-0.5 rounded">{st.student_code}</code>
                          )}
                        </div>
                      ))}
                      {missingStudents.length > 10 && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                          +{missingStudents.length - 10} more students...
                        </p>
                      )}
                    </div>
                  </details>
                </div>
              )}

              <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
                {gradingLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Loading submissions...</p>
                    </div>
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="text-center py-16 px-6">
                    <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                    <h4 className="font-semibold text-base mb-1">No Submissions Yet</h4>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                      {totalStudents} student{totalStudents !== 1 ? "s" : ""} assigned — waiting for them to submit their work.
                    </p>
                    {/* Show missing students when no submissions */}
                    {missingStudents.length > 0 && (
                      <div className="mt-4 text-left max-w-sm mx-auto">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Assigned students:</p>
                        <div className="flex flex-wrap gap-1">
                          {missingStudents.slice(0, 6).map(st => (
                            <Badge key={st.id} variant="outline" className="text-xs">
                              {st.full_name}
                            </Badge>
                          ))}
                          {missingStudents.length > 6 && (
                            <Badge variant="secondary" className="text-xs">
                              +{missingStudents.length - 6} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 p-6">
                    {submissions.map((sub, idx) => {
                      const isAiGradingThis = singleAiGrading === sub.id;
                      const scoreToShow = sub.status === 'graded' ? sub.score : sub.ai_score;
                      const maxScore = gradingAssignment.max_score || 100;
                      const scorePercentValue = scoreToShow !== null && scoreToShow !== undefined
                        ? Math.round((scoreToShow / maxScore) * 100) : null;
                      const scoreColor = scoreToShow !== null && scoreToShow !== undefined
                        ? scoreToShow >= 80 ? 'emerald' : scoreToShow >= 60 ? 'amber' : 'red'
                        : 'blue';

                      return (
                        <Card key={sub.id} className={cn(
                          "overflow-hidden transition-all hover:shadow-md border-0 ring-1",
                          sub.status === 'graded'
                            ? 'ring-emerald-200 dark:ring-emerald-800'
                            : sub.ai_graded_at
                              ? 'ring-violet-200 dark:ring-violet-800'
                              : 'ring-border'
                        )}>
                          {/* Student header with gradient accent */}
                          <div className={cn(
                            "px-4 py-3 flex items-center gap-3 border-b",
                            sub.status === 'graded'
                              ? "bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-emerald-950/30"
                              : sub.ai_graded_at
                                ? "bg-gradient-to-r from-violet-50/80 to-transparent dark:from-violet-950/30"
                                : "bg-gradient-to-r from-muted/50 to-transparent"
                          )}>
                            {/* Avatar */}
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ring-2 ring-white dark:ring-gray-900",
                              scoreToShow !== null && scoreToShow !== undefined
                                ? `bg-${scoreColor}-100 text-${scoreColor}-700`
                                : "bg-blue-100 text-blue-700"
                            )}>
                              {sub.student_name ? sub.student_name.charAt(0).toUpperCase() : <UserIcon className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm">{sub.student_name}</p>
                                {sub.student_code && (
                                  <code className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{sub.student_code}</code>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Submitted {format(new Date(sub.submitted_at), 'MMM d, yyyy · h:mm a')}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {sub.status === 'graded' ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                                  <CheckCircle2 className="mr-1 h-3 w-3" /> {sub.score !== null ? `${sub.score}/${maxScore}` : 'Graded'}
                                </Badge>
                              ) : sub.ai_graded_at ? (
                                <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">
                                  <Sparkles className="mr-1 h-3 w-3" /> AI: {sub.ai_score ?? '—'}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="mr-1 h-3 w-3" /> Pending
                                </Badge>
                              )}
                            </div>
                          </div>

                          <CardContent className="p-4 space-y-3">
                            {/* File preview */}
                            {sub.file_url && (
                              <div className="rounded-lg overflow-hidden border bg-muted/20">
                                {isImageFile(sub.file_url) ? (
                                  <div className="relative group">
                                    <img
                                      src={sub.file_url}
                                      alt={`${sub.student_name}'s submission`}
                                      className="w-full max-h-48 object-contain bg-white dark:bg-black/20"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="secondary" size="sm" asChild className="shadow-lg">
                                          <a href={sub.file_url} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="mr-1 h-3 w-3" /> Open Full Size
                                          </a>
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-3 flex items-center gap-3">
                                    <div className="bg-primary/10 rounded-lg p-2.5 shrink-0">
                                      <FileText className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium">Submitted File</p>
                                      <p className="text-xs text-muted-foreground">Click to view or download</p>
                                    </div>
                                    <Button variant="outline" size="sm" asChild>
                                      <a href={sub.file_url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="mr-1 h-3 w-3" /> View
                                      </a>
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Student notes */}
                            {sub.notes && (
                              <div className="bg-gradient-to-r from-muted/50 to-transparent border-l-3 border-muted-foreground/20 rounded-r-lg p-3">
                                <p className="text-xs font-medium text-muted-foreground mb-0.5 flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" /> Student's Note
                                </p>
                                <p className="text-sm italic text-foreground/80">"{sub.notes}"</p>
                              </div>
                            )}

                            {/* AI Feedback section */}
                            {sub.ai_graded_at && sub.ai_feedback && (() => {
                              const sections = parseAiFeedback(sub.ai_feedback);
                              const pct = sub.ai_score !== null ? Math.round((sub.ai_score / maxScore) * 100) : null;
                              const pctColor = pct === null ? '' : pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-red-500';
                              return (
                                <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50/80 to-purple-50/40 dark:from-violet-950/40 dark:to-purple-950/20 p-3 space-y-2">
                                  {/* Header row */}
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                                      <Brain className="h-3.5 w-3.5" /> AI Analysis
                                    </p>
                                    {sub.ai_score !== null && (
                                      <div className="flex items-center gap-1.5">
                                        <span className={`text-sm font-bold ${pctColor}`}>{pct}%</span>
                                        <span className="text-xs text-muted-foreground">({sub.ai_score}/{maxScore})</span>
                                      </div>
                                    )}
                                  </div>
                                  {/* Sections */}
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {sections.analysis && (
                                      <div className="col-span-2 bg-blue-50 dark:bg-blue-950/30 rounded-md p-2 border border-blue-100 dark:border-blue-900">
                                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-0.5">Analysis</p>
                                        <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">{sections.analysis}</p>
                                      </div>
                                    )}
                                    {sections.error_type && (
                                      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-md p-2 border border-amber-100 dark:border-amber-900">
                                        <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-0.5">Error Type</p>
                                        <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">{sections.error_type}</p>
                                      </div>
                                    )}
                                    {sections.remediation && (
                                      <div className="bg-purple-50 dark:bg-purple-950/30 rounded-md p-2 border border-purple-100 dark:border-purple-900">
                                        <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-0.5">Remediation</p>
                                        <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">{sections.remediation}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Teacher feedback (if already graded) */}
                            {sub.teacher_feedback && (
                              <div className="bg-gradient-to-r from-primary/5 to-primary/10 border-l-4 border-primary rounded-r-lg p-3">
                                <p className="text-xs font-semibold text-primary mb-0.5">Your Feedback:</p>
                                <p className="text-xs text-foreground/80">{sub.teacher_feedback}</p>
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 flex-wrap pt-1">
                              {sub.file_url && !sub.ai_graded_at && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1 border-violet-300 text-violet-700 hover:bg-violet-50"
                                  onClick={() => handleSingleAiGrade(sub)}
                                  disabled={isAiGradingThis || !!batchGradingProgress}
                                >
                                  {isAiGradingThis ? (
                                    <><Loader2 className="h-3 w-3 animate-spin" /> {t('assignment.grading.analyzing') || 'Analyzing...'}</>
                                  ) : (
                                    <><Brain className="h-3 w-3" /> {t('assignment.action.aiGrade') || 'AI Grade'}</>
                                  )}
                                </Button>
                              )}
                              {sub.file_url && sub.ai_graded_at && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1 text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                                  onClick={() => handleRegradeAi(sub)}
                                  disabled={isAiGradingThis || !!batchGradingProgress}
                                >
                                  {isAiGradingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                  {t('assignment.action.regrade') || 'Re-grade'}
                                </Button>
                              )}
                              {/* Return to Student */}
                              {sub.status === 'submitted' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                                  onClick={() => handleReturnSubmission(sub.id, sub.student_id)}
                                >
                                  <Undo2 className="h-3 w-3" /> {t('assignment.action.return') || 'Return'}
                                </Button>
                              )}
                              {/* Allow Resubmission (after grading) */}
                              {sub.status === 'graded' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                                  onClick={() => handleAllowResubmission(sub.id, sub.student_id)}
                                >
                                  <RotateCcw className="h-3 w-3" /> {t('assignment.action.allowResubmit') || 'Allow Resubmit'}
                                </Button>
                              )}
                              {/* Status badge for returned */}
                              {sub.status === 'returned' && (
                                <Badge variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 bg-amber-50">
                                  <Undo2 className="h-3 w-3 mr-1" /> {t('assignment.grading.returned') || 'Returned'}
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                className={cn(
                                  "h-7 text-xs gap-1 ml-auto",
                                  sub.status === 'graded'
                                    ? ""
                                    : "shadow-sm"
                                )}
                                variant={sub.status === 'graded' ? 'outline' : 'default'}
                                onClick={() => openGradeForm(sub)}
                              >
                                {sub.status === 'graded' ? (
                                  <><Edit className="h-3 w-3" /> {t('assignment.grading.updateGrade') || 'Update Grade'}</>
                                ) : (
                                  <><Star className="h-3 w-3" /> {t('assignment.grading.gradeAndSend') || 'Grade & Send'}</>
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t bg-muted/30 shrink-0 flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-muted-foreground">
                  {submissions.length} / {totalStudents} {t('assignment.card.submitted') || 'submitted'}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setExtensionAssignment(gradingAssignment)}
                  >
                    <Timer className="h-4 w-4" /> {t('assignment.extension.title') || 'Extend Deadline'}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-violet-300 text-violet-700 hover:bg-violet-50 gap-1.5"
                    onClick={handleBatchAiGrade}
                    disabled={!!batchGradingProgress || gradingLoading || submissions.filter(s => !s.ai_graded_at && s.file_url).length === 0}
                  >
                    {batchGradingProgress ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> {t('assignment.grading.analyzing') || 'Grading...'}</>
                    ) : (
                      <><Brain className="h-4 w-4" /> {t('assignment.action.batchAiGrade') || 'AI Grade All'} ({submissions.filter(s => !s.ai_graded_at && s.file_url).length})</>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => { setGradingAssignment(null); setGradingSubmission(null); }}>{t('common.close') || 'Close'}</Button>
                </div>
              </div>
            </DialogContent>
            );
          })()}
        </Dialog>

        {/* ── Grade Submission Dialog ───────────────── */}
        <Dialog open={!!gradingSubmission} onOpenChange={(open) => { if (!open) setGradingSubmission(null); }}>
          {gradingSubmission && (() => {
            const subMeta = submissions.find(s => s.id === gradingSubmission.id);
            const studentName = subMeta?.student_name || 'Student';
            const studentCode = subMeta?.student_code;
            const maxScore = gradingAssignment?.max_score || 100;
            const isImageFile = (url: string) => /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i.test(url);
            const hasAiReview = !!(gradingSubmission.ai_graded_at && gradingSubmission.ai_feedback);

            return (
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0 border-0">
              {/* ── Header ── */}
              <div className="px-6 pt-5 pb-4 shrink-0 relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
                <div className="relative z-10">
                  <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Star className="h-5 w-5" /> Grade Submission
                  </DialogTitle>
                  <DialogDescription className="mt-1.5 flex items-center gap-2 text-white/80">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {studentName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium">{studentName}</span>
                    {studentCode && (
                      <code className="text-[10px] font-mono bg-white/20 text-white px-1.5 py-0.5 rounded-full">{studentCode}</code>
                    )}
                    {gradingAssignment?.max_score && (
                      <span className="ml-auto text-xs bg-white/15 px-2 py-1 rounded-full border border-white/20">
                        Max: {gradingAssignment.max_score} pts
                      </span>
                    )}
                  </DialogDescription>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
                <div className="space-y-4 p-6">
                  {/* File preview */}
                  {gradingSubmission.file_url && (
                    <div className="rounded-xl overflow-hidden border bg-muted/20">
                      {isImageFile(gradingSubmission.file_url) ? (
                        <div className="relative group">
                          <img
                            src={gradingSubmission.file_url}
                            alt="Student submission"
                            className="w-full max-h-56 object-contain bg-white dark:bg-black/20"
                          />
                          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="secondary" size="sm" asChild className="shadow-md">
                              <a href={gradingSubmission.file_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-1 h-3 w-3" /> Full Size
                              </a>
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 flex items-center gap-3">
                          <div className="bg-primary/10 rounded-lg p-2.5 shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Student's Submitted File</p>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a href={gradingSubmission.file_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1 h-3 w-3" /> View
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Student notes */}
                  {gradingSubmission.notes && (
                    <div className="bg-gradient-to-r from-muted/50 to-transparent border-l-3 border-muted-foreground/20 rounded-r-lg p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Student's Note:</p>
                      <p className="text-sm italic text-foreground/80">"{gradingSubmission.notes}"</p>
                    </div>
                  )}

                  {/* AI analysis (if available) */}
                  {hasAiReview && (() => {
                    const sections = parseAiFeedback(gradingSubmission.ai_feedback!);
                    const pct = gradingSubmission.ai_score !== null && gradingSubmission.ai_score !== undefined
                      ? Math.round((gradingSubmission.ai_score / maxScore) * 100) : null;
                    const pctColor = pct === null ? 'text-muted-foreground' : pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-500' : 'text-red-500';
                    const barColor = pct === null ? 'bg-violet-500' : pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
                    return (
                      <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50/80 to-purple-50/40 dark:from-violet-950/40 dark:to-purple-950/20 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-violet-100 dark:border-violet-800">
                          <p className="text-xs font-bold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                            <Brain className="h-3.5 w-3.5" /> AI Report
                          </p>
                          {pct !== null && (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 bg-violet-200 dark:bg-violet-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className={`text-sm font-extrabold ${pctColor}`}>{pct}%</span>
                              <span className="text-xs text-muted-foreground">({gradingSubmission.ai_score}/{maxScore})</span>
                            </div>
                          )}
                        </div>
                        {/* 4 section grid */}
                        <div className="p-3 grid grid-cols-2 gap-2">
                          {sections.analysis && (
                            <div className="col-span-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 p-3">
                              <p className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">📋 Analysis</p>
                              <p className="text-xs text-foreground/85 leading-relaxed">{sections.analysis}</p>
                            </div>
                          )}
                          {sections.error_type && (
                            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 p-3">
                              <p className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">⚠️ Error Type</p>
                              <p className="text-xs text-foreground/85 leading-relaxed">{sections.error_type}</p>
                            </div>
                          )}
                          {sections.remediation && (
                            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900 p-3">
                              <p className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">🛠️ Remediation</p>
                              <p className="text-xs text-foreground/85 leading-relaxed">{sections.remediation}</p>
                            </div>
                          )}
                        </div>
                        {/* Quick apply */}
                        {gradingSubmission.ai_score !== null && gradingSubmission.ai_score !== undefined && gradeScore !== gradingSubmission.ai_score.toString() && (
                          <div className="px-3 pb-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-8 text-xs gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-100"
                              onClick={() => {
                                setGradeScore(gradingSubmission.ai_score!.toString());
                                if (gradingSubmission.ai_feedback && !gradeFeedback) setGradeFeedback(gradingSubmission.ai_feedback);
                              }}
                            >
                              <Sparkles className="h-3 w-3" /> Use AI Score — {gradingSubmission.ai_score} pts ({pct}%)
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <Separator />

                  {/* Score input */}
                  <div className="space-y-2">
                    <Label htmlFor="grade-score" className="font-semibold text-sm flex items-center gap-2">
                      <Target className="h-4 w-4 text-amber-500" />
                      Your Score
                      <span className="text-xs font-normal text-muted-foreground ml-auto">
                        out of {maxScore}
                      </span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="grade-score"
                        type="number"
                        min="0"
                        max={maxScore}
                        value={gradeScore}
                        onChange={(e) => setGradeScore(e.target.value)}
                        placeholder="e.g., 85"
                        className="text-lg font-semibold h-12 pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        / {maxScore}
                      </span>
                    </div>
                    {/* Score preview bar */}
                    {gradeScore && (
                      <div className="space-y-1">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={cn(
                            "h-full rounded-full transition-all duration-300",
                            Number(gradeScore) >= 80 ? "bg-emerald-500" :
                            Number(gradeScore) >= 60 ? "bg-amber-500" : "bg-red-500"
                          )} style={{ width: `${Math.min(100, (Number(gradeScore) / maxScore) * 100)}%` }} />
                        </div>
                        <p className={cn("text-xs font-medium",
                          Number(gradeScore) >= 80 ? "text-emerald-600" :
                          Number(gradeScore) >= 60 ? "text-amber-600" : "text-red-600"
                        )}>
                          {Math.round((Number(gradeScore) / maxScore) * 100)}%
                          {Number(gradeScore) >= 80 ? " — Excellent" : Number(gradeScore) >= 60 ? " — Good" : " — Needs Improvement"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Feedback */}
                  <div className="space-y-2">
                    <Label htmlFor="grade-feedback" className="font-semibold text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      Feedback for Student
                    </Label>
                    <p className="text-xs text-muted-foreground">This will be visible to the student on their dashboard.</p>
                    <Textarea
                      id="grade-feedback"
                      rows={4}
                      value={gradeFeedback}
                      onChange={(e) => setGradeFeedback(e.target.value)}
                      placeholder="Great work! Keep practicing multiplication..."
                      className="resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t bg-muted/30 shrink-0 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setGradingSubmission(null)} disabled={actionLoading}>Cancel</Button>
                <Button onClick={handleGradeSubmit} disabled={actionLoading} className="gap-2 shadow-sm">
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Save & Send to Student
                </Button>
              </div>
            </DialogContent>
            );
          })()}
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

// ── Sub-components ─────────────────────────────────────

function StatsCard({
  icon, label, value, color, bgColor,
}: {
  icon: React.ReactNode; label: string; value: number; color: string; bgColor: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("rounded-lg p-2.5 shrink-0", bgColor, color)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}

export default AssignmentManagement;
