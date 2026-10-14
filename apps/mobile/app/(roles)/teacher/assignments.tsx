import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import {
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  MoreHorizontal,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { shareTextFile } from "../../../src/native/exportText";
import {
  pickDocumentForUpload,
  pickImageForUpload,
  type PickedFile,
} from "../../../src/native/uploads";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  addTeacherComment,
  deleteComment,
  listCommentsForTeacher,
  type AssignmentComment,
} from "../../../src/services/assignmentComments";
import {
  batchGradeSubmissions,
  gradeSubmissionWithAI,
  saveAiGrading,
} from "../../../src/services/aiGrading";
import {
  buildAssignmentsCsv,
  createAssignment,
  deleteAssignment,
  duplicateAssignment,
  getAssignmentStatsForTeacher,
  getUnsubmittedStudents,
  gradeSubmission,
  grantStudentExtension,
  listAssignmentsForTeacher,
  listSubmissionsForAssignment,
  notifyStudent,
  replaceAssignmentStudents,
  returnSubmission,
  updateAssignment,
  uploadAssignmentAttachment,
  type AssignmentStats,
  type AssignmentSubmission,
  type AssignmentWithMeta,
} from "../../../src/services/assignments";
import { listStudentsForTeacher, type StudentRow } from "../../../src/services/students";
import { colors, fonts, radius, space } from "../../../src/theme/tokens";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  IconTile,
  Input,
  ListRow,
  OptionGroup,
  RichText,
  Select,
  Sheet,
  SheetAction,
  Skeleton,
  StatStrip,
  Text,
  confirmDelete,
  showError,
  showSuccess,
} from "../../../src/ui";

type Filter = "all" | "active" | "overdue" | "draft" | "closed";
type DetailTab = "details" | "submissions" | "discussion";
type FormStatus = "active" | "draft" | "closed";

const GRADE_LEVELS = [
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
] as const;

const DUE_OFFSETS = ["3", "7", "14", "30"] as const;
const EXT_OFFSETS = ["3", "7", "14"] as const;

const normalizeStatus = (status: string | null | undefined): FormStatus => {
  if (status === "published" || status === "active") return "active";
  if (status === "closed") return "closed";
  return "draft";
};

const statusTone = (status: FormStatus): "success" | "info" | "neutral" => {
  if (status === "active") return "success";
  if (status === "draft") return "info";
  return "neutral";
};

const statusLabel = (status: FormStatus, t: (k: string) => string) => {
  if (status === "active") return t("assignment.status.active");
  if (status === "closed") return t("assignment.status.closed");
  return t("assignment.status.draft");
};

const buildDueIso = (dueIn: string, dueDateStr: string, dueTime: string) => {
  const [hh, mm] = (dueTime.trim() || "23:59").split(":").map((v) => Number(v));
  const hours = Number.isFinite(hh) ? hh : 23;
  const minutes = Number.isFinite(mm) ? mm : 59;

  if (dueDateStr.trim()) {
    const d = new Date(dueDateStr.trim());
    if (!Number.isNaN(d.getTime())) {
      d.setHours(hours, minutes, 0, 0);
      return d.toISOString();
    }
  }

  const d = new Date();
  d.setDate(d.getDate() + (Number(dueIn) || 7));
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

const emptyForm = () => ({
  title: "",
  description: "",
  instructions: "",
  subject: "Mathematics",
  gradeLevel: "Primary 1",
  status: "active" as FormStatus,
  dueIn: "7",
  dueDateStr: "",
  dueTime: "23:59",
  maxScore: "10",
  selectedStudentIds: [] as string[],
});

export default function TeacherAssignmentsScreen() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [items, setItems] = useState<AssignmentWithMeta[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [stats, setStats] = useState<AssignmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentWithMeta | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [studentSearch, setStudentSearch] = useState("");
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  const [menuTarget, setMenuTarget] = useState<AssignmentWithMeta | null>(null);

  const [open, setOpen] = useState<AssignmentWithMeta | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("details");
  const [subs, setSubs] = useState<AssignmentSubmission[]>([]);
  const [unsubmitted, setUnsubmitted] = useState<StudentRow[]>([]);
  const [comments, setComments] = useState<AssignmentComment[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const [grading, setGrading] = useState<AssignmentSubmission | null>(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const [extensionTarget, setExtensionTarget] = useState<AssignmentWithMeta | null>(null);
  const [extStudentId, setExtStudentId] = useState("__all__");
  const [extOffset, setExtOffset] = useState("7");
  const [extDateStr, setExtDateStr] = useState("");
  const [extSaving, setExtSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    const [list, roster, nextStats] = await Promise.all([
      listAssignmentsForTeacher(user.id),
      listStudentsForTeacher(user.id),
      getAssignmentStatsForTeacher(user.id),
    ]);
    setItems(list);
    setStudents(roster);
    setStats(nextStats);
    setOpen((prev) => (prev ? (list.find((a) => a.id === prev.id) ?? null) : null));
  }, [user]);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("assignments.loadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    return items.filter((a) => {
      const status = normalizeStatus(a.status);
      const dueMs = a.due_date ? new Date(a.due_date).getTime() : null;
      const isPast = dueMs !== null && dueMs < now;

      if (filter === "active") {
        if (status !== "active" || isPast) return false;
      } else if (filter === "overdue") {
        if (status !== "active" || !isPast) return false;
      } else if (filter === "draft") {
        if (status !== "draft") return false;
      } else if (filter === "closed") {
        if (status !== "closed") return false;
      }

      if (!q) return true;
      return [a.title, a.description, a.subject, a.grade_level]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [items, query, filter]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        (s.grade_level ?? "").toLowerCase().includes(q) ||
        (s.class_name ?? "").toLowerCase().includes(q),
    );
  }, [students, studentSearch]);

  const loadDetailExtras = async (assignment: AssignmentWithMeta, roster: StudentRow[]) => {
    setSubsLoading(true);
    setCommentsLoading(true);
    try {
      const [nextSubs, missing, nextComments] = await Promise.all([
        listSubmissionsForAssignment(assignment.id),
        getUnsubmittedStudents(assignment, roster),
        listCommentsForTeacher(assignment.id),
      ]);
      setSubs(nextSubs);
      setUnsubmitted(missing);
      setComments(nextComments);
    } catch (e) {
      showError(t("assignments.submissionsFailed"), e);
    } finally {
      setSubsLoading(false);
      setCommentsLoading(false);
    }
  };

  const openAssignment = async (a: AssignmentWithMeta) => {
    setOpen(a);
    setDetailTab("details");
    setNewComment("");
    await loadDetailExtras(a, students);
  };

  const refreshOpen = async () => {
    if (!open) return;
    const list = await listAssignmentsForTeacher(user!.id);
    setItems(list);
    const refreshed = list.find((a) => a.id === open.id) ?? null;
    setOpen(refreshed);
    if (refreshed) await loadDetailExtras(refreshed, students);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm(),
      selectedStudentIds: students.map((s) => s.id),
    });
    setPickedFile(null);
    setStudentSearch("");
    setTitleError(null);
    setFormOpen(true);
  };

  const openEdit = (a: AssignmentWithMeta) => {
    setMenuTarget(null);
    setEditing(a);
    const due = a.due_date ? new Date(a.due_date) : null;
    setForm({
      title: a.title,
      description: a.description ?? "",
      instructions: a.instructions ?? "",
      subject: a.subject ?? "Mathematics",
      gradeLevel: a.grade_level && GRADE_LEVELS.includes(a.grade_level as (typeof GRADE_LEVELS)[number])
        ? a.grade_level
        : "Primary 1",
      status: normalizeStatus(a.status),
      dueIn: "7",
      dueDateStr: due
        ? `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`
        : "",
      dueTime: due
        ? `${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}`
        : "23:59",
      maxScore: String(a.max_score ?? 10),
      selectedStudentIds: [...a.assignedStudentIds],
    });
    setPickedFile(null);
    setStudentSearch("");
    setTitleError(null);
    setFormOpen(true);
  };

  const toggleStudent = (id: string) => {
    setForm((prev) => ({
      ...prev,
      selectedStudentIds: prev.selectedStudentIds.includes(id)
        ? prev.selectedStudentIds.filter((x) => x !== id)
        : [...prev.selectedStudentIds, id],
    }));
  };

  const submitForm = async () => {
    if (!user) return;
    if (!form.title.trim()) {
      setTitleError(t("assignments.titleRequired"));
      return;
    }
    setSavingForm(true);
    try {
      const dueIso = buildDueIso(form.dueIn, form.dueDateStr, form.dueTime);
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        instructions: form.instructions.trim() || null,
        subject: form.subject.trim() || "Mathematics",
        grade_level: form.gradeLevel,
        status: form.status,
        due_date: dueIso,
        max_score: Number(form.maxScore) || 10,
      };

      if (editing) {
        await updateAssignment(editing.id, payload);
        await replaceAssignmentStudents(editing.id, form.selectedStudentIds);
        if (pickedFile) {
          const url = await uploadAssignmentAttachment({
            teacherId: user.id,
            assignmentId: editing.id,
            uri: pickedFile.uri,
            fileName: pickedFile.name,
            mimeType: pickedFile.mimeType,
          });
          await updateAssignment(editing.id, { attachment_url: url });
        }
        showSuccess(t("assignment.update.success"), form.title.trim());
      } else {
        const created = await createAssignment({
          teacher_id: user.id,
          ...payload,
          studentIds: form.selectedStudentIds,
        });
        if (pickedFile) {
          try {
            const url = await uploadAssignmentAttachment({
              teacherId: user.id,
              assignmentId: created.id,
              uri: pickedFile.uri,
              fileName: pickedFile.name,
              mimeType: pickedFile.mimeType,
            });
            await updateAssignment(created.id, { attachment_url: url });
          } catch {
            showError(t("assignments.createFailed"), new Error("Attachment upload failed"));
          }
        }
        if (form.status === "active") {
          for (const studentId of form.selectedStudentIds) {
            await notifyStudent({
              recipientStudentId: studentId,
              type: "new_assignment",
              title: "New Assignment",
              message: `You have a new assignment: "${form.title.trim()}"`,
              relatedAssignmentId: created.id,
            });
          }
        }
        showSuccess(
          t("assignment.create.success"),
          `${t("assignments.assignedTo")} ${form.selectedStudentIds.length}`,
        );
      }

      setFormOpen(false);
      setEditing(null);
      setPickedFile(null);
      await reload();
    } catch (e) {
      showError(editing ? t("assignments.createFailed") : t("assignments.createFailed"), e);
    } finally {
      setSavingForm(false);
    }
  };

  const setStatus = async (a: AssignmentWithMeta, status: FormStatus) => {
    setMenuTarget(null);
    try {
      await updateAssignment(a.id, { status });
      showSuccess(t("assignment.status.updated"), `${t("assignment.status.markedAs")} ${status}`);
      await reload();
    } catch (e) {
      showError(t("assignments.createFailed"), e);
    }
  };

  const handleDuplicate = async (a: AssignmentWithMeta) => {
    if (!user) return;
    setMenuTarget(null);
    setActionBusy(true);
    try {
      await duplicateAssignment(a, user.id);
      showSuccess(t("assignment.duplicate.success"), t("assignment.duplicate.desc"));
      await reload();
    } catch (e) {
      showError(t("assignments.createFailed"), e);
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = (a: AssignmentWithMeta) => {
    setMenuTarget(null);
    if (open?.id === a.id) setOpen(null);
    confirmDelete(a.title, async () => {
      try {
        await deleteAssignment(a.id);
        showSuccess(t("assignment.delete.success"), a.title);
        await reload();
      } catch (e) {
        showError(t("assignments.deleteFailed"), e);
      }
    });
  };

  const openExtension = (a: AssignmentWithMeta) => {
    setMenuTarget(null);
    setExtensionTarget(a);
    setExtStudentId("__all__");
    setExtOffset("7");
    setExtDateStr("");
  };

  const submitExtension = async () => {
    if (!extensionTarget) return;
    setExtSaving(true);
    try {
      const iso = buildDueIso(extOffset, extDateStr, "23:59");
      const when = new Date(iso).toLocaleString(locale);

      if (extStudentId === "__all__") {
        await updateAssignment(extensionTarget.id, { due_date: iso });
        for (const sid of extensionTarget.assignedStudentIds) {
          await notifyStudent({
            recipientStudentId: sid,
            type: "assignment_due",
            title: "Deadline Extended",
            message: `The deadline for "${extensionTarget.title}" has been extended to ${when}.`,
            relatedAssignmentId: extensionTarget.id,
          });
        }
        showSuccess(t("assignment.extension.granted"), when);
      } else {
        await grantStudentExtension(extensionTarget.id, extStudentId, iso);
        await notifyStudent({
          recipientStudentId: extStudentId,
          type: "assignment_due",
          title: "Deadline Extended",
          message: `Your deadline for "${extensionTarget.title}" has been extended to ${when}.`,
          relatedAssignmentId: extensionTarget.id,
        });
        const name = students.find((s) => s.id === extStudentId)?.full_name ?? t("common.student");
        showSuccess(t("assignment.extension.granted"), name);
      }

      setExtensionTarget(null);
      await reload();
      if (open?.id === extensionTarget.id) await refreshOpen();
    } catch (e) {
      showError(t("assignments.createFailed"), e);
    } finally {
      setExtSaving(false);
    }
  };

  const openGrade = (sub: AssignmentSubmission) => {
    setGrading(sub);
    setScore(
      sub.score != null
        ? String(sub.score)
        : sub.ai_score != null
          ? String(sub.ai_score)
          : "",
    );
    setFeedback(sub.teacher_feedback || sub.ai_feedback || "");
  };

  const submitGrade = async () => {
    if (!grading || !open) return;
    const value = Number(score);
    const max = open.max_score ?? 10;
    if (Number.isNaN(value) || value < 0 || value > max) {
      showError(t("assignments.invalidScore"), new Error(`${t("assignments.scoreRange")} 0–${max}.`));
      return;
    }
    setSavingGrade(true);
    try {
      await gradeSubmission(grading.id, value, feedback.trim());
      await notifyStudent({
        recipientStudentId: grading.student_id,
        type: "graded",
        title: `Graded: ${open.title}`,
        message: `You scored ${value}${open.max_score ? `/${open.max_score}` : ""} on "${open.title}"`,
        relatedAssignmentId: open.id,
        relatedSubmissionId: grading.id,
      });
      setGrading(null);
      setScore("");
      setFeedback("");
      await refreshOpen();
      showSuccess(t("assignments.graded"), `${t("assignments.savedScore")} ${value}/${max}`);
    } catch (e) {
      showError(t("assignments.gradeFailed"), e);
    } finally {
      setSavingGrade(false);
    }
  };

  const runAiGrade = async (sub: AssignmentSubmission) => {
    if (!open) return;
    if (!sub.file_url) {
      showError(t("assignment.action.aiGrade"), new Error("No file attached to this submission."));
      return;
    }
    setAiBusyId(sub.id);
    try {
      const result = await gradeSubmissionWithAI(sub, open, sub.student_name || "Learner");
      if (result.success) {
        await saveAiGrading(sub.id, result.score, result.feedback);
        showSuccess(t("assignment.action.aiGrade"), `${t("assignments.score")} ${result.score}`);
        await refreshOpen();
      } else {
        showError(t("assignment.action.aiGrade"), new Error(result.error || "AI grading failed"));
      }
    } catch (e) {
      showError(t("assignment.action.aiGrade"), e);
    } finally {
      setAiBusyId(null);
    }
  };

  const runBatchAi = async () => {
    if (!open) return;
    const toGrade = subs.filter((s) => !s.ai_graded_at && s.file_url);
    if (!toGrade.length) {
      showSuccess(t("assignment.grading.nothingToGrade"), t("assignment.grading.allAiGraded"));
      return;
    }
    setBatchProgress(`0 / ${toGrade.length}`);
    try {
      const result = await batchGradeSubmissions(toGrade, open, (done, total, name) => {
        setBatchProgress(`${done} / ${total} · ${name}`);
      });
      showSuccess(
        t("assignment.grading.batchComplete"),
        `${result.graded} graded, ${result.failed} failed.`,
      );
      await refreshOpen();
    } catch (e) {
      showError(t("assignment.action.batchAiGrade"), e);
    } finally {
      setBatchProgress(null);
    }
  };

  const handleReturn = async (sub: AssignmentSubmission) => {
    if (!open) return;
    setActionBusy(true);
    try {
      await returnSubmission(
        sub.id,
        sub.score,
        feedback || sub.teacher_feedback || "Please revise and resubmit your work.",
      );
      await notifyStudent({
        recipientStudentId: sub.student_id,
        type: "resubmit_request",
        title: `Revision needed: ${open.title}`,
        message: "Your teacher has returned your submission for revision.",
        relatedAssignmentId: open.id,
        relatedSubmissionId: sub.id,
      });
      showSuccess(t("assignment.grading.returned"), t("assignment.grading.submissionReturned"));
      await refreshOpen();
    } catch (e) {
      showError(t("assignments.gradeFailed"), e);
    } finally {
      setActionBusy(false);
    }
  };

  const handleAllowResubmit = async (sub: AssignmentSubmission) => {
    if (!open) return;
    setActionBusy(true);
    try {
      await returnSubmission(sub.id, null, "You may resubmit your work.");
      await notifyStudent({
        recipientStudentId: sub.student_id,
        type: "resubmit_request",
        title: `Resubmit: ${open.title}`,
        message: "You can now resubmit your work.",
        relatedAssignmentId: open.id,
        relatedSubmissionId: sub.id,
      });
      showSuccess(t("assignment.action.allowResubmit"), t("assignment.grading.resubmissionAllowed"));
      await refreshOpen();
    } catch (e) {
      showError(t("assignments.gradeFailed"), e);
    } finally {
      setActionBusy(false);
    }
  };

  const postComment = async () => {
    if (!open || !newComment.trim()) return;
    setPostingComment(true);
    try {
      const created = await addTeacherComment(open.id, newComment.trim());
      setComments((prev) => [...prev, created]);
      setNewComment("");
    } catch (e) {
      showError(t("assignments.createFailed"), e);
    } finally {
      setPostingComment(false);
    }
  };

  const removeComment = (c: AssignmentComment) => {
    confirmDelete(c.message.slice(0, 40), async () => {
      try {
        await deleteComment(c.id);
        setComments((prev) => prev.filter((x) => x.id !== c.id));
      } catch (e) {
        showError(t("assignments.deleteFailed"), e);
      }
    });
  };

  const exportCsv = async () => {
    try {
      const csv = buildAssignmentsCsv(visible.length ? visible : items);
      const stamp = new Date().toISOString().slice(0, 10);
      await shareTextFile(`assignments_${stamp}.csv`, csv);
      showSuccess(t("assignment.action.exportCsv"), t("assignment.export.success"));
    } catch (e) {
      showError(t("common.export"), e);
    }
  };

  const openUrl = async (url: string | null | undefined) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch (e) {
      showError(t("common.error"), e);
    }
  };

  const pickAttachment = async (kind: "doc" | "image") => {
    const file = kind === "doc" ? await pickDocumentForUpload() : await pickImageForUpload();
    if (file) setPickedFile(file);
  };

  return (
    <DashboardShell
      title={t("sidebar.assignments")}
      subtitle={`${stats?.activeAssignments ?? items.length} ${t("assignment.stats.active").toLowerCase()}`}
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("assignments.loadFailed"), e);
        } finally {
          setRefreshing(false);
        }
      }}
      search={{
        value: query,
        onChangeText: setQuery,
        placeholder: t("assignment.searchPlaceholder"),
      }}
      headerRight={
        <View style={styles.headerActions}>
          <IconButton
            accessibilityLabel={t("assignment.action.exportCsv")}
            onPress={() => void exportCsv()}
            tone="brand"
          >
            <Download size={18} color={colors.brandDeep} />
          </IconButton>
          <IconButton
            accessibilityLabel={t("assignments.create")}
            onPress={openCreate}
            tone="brand"
          >
            <Plus size={20} color={colors.brandDeep} />
          </IconButton>
        </View>
      }
    >
      <StatStrip
        items={[
          { label: t("assignment.stats.active"), value: stats?.activeAssignments ?? 0 },
          { label: t("assignment.stats.overdue"), value: stats?.overdueAssignments ?? 0 },
          { label: t("assignment.stats.submissions"), value: stats?.totalSubmissions ?? 0 },
          { label: t("assignment.progress.pending"), value: stats?.pendingGrades ?? 0 },
        ]}
      />

      <OptionGroup<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: t("assignment.tabs.all") },
          { value: "active", label: t("assignment.tabs.active") },
          { value: "overdue", label: t("assignment.tabs.overdue") },
          { value: "draft", label: t("assignment.tabs.drafts") },
          { value: "closed", label: t("assignment.tabs.closed") },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={24} color={colors.brandDeep} />}
          title={items.length === 0 ? t("assignments.noneYet") : t("assignment.empty.title")}
          subtitle={
            items.length === 0 ? t("assignment.empty.start") : t("assignment.empty.adjust")
          }
          actionLabel={items.length === 0 ? t("assignment.empty.createFirst") : undefined}
          onAction={items.length === 0 ? openCreate : undefined}
        />
      ) : (
        visible.map((a) => {
          const status = normalizeStatus(a.status);
          const due = a.due_date ? new Date(a.due_date) : null;
          const past = !!due && due.getTime() < Date.now();
          const accent =
            status === "draft"
              ? colors.blue
              : status === "closed"
                ? colors.gray400
                : past
                  ? colors.danger
                  : colors.emerald;
          return (
            <Card
              key={a.id}
              onPress={() => void openAssignment(a)}
              onLongPress={() => setMenuTarget(a)}
              accent={accent}
            >
              <View style={styles.cardTop}>
                <IconTile size={40}>
                  <ClipboardList size={19} color={colors.brandDeep} />
                </IconTile>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodySm" weight="bold" numberOfLines={2}>
                    {a.title}
                  </Text>
                  {a.description ? (
                    <Text
                      variant="micro"
                      color={colors.textMuted}
                      numberOfLines={2}
                      style={{ marginTop: 2 }}
                    >
                      {a.description}
                    </Text>
                  ) : null}
                </View>
                <IconButton
                  accessibilityLabel={t("assignment.action.edit")}
                  onPress={() => setMenuTarget(a)}
                  tone="neutral"
                >
                  <MoreHorizontal size={18} color={colors.textSecondary} />
                </IconButton>
              </View>
              <View style={styles.badges}>
                <Badge label={statusLabel(status, t)} tone={statusTone(status)} />
                {status === "active" && past ? (
                  <Badge label={t("assignment.status.overdue")} tone="danger" />
                ) : null}
                {due ? (
                  <Badge
                    label={`${t("assignment.dueDate")} ${due.toLocaleDateString(locale, {
                      month: "short",
                      day: "numeric",
                    })}`}
                    tone={past && status === "active" ? "warning" : "brand"}
                    icon={
                      <Calendar
                        size={11}
                        color={past && status === "active" ? colors.amberText : colors.brandDeep}
                      />
                    }
                  />
                ) : null}
                <Badge
                  label={`${a.assignedStudentIds.length} ${t("assignment.card.students")}`}
                  tone="outline"
                />
                <Badge
                  label={`${a.submissionCount} ${t("assignment.card.submissions")}`}
                  tone="outline"
                />
                <Badge
                  label={`${t("assignment.card.maxPts")} ${a.max_score ?? 10}`}
                  tone="outline"
                />
              </View>
            </Card>
          );
        })
      )}

      {/* Create / Edit */}
      <Sheet
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t("assignment.editAssignment") : t("assignment.createNew")}
        subtitle={
          editing ? t("assignment.form.updateDetails") : t("assignment.form.designEngaging")
        }
        footer={
          <Button
            label={editing ? t("assignment.form.saveChanges") : t("assignment.form.createAndAssign")}
            onPress={submitForm}
            loading={savingForm}
          />
        }
      >
        <Input
          label={t("assignment.form.assignmentTitle")}
          value={form.title}
          onChangeText={(v) => {
            setForm((p) => ({ ...p, title: v }));
            if (titleError) setTitleError(null);
          }}
          placeholder={t("assignment.form.titlePlaceholder")}
          error={titleError}
          required
        />
        <Input
          label={t("assignment.description")}
          value={form.description}
          onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
          placeholder={t("assignment.form.descPlaceholder")}
          multiline
        />
        <Input
          label={t("assignment.instructions")}
          value={form.instructions}
          onChangeText={(v) => setForm((p) => ({ ...p, instructions: v }))}
          placeholder={t("assignment.form.instructionsPlaceholder")}
          multiline
        />
        <Input
          label={t("assignment.form.subject")}
          value={form.subject}
          onChangeText={(v) => setForm((p) => ({ ...p, subject: v }))}
        />
        <Select
          label={t("assignment.form.gradeLevel")}
          value={form.gradeLevel}
          onChange={(v) => setForm((p) => ({ ...p, gradeLevel: v }))}
          options={GRADE_LEVELS.map((g) => ({ value: g, label: g }))}
        />
        <Select
          label={t("assignment.status")}
          value={form.status}
          onChange={(v) => setForm((p) => ({ ...p, status: v as FormStatus }))}
          options={[
            { value: "active", label: t("assignment.status.active") },
            { value: "draft", label: t("assignment.status.draft") },
            { value: "closed", label: t("assignment.status.closed") },
          ]}
        />
        <Select
          label={t("assignments.dueIn")}
          value={form.dueIn}
          onChange={(v) => setForm((p) => ({ ...p, dueIn: v, dueDateStr: "" }))}
          options={DUE_OFFSETS.map((d) => ({
            value: d,
            label: `${d} ${t("assignments.days")}`,
          }))}
        />
        <Input
          label={`${t("assignment.dueDate")} (YYYY-MM-DD)`}
          value={form.dueDateStr}
          onChangeText={(v) => setForm((p) => ({ ...p, dueDateStr: v }))}
          placeholder="2026-08-22"
        />
        <Input
          label={t("assignment.form.time")}
          value={form.dueTime}
          onChangeText={(v) => setForm((p) => ({ ...p, dueTime: v }))}
          placeholder="23:59"
        />
        <Input
          label={t("assignment.form.maxScoreLabel")}
          value={form.maxScore}
          onChangeText={(v) => setForm((p) => ({ ...p, maxScore: v }))}
          keyboardType="numeric"
        />

        <View style={styles.attachRow}>
          <Text variant="caption" weight="semibold" color={colors.textSecondary}>
            {t("assignment.form.attachment")}
          </Text>
          <View style={styles.attachBtns}>
            <Button
              label={t("assignment.form.attachFile")}
              variant="secondary"
              size="sm"
              fullWidth={false}
              icon={<Paperclip size={14} color={colors.brandDeep} />}
              onPress={() => void pickAttachment("doc")}
            />
            <Button
              label="Image"
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => void pickAttachment("image")}
            />
          </View>
          {pickedFile ? (
            <Text variant="micro" color={colors.textMuted}>
              {pickedFile.name}
            </Text>
          ) : editing?.attachment_url ? (
            <Pressable onPress={() => void openUrl(editing.attachment_url)}>
              <Text variant="micro" color={colors.brandDeep}>
                {t("assignment.form.currentAttachment")}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Input
          label={t("assignment.form.searchStudents")}
          value={studentSearch}
          onChangeText={setStudentSearch}
          placeholder={t("assignment.form.searchStudents")}
        />
        <View style={styles.selectAllRow}>
          <Pressable
            onPress={() =>
              setForm((p) => ({ ...p, selectedStudentIds: students.map((s) => s.id) }))
            }
          >
            <Text variant="caption" weight="semibold" color={colors.brandDeep}>
              {t("common.selectAll")}
            </Text>
          </Pressable>
          <Pressable onPress={() => setForm((p) => ({ ...p, selectedStudentIds: [] }))}>
            <Text variant="caption" weight="semibold" color={colors.textMuted}>
              {t("common.none")}
            </Text>
          </Pressable>
          <Text variant="micro" color={colors.textMuted}>
            {form.selectedStudentIds.length}/{students.length}
          </Text>
        </View>
        {filteredStudents.length === 0 ? (
          <Text variant="caption" color={colors.textMuted}>
            {t("assignment.form.noStudentsFound")}
          </Text>
        ) : (
          filteredStudents.map((s) => {
            const selected = form.selectedStudentIds.includes(s.id);
            return (
              <Pressable
                key={s.id}
                onPress={() => toggleStudent(s.id)}
                style={[styles.studentRow, selected && styles.studentRowOn]}
              >
                <Avatar name={s.full_name} size={28} letters={2} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="caption" weight="semibold" numberOfLines={1}>
                    {s.full_name}
                  </Text>
                  <Text variant="micro" color={colors.textMuted} numberOfLines={1}>
                    {[s.grade_level, s.class_name].filter(Boolean).join(" · ") || "—"}
                  </Text>
                </View>
                {selected ? <Check size={16} color={colors.brandDeep} /> : null}
              </Pressable>
            );
          })
        )}
      </Sheet>

      {/* Card actions */}
      <Sheet
        visible={!!menuTarget}
        onClose={() => setMenuTarget(null)}
        title={menuTarget?.title}
        subtitle={t("assignment.action.editDetails")}
      >
        {menuTarget ? (
          <>
            <SheetAction
              label={t("assignment.action.edit")}
              onPress={() => openEdit(menuTarget)}
            />
            <SheetAction
              label={t("assignment.action.duplicate")}
              hint={t("assignment.action.duplicateAsDraft")}
              icon={<Copy size={18} color={colors.brandDeep} />}
              onPress={() => void handleDuplicate(menuTarget)}
            />
            {normalizeStatus(menuTarget.status) === "draft" ? (
              <SheetAction
                label={t("assignment.action.publish")}
                onPress={() => void setStatus(menuTarget, "active")}
              />
            ) : null}
            {normalizeStatus(menuTarget.status) === "active" ? (
              <SheetAction
                label={t("assignment.action.close")}
                onPress={() => void setStatus(menuTarget, "closed")}
              />
            ) : null}
            {normalizeStatus(menuTarget.status) === "closed" ? (
              <SheetAction
                label={t("assignment.action.reopen")}
                onPress={() => void setStatus(menuTarget, "active")}
              />
            ) : null}
            <SheetAction
              label={t("assignment.extension.title")}
              hint={t("assignment.extension.desc")}
              icon={<Calendar size={18} color={colors.brandDeep} />}
              onPress={() => openExtension(menuTarget)}
            />
            <SheetAction
              label={t("common.delete")}
              icon={<Trash2 size={18} color={colors.dangerText} />}
              onPress={() => handleDelete(menuTarget)}
            />
          </>
        ) : null}
      </Sheet>

      {/* Detail */}
      <Sheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open?.title}
        subtitle={
          open?.due_date
            ? `${t("assignment.dueDate")} ${new Date(open.due_date).toLocaleString(locale)}`
            : undefined
        }
      >
        {open ? (
          <>
            <OptionGroup<DetailTab>
              value={detailTab}
              onChange={setDetailTab}
              options={[
                { value: "details", label: t("assignment.action.view") },
                { value: "submissions", label: t("assignment.action.grade") },
                { value: "discussion", label: t("assignment.action.discuss") },
              ]}
            />

            {detailTab === "details" ? (
              <View style={styles.tabBody}>
                {open.description ? (
                  <ListRow title={t("assignment.description")} subtitle={open.description} />
                ) : null}
                {open.instructions ? (
                  <ListRow title={t("assignment.instructions")} subtitle={open.instructions} />
                ) : null}
                {open.attachment_url ? (
                  <SheetAction
                    label={t("assignment.attachments")}
                    hint={t("assignment.form.currentAttachment")}
                    icon={<ExternalLink size={18} color={colors.brandDeep} />}
                    onPress={() => void openUrl(open.attachment_url)}
                  />
                ) : null}
                <ListRow
                  title={t("assignment.assignedStudents")}
                  subtitle={`${open.assignedStudentIds.length} ${t("assignment.card.students")}`}
                />
                <ListRow
                  title={t("assignment.maxScore")}
                  subtitle={String(open.max_score ?? 10)}
                />
                {open.due_date ? (
                  <ListRow
                    title={t("assignment.dueDate")}
                    subtitle={new Date(open.due_date).toLocaleString(locale)}
                  />
                ) : null}
                <Text variant="caption" weight="semibold" style={{ marginTop: space.sm }}>
                  {t("assignment.notSubmitted")}
                </Text>
                {subsLoading ? (
                  <Skeleton height={40} />
                ) : unsubmitted.length === 0 ? (
                  <Text variant="micro" color={colors.textMuted}>
                    {t("assignment.grading.waitingSubmit")}
                  </Text>
                ) : (
                  unsubmitted.map((s) => (
                    <ListRow key={s.id} title={s.full_name} subtitle={s.grade_level ?? undefined} />
                  ))
                )}
              </View>
            ) : null}

            {detailTab === "submissions" ? (
              <View style={styles.tabBody}>
                <Button
                  label={
                    batchProgress
                      ? `${t("assignment.grading.aiGradingProgress")} ${batchProgress}`
                      : t("assignment.action.batchAiGrade")
                  }
                  variant="secondary"
                  icon={<Sparkles size={16} color={colors.brandDeep} />}
                  onPress={() => void runBatchAi()}
                  loading={!!batchProgress}
                  disabled={actionBusy}
                />
                {subsLoading ? (
                  <View style={{ gap: space.sm }}>
                    <Skeleton height={54} />
                    <Skeleton height={54} />
                  </View>
                ) : subs.length === 0 ? (
                  <View style={styles.emptySubs}>
                    <Users size={20} color={colors.textMuted} />
                    <Text variant="caption" color={colors.textMuted} center>
                      {t("assignment.grading.noSubmissions")}
                    </Text>
                  </View>
                ) : (
                  subs.map((sub) => {
                    const graded = sub.status === "graded" || sub.status === "returned";
                    return (
                      <View key={sub.id} style={styles.subBlock}>
                        <SheetAction
                          label={sub.student_name ?? t("common.student")}
                          hint={
                            graded
                              ? `${sub.status} · ${sub.score ?? "—"}/${open.max_score ?? 10}${
                                  sub.ai_score != null ? ` · AI ${sub.ai_score}` : ""
                                }`
                              : t("assignments.tapToGrade")
                          }
                          icon={
                            graded ? (
                              <CheckCircle2 size={18} color={colors.emeraldText} />
                            ) : (
                              <Avatar name={sub.student_name} size={30} letters={2} />
                            )
                          }
                          onPress={() => openGrade(sub)}
                        />
                        <View style={styles.subActions}>
                          {sub.file_url ? (
                            <Button
                              label="File"
                              size="sm"
                              variant="ghost"
                              fullWidth={false}
                              icon={<ExternalLink size={14} color={colors.brandDeep} />}
                              onPress={() => void openUrl(sub.file_url)}
                            />
                          ) : null}
                          <Button
                            label={t("assignment.action.aiGrade")}
                            size="sm"
                            variant="secondary"
                            fullWidth={false}
                            loading={aiBusyId === sub.id}
                            onPress={() => void runAiGrade(sub)}
                          />
                          <Button
                            label={t("assignment.action.return")}
                            size="sm"
                            variant="ghost"
                            fullWidth={false}
                            disabled={actionBusy}
                            onPress={() => void handleReturn(sub)}
                          />
                          <Button
                            label={t("assignment.action.allowResubmit")}
                            size="sm"
                            variant="ghost"
                            fullWidth={false}
                            disabled={actionBusy}
                            onPress={() => void handleAllowResubmit(sub)}
                          />
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}

            {detailTab === "discussion" ? (
              <View style={styles.tabBody}>
                {commentsLoading ? (
                  <Skeleton height={54} />
                ) : comments.length === 0 ? (
                  <Text variant="caption" color={colors.textMuted}>
                    {t("assignment.action.discussThread")}
                  </Text>
                ) : (
                  comments.map((c) => (
                    <View key={c.id} style={styles.commentRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text variant="caption" weight="bold">
                          {c.author_name}
                        </Text>
                        <Text
                          variant="caption"
                          style={{ marginTop: 2, fontFamily: fonts.regular }}
                        >
                          {c.message}
                        </Text>
                        <Text variant="micro" color={colors.textMuted} style={{ marginTop: 4 }}>
                          {new Date(c.created_at).toLocaleString(locale)}
                        </Text>
                      </View>
                      {c.teacher_id && c.teacher_id === user?.id ? (
                        <IconButton
                          accessibilityLabel={t("common.delete")}
                          onPress={() => removeComment(c)}
                          tone="neutral"
                        >
                          <Trash2 size={16} color={colors.dangerText} />
                        </IconButton>
                      ) : null}
                    </View>
                  ))
                )}
                <Input
                  label={t("admin.comments")}
                  value={newComment}
                  onChangeText={setNewComment}
                  placeholder={t("assignment.form.instructionsPlaceholder")}
                  multiline
                />
                <Button
                  label={t("common.save")}
                  onPress={() => void postComment()}
                  loading={postingComment}
                />
              </View>
            ) : null}
          </>
        ) : null}
      </Sheet>

      {/* Grade */}
      <Sheet
        visible={!!grading}
        onClose={() => setGrading(null)}
        title={grading?.student_name ?? t("common.student")}
        subtitle={open?.title}
        footer={
          <Button
            label={t("assignment.grading.saveAndSend")}
            onPress={submitGrade}
            loading={savingGrade}
          />
        }
      >
        <Input
          label={`${t("assignments.score")} (0–${open?.max_score ?? 10})`}
          value={score}
          onChangeText={setScore}
          keyboardType="numeric"
          placeholder="0"
          required
        />
        <Input
          label={t("assignment.grading.feedbackForStudent")}
          value={feedback}
          onChangeText={setFeedback}
          placeholder={t("assignments.feedbackPlaceholder")}
          multiline
        />
        {grading?.ai_feedback ? (
          <View style={styles.aiBox}>
            <Text variant="caption" weight="semibold" color={colors.brandDeep}>
              {t("assignment.grading.aiAnalysis")}
              {grading.ai_score != null ? ` · ${grading.ai_score}` : ""}
            </Text>
            <RichText source={grading.ai_feedback} />
          </View>
        ) : null}
        {grading?.notes ? (
          <ListRow title="Student notes" subtitle={grading.notes} />
        ) : null}
        {grading?.submitted_at ? (
          <ListRow
            title={t("assignments.submittedOn")}
            subtitle={new Date(grading.submitted_at).toLocaleString(locale)}
          />
        ) : null}
      </Sheet>

      {/* Extension */}
      <Sheet
        visible={!!extensionTarget}
        onClose={() => setExtensionTarget(null)}
        title={t("assignment.extension.title")}
        subtitle={extensionTarget?.title}
        footer={
          <Button
            label={t("assignment.extension.granted")}
            onPress={submitExtension}
            loading={extSaving}
          />
        }
      >
        <Select
          label={t("assignment.extension.student")}
          value={extStudentId}
          onChange={setExtStudentId}
          options={[
            { value: "__all__", label: t("common.all") },
            ...students
              .filter((s) => extensionTarget?.assignedStudentIds.includes(s.id))
              .map((s) => ({ value: s.id, label: s.full_name })),
          ]}
        />
        <Select
          label={t("assignments.dueIn")}
          value={extOffset}
          onChange={(v) => {
            setExtOffset(v);
            setExtDateStr("");
          }}
          options={EXT_OFFSETS.map((d) => ({
            value: d,
            label: `${d} ${t("assignments.days")}`,
          }))}
        />
        <Input
          label={`${t("assignment.extension.newDeadline")} (YYYY-MM-DD)`}
          value={extDateStr}
          onChangeText={setExtDateStr}
          placeholder="2026-08-22"
        />
      </Sheet>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.md },
  emptySubs: {
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.xl,
    borderRadius: radius.md,
    backgroundColor: colors.gray50,
  },
  attachRow: { gap: space.sm, marginBottom: space.sm },
  attachBtns: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  selectAllRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginBottom: space.sm,
  },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 10,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  studentRowOn: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  tabBody: { gap: space.sm, marginTop: space.sm },
  subBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.sm,
    marginBottom: space.sm,
    gap: 6,
  },
  subActions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  aiBox: {
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    padding: space.md,
    gap: space.sm,
  },
});
