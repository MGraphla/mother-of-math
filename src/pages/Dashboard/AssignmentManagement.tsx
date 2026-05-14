import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { isTeacher, PRIMARY_GRADE_LEVELS } from "@/types";
import { format, isPast, isFuture, differenceInDays, isToday, formatDistanceToNow } from "date-fns";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Search, Calendar as CalendarIcon, Plus, ClipboardList, Clock, AlertTriangle,
  CheckCircle2, FileText, Trash2, Edit, Loader2, Users, GraduationCap,
  BarChart3, Eye, Copy, Archive, MessageSquare, Star, Send, Sparkles, Brain,
  ExternalLink, RefreshCw, Download, Paperclip, X, Trophy, Target, ChevronDown,
  User as UserIcon, RotateCcw, Undo2, BookOpen, Timer, ArrowLeft, MoreVertical,
  ChevronRight, Zap, TrendingUp
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Learner, StudentAssignment, AssignmentSubmission,
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
import { sendAssignmentNotificationSms, sendGradedSms, sendResubmitSms } from "@/services/smsNotificationService";
import { resolveSmsDialCountry } from "@/lib/phone";
import { AssignmentComments } from "@/components/AssignmentComments";
import { parseAiFeedback, RubricCriterion, DEFAULT_RUBRIC_CRITERIA } from "@/utils/grading";
import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────

interface AssignmentWithMeta extends StudentAssignment {
  assignedStudentIds: string[];
  submissionCount: number;
}

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
  title: "", description: "", due_date: "", due_time: "23:59",
  grade_level: "", subject: "Mathematics", status: "active",
  max_score: "", instructions: "", selectedStudentIds: [], rubric_criteria: [],
};

type DetailTab = "info" | "submissions" | "discussion";

// ── SVG helpers ────────────────────────────────────────

function CircularProgress({ value, size = 44, stroke = 4, className }: { value: number; size?: number; stroke?: number; className?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className={cn("transform -rotate-90", className)}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted/40" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        className="text-primary transition-all duration-700 ease-out" />
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────

import { LoadingAnimation } from "@/components/ui/LoadingAnimation";

const AssignmentManagement = () => {
  const { user, profile } = useAuth();
  const { t } = useLanguage();

  const [assignments, setAssignments] = useState<AssignmentWithMeta[]>([]);
  const [students, setStudents] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const [selected, setSelected] = useState<AssignmentWithMeta | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("info");

  const [formOpen, setFormOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentWithMeta | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<AssignmentWithMeta | null>(null);

  const [submissions, setSubmissions] = useState<(AssignmentSubmission & { student_name?: string; student_code?: string | null })[]>([]);
  const [gradingSubmission, setGradingSubmission] = useState<AssignmentSubmission | null>(null);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [gradingLoading, setGradingLoading] = useState(false);
  const [batchGradingProgress, setBatchGradingProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [singleAiGrading, setSingleAiGrading] = useState<string | null>(null);

  const [teacherStats, setTeacherStats] = useState<AssignmentStats | null>(null);
  const [aiStatus, setAiStatus] = useState<{ available: boolean; model: string } | null>(null);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);

  const [extensionAssignment, setExtensionAssignment] = useState<AssignmentWithMeta | null>(null);
  const [extensionStudentId, setExtensionStudentId] = useState("");
  const [extensionDate, setExtensionDate] = useState("");
  const [extensionTime, setExtensionTime] = useState("23:59");

  // ── Data Fetching ──────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [rawAssignments, rawStudents] = await Promise.all([
        getAssignmentsByTeacher(user.id),
        getStudentsByTeacher(user.id),
      ]);
      const enriched: AssignmentWithMeta[] = await Promise.all(
        rawAssignments.map(async (a) => {
          const [studentIds, subs] = await Promise.all([
            getAssignmentStudents(a.id),
            getSubmissionsForAssignment(a.id),
          ]);
          return { ...a, assignedStudentIds: studentIds, submissionCount: subs.length };
        })
      );
      setAssignments(enriched);
      setStudents(rawStudents);
      if (selected) {
        const updated = enriched.find(a => a.id === selected.id);
        if (updated) setSelected(updated);
      }
    } catch (err) {
      console.error("Error fetching assignment data:", err);
      toast({ title: t('common.error'), description: "Failed to load assignments.", variant: "destructive" });
    } finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchEnhancedStats = useCallback(async () => {
    if (!user?.id) return;
    setIsRefreshingStats(true);
    try {
      const [stats, status] = await Promise.all([getAssignmentStatsForTeacher(user.id), checkAiGradingStatus()]);
      setTeacherStats(stats); setAiStatus(status);
    } catch (err) { console.warn("Error fetching enhanced stats:", err); }
    finally { setIsRefreshingStats(false); }
  }, [user?.id]);

  useEffect(() => { fetchEnhancedStats(); }, [fetchEnhancedStats]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('assignment-submissions-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'assignment_submissions' }, (payload) => {
        const newSub = payload.new as any;
        const match = assignments.find(a => a.id === newSub.assignment_id);
        if (match) {
          toast({ title: 'New Submission', description: `A student submitted work for "${match.title}"` });
          fetchData(); fetchEnhancedStats();
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assignment_submissions' }, () => {
        if (selected) refreshSubmissions(selected);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, assignments.length]);

  // ── Grading ──────────────────────────────────────

  const refreshSubmissions = async (assignment: AssignmentWithMeta) => {
    const subs = await getSubmissionsForAssignment(assignment.id);
    const enriched = subs.map((s) => {
      const st = students.find((st) => st.id === s.student_id);
      return { ...s, student_name: st?.full_name || "Unknown Student", student_code: st?.student_code || null };
    });
    setSubmissions(enriched);
    return enriched;
  };

  const loadSubmissions = async (assignment: AssignmentWithMeta) => {
    setGradingLoading(true);
    try { await refreshSubmissions(assignment); }
    catch { toast({ title: "Error", description: "Failed to load submissions.", variant: 'destructive' }); }
    finally { setGradingLoading(false); }
  };

  const openGradeForm = (submission: AssignmentSubmission) => {
    setGradingSubmission(submission);
    setGradeScore(submission.score?.toString() || submission.ai_score?.toString() || '');
    setGradeFeedback(submission.teacher_feedback || submission.ai_feedback || '');
  };

  const handleGradeSubmit = async () => {
    if (!gradingSubmission || !selected) return;
    if (!gradeScore || isNaN(Number(gradeScore))) {
      toast({ title: "Invalid Score", description: "Please enter a valid score.", variant: 'destructive' }); return;
    }
    setActionLoading(true);
    try {
      await gradeSubmission(gradingSubmission.id, Number(gradeScore), gradeFeedback);
      toast({ title: "Graded!", description: "Score saved and sent to learner." });
      try {
        await createNotification({ recipientStudentId: gradingSubmission.student_id, type: 'graded',
          title: `Graded: ${selected.title}`, message: `You scored ${gradeScore} on "${selected.title}"`,
          relatedAssignmentId: selected.id, relatedSubmissionId: gradingSubmission.id, linkUrl: '/student/assignments' });
      } catch (notifErr) { console.warn('Notification failed:', notifErr); }
      const gradedStudent = students.find(s => s.id === gradingSubmission.student_id);
      if (gradedStudent?.parent_phone) {
        sendGradedSms(gradedStudent.parent_phone, gradedStudent.full_name, selected.title,
          `${gradeScore}${selected.max_score ? `/${selected.max_score}` : ''}`, resolveSmsDialCountry(gradedStudent.nationality || profile?.country));
      }
      setGradingSubmission(null);
      await refreshSubmissions(selected); await fetchData();
    } catch (err: any) { toast({ title: "Error", description: err?.message || 'Failed to grade.', variant: 'destructive' }); }
    finally { setActionLoading(false); }
  };

  const handleReturnSubmission = async (sub: AssignmentSubmission & { student_name?: string }) => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await returnSubmission(sub.id, sub.score, gradeFeedback || sub.teacher_feedback || 'Please revise and resubmit your work.');
      toast({ title: "Returned", description: "Submission returned for revision." });
      try { await createNotification({ recipientStudentId: sub.student_id, type: 'resubmit_request',
        title: `Revision needed: ${selected.title}`, message: 'Your teacher has returned your submission for revision.',
        relatedAssignmentId: selected.id, relatedSubmissionId: sub.id, linkUrl: '/student/assignments' });
      } catch (notifErr) { console.warn('Notification failed:', notifErr); }
      const returnedStudent = students.find(s => s.id === sub.student_id);
      if (returnedStudent?.parent_phone) sendResubmitSms(returnedStudent.parent_phone, returnedStudent.full_name, selected.title, resolveSmsDialCountry(returnedStudent.nationality || profile?.country));
      await refreshSubmissions(selected);
    } catch (err: any) { toast({ title: "Error", description: err?.message || 'Failed.', variant: 'destructive' }); }
    finally { setActionLoading(false); }
  };

  const handleAllowResubmission = async (sub: AssignmentSubmission & { student_name?: string }) => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await returnSubmission(sub.id, null, 'You may resubmit your work.');
      toast({ title: "Resubmission Allowed", description: "Student can now resubmit." });
      try { await createNotification({ recipientStudentId: sub.student_id, type: 'resubmit_request',
        title: `Resubmit: ${selected.title}`, message: 'You can now resubmit your work.',
        relatedAssignmentId: selected.id, relatedSubmissionId: sub.id, linkUrl: '/student/assignments' });
      } catch (notifErr) { console.warn('Notification failed:', notifErr); }
      const resubStudent = students.find(s => s.id === sub.student_id);
      if (resubStudent?.parent_phone) sendResubmitSms(resubStudent.parent_phone, resubStudent.full_name, selected.title, resolveSmsDialCountry(resubStudent.nationality || profile?.country));
      await refreshSubmissions(selected);
    } catch (err: any) { toast({ title: "Error", description: err?.message, variant: 'destructive' }); }
    finally { setActionLoading(false); }
  };

  const handleSingleAiGrade = async (sub: AssignmentSubmission & { student_name?: string }) => {
    if (!selected || !sub.file_url) { toast({ title: 'No file', description: 'No file to analyze.', variant: 'destructive' }); return; }
    setSingleAiGrading(sub.id);
    try {
      const result = await gradeSubmissionWithAI(sub, selected, sub.student_name || 'Learner');
      if (result.success) { await saveAiGrading(sub.id, result.score, result.feedback); toast({ title: 'AI Graded', description: `Score: ${result.score}. Review and confirm.` }); await refreshSubmissions(selected); }
      else toast({ title: 'AI Error', description: result.error || 'Failed.', variant: 'destructive' });
    } catch (err: any) { toast({ title: 'Error', description: err?.message, variant: 'destructive' }); }
    finally { setSingleAiGrading(null); }
  };

  const handleBatchAiGrade = async () => {
    if (!selected) return;
    const toGrade = submissions.filter(s => !s.ai_graded_at && s.file_url);
    if (toGrade.length === 0) { toast({ title: 'Nothing to grade', description: 'All have been AI-graded.' }); return; }
    setBatchGradingProgress({ current: 0, total: toGrade.length, name: '' });
    try {
      const result = await batchGradeSubmissions(toGrade.map(s => ({ ...s, studentName: s.student_name || 'Learner' })), selected,
        (completed, total, name) => setBatchGradingProgress({ current: completed, total, name }));
      toast({ title: 'Batch Complete', description: `${result.graded} graded, ${result.failed} failed.` });
      await refreshSubmissions(selected);
    } catch (err: any) { toast({ title: 'Error', description: err?.message, variant: 'destructive' }); }
    finally { setBatchGradingProgress(null); }
  };

  const handleRegradeAi = async (sub: AssignmentSubmission & { student_name?: string }) => {
    if (!selected || !sub.file_url) return;
    setSingleAiGrading(sub.id);
    try {
      const result = await regradeSubmissionWithAI(sub.id, selected, sub.student_name || 'Learner');
      if (result.success) { toast({ title: 'Re-graded', description: `New AI score: ${result.score}.` }); await refreshSubmissions(selected); }
      else toast({ title: 'Error', description: result.error || 'Failed.', variant: 'destructive' });
    } catch (err: any) { toast({ title: 'Error', description: err?.message, variant: 'destructive' }); }
    finally { setSingleAiGrading(null); }
  };

  // ── CRUD ────────────────────────────────────────────

  const getStudentName = (id: string) => students.find(s => s.id === id)?.full_name || "Unknown";
  const openCreateForm = () => { setEditingAssignment(null); setFormData({ ...emptyForm, grade_level: profile?.grade_levels || '' }); setStudentSearch(""); setSelectedFile(null); setFormOpen(true); };
  const openEditForm = (a: AssignmentWithMeta) => {
    setEditingAssignment(a); const d = new Date(a.due_date);
    setFormData({ title: a.title, description: a.description || "", due_date: a.due_date,
      due_time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
      grade_level: a.grade_level, subject: a.subject || "Mathematics", status: a.status,
      max_score: a.max_score?.toString() || "", instructions: a.instructions || "",
      selectedStudentIds: [...a.assignedStudentIds], rubric_criteria: [] });
    setStudentSearch(""); setSelectedFile(null); setFormOpen(true);
  };
  const toggleStudentSelection = (id: string) => { setFormData(prev => ({ ...prev, selectedStudentIds: prev.selectedStudentIds.includes(id) ? prev.selectedStudentIds.filter(x => x !== id) : [...prev.selectedStudentIds, id] })); };

  const handleSave = async () => {
    if (!formData.title.trim()) { toast({ title: "Missing Title", variant: "destructive" }); return; }
    if (!formData.due_date) { toast({ title: "Missing Due Date", variant: "destructive" }); return; }
    setActionLoading(true);
    try {
      const dueDateObj = new Date(formData.due_date); const [hh, mm] = (formData.due_time || "23:59").split(":").map(Number);
      dueDateObj.setHours(hh, mm, 0, 0); const combinedDueDate = dueDateObj.toISOString();
      if (editingAssignment) {
        let fileUrl = editingAssignment.attachment_url;
        if (selectedFile) { try { fileUrl = await uploadSubmissionFile(selectedFile, user!.id, editingAssignment.id); } catch { toast({ title: "File upload issue", variant: "default" }); } }
        await updateAssignment(editingAssignment.id, { title: formData.title.trim(), description: formData.description.trim() || null,
          due_date: combinedDueDate, grade_level: formData.grade_level || editingAssignment.grade_level, subject: formData.subject || "Mathematics",
          status: formData.status, max_score: formData.max_score ? Number(formData.max_score) : null, instructions: formData.instructions.trim() || null, attachment_url: fileUrl });
        await updateAssignmentStudents(editingAssignment.id, formData.selectedStudentIds);
        toast({ title: "Updated", description: `"${formData.title}" saved.` });
      } else {
        const newAssignment = await createAssignment({ teacher_id: user!.id, title: formData.title.trim(), description: formData.description.trim() || null,
          subject: formData.subject || "Mathematics", grade_level: formData.grade_level || profile?.grade_levels || "Primary",
          due_date: combinedDueDate, status: formData.status, max_score: formData.max_score ? Number(formData.max_score) : null,
          instructions: formData.instructions.trim() || null, attachment_url: null }, formData.selectedStudentIds);
        if (selectedFile) { try { const fileUrl = await uploadSubmissionFile(selectedFile, user!.id, newAssignment.id); await updateAssignment(newAssignment.id, { attachment_url: fileUrl }); } catch { toast({ title: "File upload issue", variant: "default" }); } }
        if (formData.status === "active") {
          const dueDateDisplay = formData.due_date ? format(new Date(formData.due_date), "MMM d, yyyy") : null;
          for (const studentId of formData.selectedStudentIds) {
            try { await createNotification({ recipientStudentId: studentId, type: 'new_assignment', title: "New Assignment",
              message: `You have a new assignment: "${formData.title.trim()}"`, relatedAssignmentId: newAssignment.id, linkUrl: '/student/assignments' });
            } catch (notifErr) { console.warn("Notification failed:", studentId, notifErr); }
            const student = students.find(s => s.id === studentId);
            if (student?.parent_phone) {
              const smsCountry = resolveSmsDialCountry(student.nationality || profile?.country);
              sendAssignmentNotificationSms(student.parent_phone, student.parent_name || null, student.full_name, formData.title.trim(), dueDateDisplay, smsCountry).then(res => { if (!res.success) console.warn("Guardian SMS failed:", student.full_name, res.error); });
            }
          }
        }
        toast({ title: "Created", description: `"${formData.title}" assigned to ${formData.selectedStudentIds.length} student(s).` });
      }
      setFormOpen(false); await fetchData();
    } catch (err: any) { toast({ title: "Error", description: err?.message || "Failed to save.", variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  const handleDelete = async () => { if (!deleteTarget) return; setActionLoading(true); try { await deleteAssignmentService(deleteTarget.id); toast({ title: "Deleted", description: `"${deleteTarget.title}" removed.` }); if (selected?.id === deleteTarget.id) setSelected(null); setDeleteTarget(null); await fetchData(); } catch (err: any) { toast({ title: "Error", description: err?.message || "Delete failed.", variant: "destructive" }); } finally { setActionLoading(false); } };
  const handleStatusToggle = async (a: AssignmentWithMeta, newStatus: "active" | "draft" | "closed") => { try { await updateAssignment(a.id, { status: newStatus }); toast({ title: "Status Updated", description: `Marked as ${newStatus}.` }); await fetchData(); } catch { toast({ title: "Error", description: "Failed to update.", variant: "destructive" }); } };
  const duplicateAssignment = async (a: AssignmentWithMeta) => { setActionLoading(true); try { await createAssignment({ teacher_id: user!.id, title: `${a.title} (Copy)`, description: a.description, subject: a.subject, grade_level: a.grade_level, due_date: a.due_date, status: "draft", max_score: a.max_score, instructions: a.instructions, attachment_url: a.attachment_url }, a.assignedStudentIds); toast({ title: "Duplicated", description: "Copy created as draft." }); await fetchData(); } catch { toast({ title: "Error", description: "Duplicate failed.", variant: "destructive" }); } finally { setActionLoading(false); } };
  const handleExportCsv = () => { try { const rows = filteredAssignments.map(a => ({ Title: a.title, Subject: a.subject || "Mathematics", Grade: a.grade_level, Status: a.status, Due: format(new Date(a.due_date), "yyyy-MM-dd HH:mm"), MaxScore: a.max_score || "", Assigned: a.assignedStudentIds.length, Submissions: a.submissionCount })); const headers = Object.keys(rows[0] || {}); const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${(r as any)[h]}"`).join(","))].join("\n"); const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `assignments_${format(new Date(), "yyyyMMdd")}.csv`; link.click(); URL.revokeObjectURL(url); toast({ title: "Exported", description: "CSV downloaded." }); } catch { toast({ title: "Error", description: "Export failed.", variant: "destructive" }); } };
  const handleGrantExtension = async () => {
    if (!extensionAssignment || !extensionDate) return;
    if (!extensionStudentId) { toast({ title: "Select a student", variant: "destructive" }); return; }
    setActionLoading(true);
    try {
      const extDate = new Date(extensionDate);
      const [eh, em] = (extensionTime || "23:59").split(":").map(Number);
      extDate.setHours(eh, em, 0, 0);
      const newIso = extDate.toISOString();

      if (extensionStudentId === "__all__") {
        await updateAssignment(extensionAssignment.id, { due_date: newIso });
        for (const sid of extensionAssignment.assignedStudentIds) {
          try {
            await createNotification({ recipientStudentId: sid, type: 'assignment_due', title: "Deadline Extended",
              message: `The deadline for "${extensionAssignment.title}" has been extended to ${format(extDate, "PPp")}.`,
              relatedAssignmentId: extensionAssignment.id, linkUrl: '/student/assignments' });
          } catch { /* non-fatal */ }
        }
        toast({ title: "Deadline Extended", description: `"${extensionAssignment.title}" extended to ${format(extDate, "PPp")} for all students.` });
      } else {
        const { error } = await supabase.from('assignment_students').update({ extended_due_date: newIso })
          .eq('assignment_id', extensionAssignment.id).eq('student_id', extensionStudentId);
        if (error) throw error;
        await createNotification({ recipientStudentId: extensionStudentId, type: 'assignment_due', title: "Deadline Extended",
          message: `Your deadline for "${extensionAssignment.title}" has been extended to ${format(extDate, "PPp")}.`,
          relatedAssignmentId: extensionAssignment.id, linkUrl: '/student/assignments' });
        toast({ title: "Extension Granted", description: `Extended to ${format(extDate, "PPp")} for ${getStudentName(extensionStudentId)}.` });
      }

      setExtensionAssignment(null); setExtensionStudentId(""); setExtensionDate("");
      await fetchData();
    } catch (err: any) { toast({ title: "Error", description: err?.message || "Failed to extend.", variant: "destructive" }); }
    finally { setActionLoading(false); }
  };

  // ── Filtering ──────────────────────────────────────

  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => {
      const q = searchTerm.toLowerCase();
      const matchSearch = !q || a.title.toLowerCase().includes(q) || (a.description || "").toLowerCase().includes(q);
      let matchFilter = true;
      if (activeFilter === "active") matchFilter = a.status === "active" && isFuture(new Date(a.due_date));
      else if (activeFilter === "overdue") matchFilter = a.status === "active" && isPast(new Date(a.due_date));
      else if (activeFilter === "draft") matchFilter = a.status === "draft";
      else if (activeFilter === "closed") matchFilter = a.status === "closed";
      return matchSearch && matchFilter;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [assignments, searchTerm, activeFilter]);

  // ── Helpers ────────────────────────────────────────

  const getDueLabel = (dueDateStr: string, status: string) => {
    if (status === "closed") return { text: "Closed", color: "text-gray-500", bg: "bg-gray-100 dark:bg-gray-800" };
    if (status === "draft") return { text: "Draft", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950" };
    const due = new Date(dueDateStr);
    if (isPast(due)) return { text: "Overdue", color: "text-red-500", bg: "bg-red-50 dark:bg-red-950" };
    if (isToday(due)) return { text: "Due today", color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950" };
    const days = differenceInDays(due, new Date());
    if (days <= 3) return { text: `${days}d left`, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950" };
    return { text: formatDistanceToNow(due, { addSuffix: true }), color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950" };
  };

  const statusGradient = (a: AssignmentWithMeta) => {
    if (a.status === "draft") return "from-blue-500 to-indigo-600";
    if (a.status === "closed") return "from-gray-400 to-gray-500";
    if (isPast(new Date(a.due_date))) return "from-red-500 to-rose-600";
    return "from-emerald-500 to-teal-600";
  };

  const statusAccent = (a: AssignmentWithMeta) => {
    if (a.status === "draft") return "border-l-blue-400";
    if (a.status === "closed") return "border-l-gray-300";
    if (isPast(new Date(a.due_date))) return "border-l-red-400";
    return "border-l-emerald-400";
  };

  const isImageFile = (url: string) => /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i.test(url);
  const selectAssignment = (a: AssignmentWithMeta) => { setSelected(a); setDetailTab("info"); loadSubmissions(a); };

  // ── Guards ─────────────────────────────────────────

  if (!isTeacher(profile)) return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Only teachers can access this page.</p></div>;

  if (loading) return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <div className="h-5 w-5 rounded bg-muted animate-pulse" />
        <div className="space-y-1.5 flex-1"><div className="h-4 w-32 rounded bg-muted animate-pulse" /><div className="h-3 w-48 rounded bg-muted animate-pulse" /></div>
      </div>
      <div className="flex-1 flex">
        <div className="w-full md:w-[380px] border-r p-3 space-y-3">
          <div className="h-9 rounded-lg bg-muted animate-pulse" />
          <div className="flex gap-2">{[1,2,3,4].map(i => <div key={i} className="h-7 w-16 rounded-full bg-muted animate-pulse" />)}</div>
          {[1,2,3,4,5].map(i => <div key={i} className="flex items-start gap-3 p-3"><div className="w-3 h-3 rounded-full bg-muted animate-pulse mt-1" /><div className="flex-1 space-y-2"><div className="h-4 w-3/4 rounded bg-muted animate-pulse" /><div className="h-3 w-1/2 rounded bg-muted animate-pulse" /><div className="h-2 w-full rounded-full bg-muted animate-pulse" /></div></div>)}
        </div>
        <div className="hidden md:flex flex-1 items-center justify-center"><div className="h-20 w-20 rounded-full bg-muted/50 animate-pulse" /></div>
      </div>
    </div>
  );

  // ── Stats ──────────────────────────────────────────

  const activeCount = assignments.filter(a => a.status === "active").length;
  const overdueCount = assignments.filter(a => a.status === "active" && isPast(new Date(a.due_date))).length;
  const totalSubs = assignments.reduce((s, a) => s + a.submissionCount, 0);
  const selectedMissingStudents = selected ? students.filter(s => selected.assignedStudentIds.includes(s.id) && !submissions.some(sub => sub.student_id === s.id)) : [];
  const ungradedWithFile = submissions.filter(s => !s.ai_graded_at && s.file_url);
  const gradedCount = submissions.filter(s => s.status === 'graded').length;
  const submissionPct = selected && selected.assignedStudentIds.length > 0 ? Math.round((selected.submissionCount / selected.assignedStudentIds.length) * 100) : 0;
  const gradingPct = submissions.length > 0 ? Math.round((gradedCount / submissions.length) * 100) : 0;

  const FILTERS = [
    { key: "all", label: "All", count: assignments.length, icon: ClipboardList },
    { key: "active", label: "Active", count: activeCount, icon: Zap },
    { key: "overdue", label: "Overdue", count: overdueCount, icon: AlertTriangle },
    { key: "draft", label: "Drafts", count: assignments.filter(a => a.status === "draft").length, icon: FileText },
    { key: "closed", label: "Closed", count: assignments.filter(a => a.status === "closed").length, icon: Archive },
  ];

  // ═══════════════ RENDER ═══════════════

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* ─── Top Bar ─── */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur-sm shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
            <ClipboardList className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none tracking-tight">Assignments</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">{activeCount} active</span>
              <span className="text-xs text-muted-foreground/50">·</span>
              <span className="text-xs text-muted-foreground">{totalSubs} submissions</span>
              {overdueCount > 0 && <>
                <span className="text-xs text-muted-foreground/50">·</span>
                <span className="text-xs text-red-500 font-medium">{overdueCount} overdue</span>
              </>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => { fetchData(); fetchEnhancedStats(); }} disabled={isRefreshingStats}>
            <RefreshCw className={cn("h-4 w-4", isRefreshingStats && "animate-spin")} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleExportCsv} disabled={filteredAssignments.length === 0}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ─── Split Panel ─── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT PANEL ── */}
        <div className={cn("w-full md:w-[380px] md:min-w-[330px] md:max-w-[420px] border-r flex flex-col bg-background", selected ? "hidden md:flex" : "flex")}>
          {/* New Assignment + Search + Filters */}
          <div className="p-3 space-y-2.5 shrink-0">
            <Button onClick={openCreateForm} className="w-full shadow-md rounded-xl">
              <Plus className="mr-2 h-4 w-4" /> New Assignment
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Input placeholder="Search assignments..." className="pl-9 h-9 bg-muted/40 border-0 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
              {FILTERS.map(f => {
                const Icon = f.icon;
                return (
                  <button key={f.key} onClick={() => setActiveFilter(f.key)}
                    className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200",
                      activeFilter === f.key ? "bg-primary text-primary-foreground shadow-sm scale-[1.02]" : "bg-muted/60 text-muted-foreground hover:bg-muted")}>
                    <Icon className="h-3 w-3" />
                    {f.label}
                    {f.count > 0 && <span className={cn("text-[10px] font-bold", activeFilter === f.key ? "opacity-80" : "opacity-50")}>({f.count})</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignment list */}
          <div className="flex-1 overflow-y-auto">
            {filteredAssignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted/80 to-muted/30 flex items-center justify-center mb-4 shadow-inner">
                  <ClipboardList className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="font-semibold text-sm">No assignments found</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                  {assignments.length === 0 ? "Create your first assignment to get started!" : "Try adjusting your search or filters."}
                </p>
                {assignments.length === 0 && (
                  <Button onClick={openCreateForm} size="sm" className="mt-4 rounded-xl shadow-md">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Create First Assignment
                  </Button>
                )}
              </div>
            ) : (
              filteredAssignments.map(a => {
                const due = getDueLabel(a.due_date, a.status);
                const isSelected = selected?.id === a.id;
                const subProgress = a.assignedStudentIds.length > 0 ? (a.submissionCount / a.assignedStudentIds.length) * 100 : 0;
                return (
                  <button key={a.id} onClick={() => selectAssignment(a)}
                    className={cn("w-full text-left px-3 py-3 border-b border-border/50 transition-all duration-200 flex items-start gap-3 group",
                      "hover:bg-gradient-to-r hover:from-muted/50 hover:to-transparent",
                      isSelected && "bg-gradient-to-r from-primary/8 to-transparent border-l-[3px]", statusAccent(a))}>
                    {/* Colored icon */}
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold shadow-sm transition-transform group-hover:scale-105",
                      a.status === "draft" ? "bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 dark:from-blue-900 dark:to-blue-950 dark:text-blue-300" :
                      a.status === "closed" ? "bg-gradient-to-br from-gray-100 to-gray-50 text-gray-500 dark:from-gray-800 dark:to-gray-900 dark:text-gray-400" :
                      isPast(new Date(a.due_date)) ? "bg-gradient-to-br from-red-100 to-red-50 text-red-600 dark:from-red-900 dark:to-red-950 dark:text-red-300" :
                      "bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 dark:from-emerald-900 dark:to-emerald-950 dark:text-emerald-300"
                    )}>
                      {a.title.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("font-semibold text-sm truncate", isSelected && "text-primary")}>{a.title}</p>
                        <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap shrink-0">{format(new Date(a.due_date), "MMM d")}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{a.subject || "Mathematics"} · {a.grade_level}</p>

                      <div className="flex items-center justify-between mt-2 gap-2">
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", due.color, due.bg)}>{due.text}</span>
                        <div className="flex items-center gap-2.5">
                          {a.submissionCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <FileText className="h-3 w-3" /> {a.submissionCount}/{a.assignedStudentIds.length}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Users className="h-3 w-3" /> {a.assignedStudentIds.length}
                          </span>
                        </div>
                      </div>

                      {/* Mini progress bar */}
                      {a.assignedStudentIds.length > 0 && (
                        <div className="mt-2 h-1 bg-muted/60 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-500",
                            subProgress >= 100 ? "bg-emerald-500" : subProgress >= 50 ? "bg-primary/70" : "bg-primary/40"
                          )} style={{ width: `${Math.min(subProgress, 100)}%` }} />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className={cn("flex-1 flex flex-col min-w-0", !selected ? "hidden md:flex" : "flex")}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-gradient-to-b from-muted/10 to-muted/30">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shadow-inner">
                  <ClipboardList className="h-10 w-10 text-primary/30" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                  <ChevronRight className="h-3 w-3 text-primary/40" />
                </div>
              </div>
              <h2 className="text-lg font-bold text-foreground/60">Select an assignment</h2>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-[280px] leading-relaxed">
                Click any assignment from the list to view details, grade submissions, and manage discussions.
              </p>
            </div>
          ) : (
            <>
              {/* Detail header with gradient */}
              <div className={cn("relative overflow-hidden shrink-0")}>
                <div className={cn("bg-gradient-to-r p-4 text-white", statusGradient(selected))}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
                  <div className="absolute bottom-0 left-1/3 w-16 h-16 bg-white/5 rounded-full translate-y-8" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden shrink-0 text-white hover:bg-white/20" onClick={() => setSelected(null)}>
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-lg truncate leading-tight">{selected.title}</h2>
                        <p className="text-white/70 text-xs mt-0.5">
                          {selected.subject || "Mathematics"} · {selected.grade_level} · Due {format(new Date(selected.due_date), "MMM d, yyyy")}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-white hover:bg-white/20 rounded-lg">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => openEditForm(selected)}><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateAssignment(selected)}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {selected.status === "active" ? <DropdownMenuItem onClick={() => handleStatusToggle(selected, "closed")}><Archive className="h-4 w-4 mr-2" /> Close</DropdownMenuItem>
                            : selected.status === "draft" ? <DropdownMenuItem onClick={() => handleStatusToggle(selected, "active")}><CheckCircle2 className="h-4 w-4 mr-2" /> Publish</DropdownMenuItem>
                            : <DropdownMenuItem onClick={() => handleStatusToggle(selected, "active")}><CheckCircle2 className="h-4 w-4 mr-2" /> Reopen</DropdownMenuItem>}
                          <DropdownMenuItem onClick={() => setExtensionAssignment(selected)}><Timer className="h-4 w-4 mr-2" /> Extend Deadline</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(selected)}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {/* Inline stats */}
                    <div className="flex items-center gap-3 mt-3">
                      <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10 text-center">
                        <p className="text-sm font-bold">{selected.assignedStudentIds.length}</p>
                        <p className="text-[9px] text-white/60 uppercase">Assigned</p>
                      </div>
                      <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10 text-center">
                        <p className="text-sm font-bold">{selected.submissionCount}</p>
                        <p className="text-[9px] text-white/60 uppercase">Submitted</p>
                      </div>
                      <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10 text-center">
                        <p className="text-sm font-bold">{gradedCount}</p>
                        <p className="text-[9px] text-white/60 uppercase">Graded</p>
                      </div>
                      {selected.max_score && (
                        <div className="bg-white/15 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10 text-center">
                          <p className="text-sm font-bold">{selected.max_score}</p>
                          <p className="text-[9px] text-white/60 uppercase">Max Pts</p>
                        </div>
                      )}
                      {/* Progress ring */}
                      <div className="ml-auto relative">
                        <CircularProgress value={submissionPct} size={42} stroke={3} className="text-white/80" />
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">{submissionPct}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-background border-b px-1">
                  {(["info", "submissions", "discussion"] as DetailTab[]).map(tab => (
                    <button key={tab} onClick={() => { setDetailTab(tab); if (tab === "submissions") loadSubmissions(selected); }}
                      className={cn("flex-1 px-4 py-2.5 text-sm font-medium transition-all duration-200 relative",
                        detailTab === tab ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                      <span className="flex items-center justify-center gap-1.5">
                        {tab === "info" && <><Eye className="h-3.5 w-3.5" /> Details</>}
                        {tab === "submissions" && <><FileText className="h-3.5 w-3.5" /> Submissions
                          {selected.submissionCount > 0 && <Badge className="h-4 min-w-4 px-1 text-[9px] bg-primary/15 text-primary border-0">{selected.submissionCount}</Badge>}</>}
                        {tab === "discussion" && <><MessageSquare className="h-3.5 w-3.5" /> Chat</>}
                      </span>
                      {detailTab === tab && <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-t-full" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto bg-gradient-to-b from-muted/5 to-muted/20">
                {/* ─── INFO TAB ─── */}
                {detailTab === "info" && (
                  <div className="p-4 space-y-4 max-w-2xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={cn("border-0 shadow-sm",
                        selected.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300" :
                        selected.status === "draft" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" :
                        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      )}>{selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}</Badge>
                      <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full", getDueLabel(selected.due_date, selected.status).color, getDueLabel(selected.due_date, selected.status).bg)}>
                        {getDueLabel(selected.due_date, selected.status).text}
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-auto">Created {format(new Date(selected.created_at), "MMM d, yyyy")}</span>
                    </div>

                    {selected.description && (
                      <div className="bg-background rounded-2xl p-4 border shadow-sm">
                        <div className="flex items-center gap-2 mb-2"><FileText className="h-4 w-4 text-muted-foreground" /><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</p></div>
                        <p className="text-sm whitespace-pre-line leading-relaxed text-foreground/80">{selected.description}</p>
                      </div>
                    )}
                    {selected.instructions && (
                      <div className="bg-gradient-to-r from-primary/5 to-primary/10 border-l-4 border-primary rounded-r-2xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2"><BookOpen className="h-4 w-4 text-primary" /><p className="text-xs font-semibold text-primary uppercase tracking-wider">Instructions</p></div>
                        <p className="text-sm whitespace-pre-line leading-relaxed">{selected.instructions}</p>
                      </div>
                    )}
                    {selected.attachment_url && (
                      <div className="bg-background rounded-2xl border shadow-sm overflow-hidden">
                        {isImageFile(selected.attachment_url) ? (
                          <div className="relative group"><img src={selected.attachment_url} alt="Attachment" className="w-full max-h-60 object-contain" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="secondary" size="sm" asChild className="shadow-lg rounded-xl"><a href={selected.attachment_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-3 w-3" /> Open</a></Button></div>
                            </div>
                          </div>
                        ) : (
                          <a href={selected.attachment_url} target="_blank" rel="noopener noreferrer" className="p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Paperclip className="h-5 w-5 text-primary" /></div>
                            <div className="flex-1"><p className="text-sm font-medium">Attached File</p><p className="text-[11px] text-muted-foreground">Click to download</p></div>
                            <Download className="h-4 w-4 text-muted-foreground" />
                          </a>
                        )}
                      </div>
                    )}
                    <div className="bg-background rounded-2xl p-4 border shadow-sm">
                      <div className="flex items-center gap-2 mb-3"><Users className="h-4 w-4 text-muted-foreground" /><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned Learners ({selected.assignedStudentIds.length})</p></div>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.assignedStudentIds.map(id => {
                          const name = getStudentName(id);
                          return (
                            <div key={id} className="flex items-center gap-1.5 bg-muted/50 rounded-full pl-1 pr-2.5 py-0.5">
                              <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary">{name.charAt(0).toUpperCase()}</div>
                              <span className="text-xs">{name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── SUBMISSIONS TAB ─── */}
                {detailTab === "submissions" && (
                  <div className="flex flex-col h-full">
                    {batchGradingProgress && (
                      <div className="mx-4 mt-3 p-3 bg-gradient-to-r from-primary/5 to-violet-500/5 rounded-xl border border-primary/20 shrink-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center"><Brain className="h-3.5 w-3.5 text-primary animate-pulse" /></div>
                          <p className="text-sm font-medium text-primary">AI Grading... ({batchGradingProgress.current}/{batchGradingProgress.total})</p>
                        </div>
                        {batchGradingProgress.name && <p className="text-xs text-muted-foreground ml-8">Reviewing: {batchGradingProgress.name}</p>}
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden ml-8"><div className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full transition-all duration-500" style={{ width: `${(batchGradingProgress.current / batchGradingProgress.total) * 100}%` }} /></div>
                      </div>
                    )}

                    {/* Grading progress bar */}
                    {submissions.length > 0 && !gradingLoading && !batchGradingProgress && (
                      <div className="mx-4 mt-3 shrink-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="flex items-center gap-1 text-emerald-600"><div className="w-2 h-2 rounded-full bg-emerald-500" /> {gradedCount} graded</span>
                            <span className="flex items-center gap-1 text-muted-foreground"><div className="w-2 h-2 rounded-full bg-muted-foreground/30" /> {submissions.length - gradedCount} pending</span>
                          </div>
                          <span className="text-[11px] font-bold text-foreground/70">{gradingPct}%</span>
                        </div>
                        <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${gradingPct}%` }} />
                        </div>
                      </div>
                    )}

                    {selectedMissingStudents.length > 0 && !gradingLoading && (
                      <div className="mx-4 mt-3 shrink-0">
                        <details className="group">
                          <summary className="flex items-center justify-between p-2.5 bg-orange-50 dark:bg-orange-950/50 rounded-xl border border-orange-200 dark:border-orange-800 cursor-pointer">
                            <span className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-orange-500" /><span className="text-xs font-medium text-orange-700 dark:text-orange-300">{selectedMissingStudents.length} haven't submitted</span></span>
                            <ChevronDown className="h-3.5 w-3.5 text-orange-500 transition-transform group-open:rotate-180" />
                          </summary>
                          <div className="mt-1.5 p-2.5 space-y-1">
                            {selectedMissingStudents.slice(0, 8).map(st => (
                              <div key={st.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <div className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-[9px] font-bold text-orange-600 dark:text-orange-300">{st.full_name.charAt(0).toUpperCase()}</div>
                                {st.full_name}
                              </div>
                            ))}
                            {selectedMissingStudents.length > 8 && <p className="text-[10px] text-muted-foreground">+{selectedMissingStudents.length - 8} more</p>}
                          </div>
                        </details>
                      </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {gradingLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                          <LoadingAnimation message="Loading submissions..." />
                        </div>
                      ) : submissions.length === 0 ? (
                        <div className="text-center py-16">
                          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4 shadow-inner">
                            <FileText className="h-7 w-7 text-muted-foreground/30" />
                          </div>
                          <p className="font-semibold text-sm">No submissions yet</p>
                          <p className="text-xs text-muted-foreground mt-1">{selected.assignedStudentIds.length} students assigned — waiting for their work.</p>
                        </div>
                      ) : (
                        submissions.map((sub, idx) => {
                          const isAiGradingThis = singleAiGrading === sub.id;
                          const maxScore = selected.max_score || 100;
                          const scoreVal = sub.status === 'graded' ? sub.score : sub.ai_score;
                          const scorePct = scoreVal !== null && scoreVal !== undefined ? Math.round((scoreVal / maxScore) * 100) : null;

                          return (
                            <div key={sub.id} className={cn("bg-background rounded-2xl border shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md",
                              sub.status === 'graded' && "ring-1 ring-emerald-200 dark:ring-emerald-800",
                              sub.ai_graded_at && sub.status !== 'graded' && "ring-1 ring-violet-200 dark:ring-violet-800")}>
                              {/* Student header */}
                              <div className={cn("px-4 py-3 flex items-center gap-3",
                                sub.status === 'graded' ? "bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-emerald-950/30" :
                                sub.ai_graded_at ? "bg-gradient-to-r from-violet-50/80 to-transparent dark:from-violet-950/30" :
                                "bg-gradient-to-r from-muted/30 to-transparent")}>
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-sm",
                                  sub.status === 'graded' ? "bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-700 dark:from-emerald-900 dark:to-emerald-950 dark:text-emerald-300" :
                                  sub.ai_graded_at ? "bg-gradient-to-br from-violet-100 to-violet-50 text-violet-700 dark:from-violet-900 dark:to-violet-950 dark:text-violet-300" :
                                  "bg-gradient-to-br from-blue-100 to-blue-50 text-blue-700 dark:from-blue-900 dark:to-blue-950 dark:text-blue-300")}>
                                  {sub.student_name ? sub.student_name.charAt(0).toUpperCase() : "?"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2"><p className="font-semibold text-sm truncate">{sub.student_name}</p>
                                    {sub.student_code && <code className="text-[9px] font-mono bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-full">{sub.student_code}</code>}</div>
                                  <p className="text-[11px] text-muted-foreground">{format(new Date(sub.submitted_at), "MMM d · h:mm a")}</p>
                                </div>
                                {/* Score badge */}
                                {sub.status === 'graded' ? (
                                  <div className="flex items-center gap-1.5">
                                    {scorePct !== null && (
                                      <div className="relative"><CircularProgress value={scorePct} size={32} stroke={2.5} className={scorePct >= 80 ? "text-emerald-500" : scorePct >= 60 ? "text-amber-500" : "text-red-500"} />
                                        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">{scorePct}%</span></div>
                                    )}
                                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-0 text-xs shadow-sm">{sub.score !== null ? `${sub.score}/${maxScore}` : 'Graded'}</Badge>
                                  </div>
                                ) : sub.ai_graded_at ? (
                                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 border-0 text-xs shadow-sm"><Sparkles className="mr-1 h-3 w-3" /> AI: {sub.ai_score ?? '—'}</Badge>
                                ) : sub.status === 'returned' ? (
                                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-0 text-xs shadow-sm">Returned</Badge>
                                ) : <Badge variant="outline" className="text-xs shadow-sm">Pending</Badge>}
                              </div>

                              <div className="px-4 pb-4 pt-1 space-y-2.5">
                                {sub.file_url && (
                                  <div className="rounded-xl overflow-hidden border bg-muted/20 shadow-inner">
                                    {isImageFile(sub.file_url) ? (
                                      <a href={sub.file_url} target="_blank" rel="noopener noreferrer" className="block"><img src={sub.file_url} alt="Submission" className="w-full max-h-40 object-contain" /></a>
                                    ) : (
                                      <a href={sub.file_url} target="_blank" rel="noopener noreferrer" className="p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><FileText className="h-4 w-4 text-primary" /></div>
                                        <span className="text-sm flex-1">View file</span><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></a>
                                    )}
                                  </div>
                                )}
                                {sub.notes && (
                                  <div className="bg-muted/20 rounded-xl p-3 border-l-[3px] border-muted-foreground/20">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Student note</p>
                                    <p className="text-sm italic text-foreground/75">"{sub.notes}"</p>
                                  </div>
                                )}
                                {sub.ai_graded_at && sub.ai_feedback && (() => {
                                  const sections = parseAiFeedback(sub.ai_feedback);
                                  return (
                                    <div className="bg-gradient-to-r from-violet-50/80 to-purple-50/40 dark:from-violet-950/40 dark:to-purple-950/20 rounded-xl p-3 border border-violet-200/50 dark:border-violet-800/50 space-y-1.5">
                                      <div className="flex items-center gap-1.5"><Brain className="h-3 w-3 text-violet-500" /><span className="text-[10px] font-bold text-violet-600 dark:text-violet-300 uppercase tracking-wider">AI Analysis</span>
                                        {sub.ai_score !== null && <span className="ml-auto text-xs font-bold text-violet-600 dark:text-violet-300">{sub.ai_score}/{maxScore}</span>}</div>
                                      {sections.analysis && <p className="text-xs leading-relaxed line-clamp-3 text-foreground/75">{sections.analysis}</p>}
                                    </div>
                                  );
                                })()}
                                {sub.teacher_feedback && (
                                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-3 border-l-[3px] border-primary">
                                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Your feedback</p>
                                    <p className="text-xs text-foreground/80">{sub.teacher_feedback}</p>
                                  </div>
                                )}

                                <div className="flex items-center gap-2 flex-wrap pt-1">
                                  {sub.file_url && !sub.ai_graded_at && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/50"
                                      onClick={() => handleSingleAiGrade(sub)} disabled={isAiGradingThis || !!batchGradingProgress}>
                                      {isAiGradingThis ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Brain className="h-3 w-3 mr-1" />} AI Grade
                                    </Button>
                                  )}
                                  {sub.file_url && sub.ai_graded_at && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/50"
                                      onClick={() => handleRegradeAi(sub)} disabled={isAiGradingThis || !!batchGradingProgress}>
                                      <RefreshCw className="h-3 w-3 mr-1" /> Re-grade
                                    </Button>
                                  )}
                                  {sub.status === 'submitted' && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300" onClick={() => handleReturnSubmission(sub)}>
                                      <Undo2 className="h-3 w-3 mr-1" /> Return
                                    </Button>
                                  )}
                                  {sub.status === 'graded' && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300" onClick={() => handleAllowResubmission(sub)}>
                                      <RotateCcw className="h-3 w-3 mr-1" /> Allow Resubmit
                                    </Button>
                                  )}
                                  <Button size="sm" className={cn("h-7 text-xs ml-auto rounded-lg shadow-sm", sub.status !== 'graded' && "bg-gradient-to-r from-primary to-primary/80")}
                                    variant={sub.status === 'graded' ? 'outline' : 'default'} onClick={() => openGradeForm(sub)}>
                                    <Star className="h-3 w-3 mr-1" /> {sub.status === 'graded' ? 'Update' : 'Grade'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {submissions.length > 0 && !gradingLoading && (
                      <div className="p-3 border-t bg-background/90 backdrop-blur-sm shrink-0 flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">{submissions.length}/{selected.assignedStudentIds.length} submitted · {gradedCount} graded</span>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" onClick={() => setExtensionAssignment(selected)}><Timer className="h-3.5 w-3.5 mr-1.5" /> Extend</Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300"
                            onClick={handleBatchAiGrade} disabled={!!batchGradingProgress || ungradedWithFile.length === 0}>
                            <Brain className="h-3.5 w-3.5 mr-1.5" /> AI Grade All ({ungradedWithFile.length})
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {detailTab === "discussion" && (
                  <div className="h-full min-h-[500px]">
                    <AssignmentComments assignmentId={selected.id} currentUserId={user?.id || ""} currentUserRole="teacher" currentUserName={profile?.full_name || "Teacher"} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════ DIALOGS ═══════════════ */}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0 rounded-2xl">
          <div className="px-6 py-5 shrink-0 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground">
            <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
            <div className="absolute bottom-0 left-1/4 w-12 h-12 bg-white/5 rounded-full translate-y-6" />
            <div className="relative z-10">
              <DialogTitle className="text-lg font-bold flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  {editingAssignment ? <Edit className="h-4.5 w-4.5" /> : <Plus className="h-4.5 w-4.5" />}
                </div>
                {editingAssignment ? 'Edit Assignment' : 'New Assignment'}
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/70 text-sm mt-1">{editingAssignment ? 'Update details and assigned students' : 'Create and assign to your students'}</DialogDescription>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ minHeight: 0 }}>
            <div className="space-y-1.5"><Label className="text-sm font-medium">Title *</Label><Input placeholder="e.g., Addition & Subtraction Practice" className="rounded-xl" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium">Description</Label><Textarea rows={2} placeholder="What should students do?" className="rounded-xl" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-sm font-medium">Due Date *</Label>
                <div className="flex gap-2">
                  <Popover><PopoverTrigger asChild><Button variant="outline" className={cn("flex-1 justify-start text-left font-normal h-9 text-sm rounded-xl", !formData.due_date && "text-muted-foreground")}><CalendarIcon className="mr-2 h-3.5 w-3.5" />{formData.due_date ? format(new Date(formData.due_date), "MMM d, yyyy") : "Pick date"}</Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-[100]" align="start"><Calendar mode="single" selected={formData.due_date ? new Date(formData.due_date) : undefined} onSelect={date => setFormData({ ...formData, due_date: date ? date.toISOString() : "" })} initialFocus /></PopoverContent>
                  </Popover>
                  <Input type="time" value={formData.due_time} onChange={e => setFormData({ ...formData, due_time: e.target.value })} className="w-24 h-9 text-sm rounded-xl" />
                </div>
              </div>
              <div className="space-y-1.5"><Label className="text-sm font-medium">Status</Label><Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v as any })}><SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-sm font-medium">Subject</Label><Input placeholder="e.g., Mathematics" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} className="h-9 rounded-xl" /></div>
              <div className="space-y-1.5"><Label className="text-sm font-medium">Grade Level</Label><Input placeholder="e.g., Grade 5" value={formData.grade_level} onChange={e => setFormData({ ...formData, grade_level: e.target.value })} className="h-9 rounded-xl" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-sm font-medium">Max Score</Label><Input type="number" min="0" placeholder="e.g., 100" value={formData.max_score} onChange={e => setFormData({ ...formData, max_score: e.target.value })} className="h-9 rounded-xl" /></div>
              <div className="space-y-1.5"><Label className="text-sm font-medium">Attachment</Label>
                <Button type="button" variant="outline" className="w-full h-9 text-sm rounded-xl" onClick={() => document.getElementById('assignment-file-input')?.click()}>
                  <Paperclip className="mr-2 h-3.5 w-3.5" />{selectedFile ? selectedFile.name.slice(0, 20) : 'Attach file'}
                </Button>
                <input id="assignment-file-input" type="file" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-sm font-medium">Instructions</Label><Textarea rows={2} placeholder="Additional instructions..." className="rounded-xl" value={formData.instructions} onChange={e => setFormData({ ...formData, instructions: e.target.value })} /></div>
            <Separator />
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4" /> Assign to Students <Badge variant="secondary" className="text-[10px] rounded-full">{formData.selectedStudentIds.length}/{students.length}</Badge></Label>
                <div className="flex gap-1"><Button type="button" variant="ghost" size="sm" className="h-7 text-xs rounded-lg" onClick={() => setFormData(prev => ({ ...prev, selectedStudentIds: students.map(s => s.id) }))}>All</Button><Button type="button" variant="ghost" size="sm" className="h-7 text-xs rounded-lg" onClick={() => setFormData(prev => ({ ...prev, selectedStudentIds: [] }))}>None</Button></div>
              </div>
              {students.length === 0 ? (<div className="text-center py-4 border rounded-xl bg-muted/30"><p className="text-sm text-muted-foreground">No students. Add students first.</p></div>) : (<>
                <Input placeholder="Search students..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} className="h-8 text-sm rounded-xl" />
                <div className="max-h-[180px] overflow-y-auto border rounded-xl">
                  <div className="p-1.5 space-y-0.5">
                    {students.filter(s => s.full_name.toLowerCase().includes(studentSearch.toLowerCase())).map(s => (
                      <label key={s.id} className={cn("flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all duration-150 text-sm",
                        formData.selectedStudentIds.includes(s.id) ? "bg-primary/10 shadow-sm" : "hover:bg-muted/70")}>
                        <Checkbox checked={formData.selectedStudentIds.includes(s.id)} onCheckedChange={() => toggleStudentSelection(s.id)} />
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{s.full_name.charAt(0).toUpperCase()}</div>
                        <span className="truncate">{s.full_name}</span>
                        {s.student_code && <code className="text-[10px] text-muted-foreground ml-auto">{s.student_code}</code>}
                      </label>
                    ))}
                  </div>
                </div>
              </>)}
            </div>
          </div>
          <div className="px-6 py-3 border-t shrink-0 flex items-center justify-between bg-muted/20">
            <span className="text-xs text-muted-foreground">{formData.selectedStudentIds.length > 0 ? `${formData.selectedStudentIds.length} student(s) selected` : "Select at least one student"}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setFormOpen(false)} disabled={actionLoading}>Cancel</Button>
              <Button size="sm" className="rounded-xl shadow-md bg-gradient-to-r from-primary to-primary/85" onClick={handleSave} disabled={actionLoading || !formData.title || !formData.due_date || formData.selectedStudentIds.length === 0}>
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}{editingAssignment ? 'Save' : 'Create & Assign'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl"><AlertDialogHeader><AlertDialogTitle>Delete Assignment</AlertDialogTitle><AlertDialogDescription>Delete <strong>"{deleteTarget?.title}"</strong>? This removes all submissions and cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={actionLoading} className="rounded-xl">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">{actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!gradingSubmission} onOpenChange={open => { if (!open) setGradingSubmission(null); }}>
        {gradingSubmission && (() => {
          const subMeta = submissions.find(s => s.id === gradingSubmission.id);
          const studentName = subMeta?.student_name || 'Learner';
          const maxScore = selected?.max_score || 100;
          const hasAiReview = !!(gradingSubmission.ai_graded_at && gradingSubmission.ai_feedback);
          const scorePctVal = gradeScore ? Math.min(100, Math.round((Number(gradeScore) / maxScore) * 100)) : 0;
          const scoreLabel = !gradeScore ? "" : Number(gradeScore) >= 80 ? "Excellent" : Number(gradeScore) >= 60 ? "Good" : "Needs Improvement";
          const scoreColor = !gradeScore ? "text-muted-foreground" : Number(gradeScore) >= 80 ? "text-emerald-600" : Number(gradeScore) >= 60 ? "text-amber-600" : "text-red-600";
          return (
            <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0 rounded-2xl">
              <div className="px-6 py-5 shrink-0 relative overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white">
                <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -translate-y-10 translate-x-10" /><div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full translate-y-8 -translate-x-4" />
                <div className="relative z-10">
                  <DialogTitle className="text-lg font-bold flex items-center gap-2.5"><Star className="h-5 w-5" /> Grade Submission</DialogTitle>
                  <DialogDescription className="text-white/80 text-sm mt-1 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">{studentName.charAt(0).toUpperCase()}</div>
                    <span className="font-medium">{studentName}</span>
                    {selected?.max_score && <span className="ml-auto text-xs bg-white/20 px-2.5 py-0.5 rounded-full border border-white/10">Max: {selected.max_score}</span>}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ minHeight: 0 }}>
                {gradingSubmission.file_url && (
                  <div className="rounded-xl overflow-hidden border shadow-sm">{isImageFile(gradingSubmission.file_url) ? <a href={gradingSubmission.file_url} target="_blank" rel="noopener noreferrer"><img src={gradingSubmission.file_url} alt="Submission" className="w-full max-h-48 object-contain" /></a> : (
                    <a href={gradingSubmission.file_url} target="_blank" rel="noopener noreferrer" className="p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"><div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><FileText className="h-4 w-4 text-primary" /></div><span className="text-sm flex-1">View file</span><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></a>)}</div>
                )}
                {hasAiReview && (() => { const sections = parseAiFeedback(gradingSubmission.ai_feedback!); const pct = gradingSubmission.ai_score != null ? Math.round((gradingSubmission.ai_score / maxScore) * 100) : null;
                  return (<div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/20 rounded-xl p-4 border border-violet-200/50 dark:border-violet-800/50 space-y-2">
                    <div className="flex items-center justify-between"><p className="text-xs font-bold text-violet-600 dark:text-violet-300 flex items-center gap-1.5"><Brain className="h-3.5 w-3.5" /> AI Report</p>{pct !== null && <span className="text-sm font-bold text-violet-700 dark:text-violet-300">{pct}% ({gradingSubmission.ai_score}/{maxScore})</span>}</div>
                    {sections.analysis && <p className="text-xs leading-relaxed text-foreground/75">{sections.analysis}</p>}
                    {sections.error_type && <p className="text-xs leading-relaxed"><span className="font-semibold text-amber-600">Error:</span> {sections.error_type}</p>}
                    {sections.remediation && <p className="text-xs leading-relaxed"><span className="font-semibold text-purple-600">Fix:</span> {sections.remediation}</p>}
                    {gradingSubmission.ai_score != null && gradeScore !== gradingSubmission.ai_score.toString() && (
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs rounded-lg border-violet-200 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-900/50" onClick={() => { setGradeScore(gradingSubmission.ai_score!.toString()); if (gradingSubmission.ai_feedback && !gradeFeedback) setGradeFeedback(gradingSubmission.ai_feedback); }}>
                        <Sparkles className="h-3 w-3 mr-1.5" /> Use AI Score — {gradingSubmission.ai_score} pts
                      </Button>
                    )}
                  </div>); })()}
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2"><Target className="h-4 w-4 text-amber-500" /> Score <span className="text-xs font-normal text-muted-foreground ml-auto">out of {maxScore}</span></Label>
                  <div className="flex items-center gap-4">
                    <Input type="number" min="0" max={maxScore} value={gradeScore} onChange={e => setGradeScore(e.target.value)} placeholder="e.g., 85" className="text-xl font-bold h-12 rounded-xl flex-1" />
                    {gradeScore && (
                      <div className="relative shrink-0"><CircularProgress value={scorePctVal} size={52} stroke={4} className={Number(gradeScore) >= 80 ? "text-emerald-500" : Number(gradeScore) >= 60 ? "text-amber-500" : "text-red-500"} />
                        <span className={cn("absolute inset-0 flex items-center justify-center text-xs font-bold", scoreColor)}>{scorePctVal}%</span></div>
                    )}
                  </div>
                  {gradeScore && <p className={cn("text-xs font-semibold", scoreColor)}>{scoreLabel}</p>}
                </div>
                <div className="space-y-1.5"><Label className="text-sm font-medium">Feedback</Label><Textarea rows={3} value={gradeFeedback} onChange={e => setGradeFeedback(e.target.value)} placeholder="Great work! Keep practicing..." className="rounded-xl" /></div>
              </div>
              <div className="px-6 py-3 border-t shrink-0 flex justify-end gap-2 bg-muted/20">
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setGradingSubmission(null)} disabled={actionLoading}>Cancel</Button>
                <Button size="sm" className="rounded-xl shadow-md bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0" onClick={handleGradeSubmit} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />} Save & Send
                </Button>
              </div>
            </DialogContent>
          );
        })()}
      </Dialog>

      <Dialog open={!!extensionAssignment} onOpenChange={open => { if (!open) { setExtensionAssignment(null); setExtensionStudentId(""); setExtensionDate(""); } }}>
        {extensionAssignment && (
          <DialogContent className="sm:max-w-[420px] rounded-2xl">
            <DialogTitle className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Timer className="h-4 w-4 text-primary" /></div> Extend Deadline</DialogTitle>
            <DialogDescription>For "{extensionAssignment.title}"</DialogDescription>
            <div className="space-y-3 py-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Extend for</Label>
                <Select value={extensionStudentId} onValueChange={setExtensionStudentId}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select student or all" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All students (update assignment deadline)</SelectItem>
                    {extensionAssignment.assignedStudentIds.map(sid => <SelectItem key={sid} value={sid}>{getStudentName(sid)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {extensionStudentId === "__all__" && (
                  <p className="text-[11px] text-muted-foreground">This will update the assignment's main due date for everyone.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5"><Label className="text-sm">New Date</Label><Input type="date" value={extensionDate} onChange={e => setExtensionDate(e.target.value)} className="rounded-xl" /></div>
                <div className="space-y-1.5"><Label className="text-sm">Time</Label><Input type="time" value={extensionTime} onChange={e => setExtensionTime(e.target.value)} className="rounded-xl" /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setExtensionAssignment(null)}>Cancel</Button>
              <Button size="sm" className="rounded-xl shadow-md" onClick={handleGrantExtension} disabled={!extensionStudentId || !extensionDate || actionLoading}>
                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Grant Extension
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default AssignmentManagement;
