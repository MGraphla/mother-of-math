import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  Calendar,
  Camera,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  GraduationCap,
  ImageIcon,
  MessageCircle,
  Upload,
} from "lucide-react-native";
import { useLanguage } from "../../../src/context/LanguageContext";
import {
  pickDocumentForUpload,
  pickImageForUpload,
  takePhotoForUpload,
  type PickedFile,
} from "../../../src/native/uploads";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  addStudentComment,
  listCommentsForStudent,
  type AssignmentComment,
} from "../../../src/services/assignmentComments";
import {
  listStudentAssignments,
  listStudentSubmissions,
  resolveActiveStudentSession,
  submitAssignmentFile,
} from "../../../src/services/studentPortal";
import { colors, radius, space } from "../../../src/theme/tokens";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconTile,
  Input,
  OptionGroup,
  RichText,
  Sheet,
  SheetAction,
  StatStrip,
  Text,
  showError,
  showSuccess,
} from "../../../src/ui";

interface Submission {
  id: string;
  assignment_id: string;
  status: string | null;
  score: number | null;
  ai_score?: number | null;
  submitted_at: string | null;
  teacher_feedback: string | null;
  ai_feedback?: string | null;
  notes?: string | null;
  file_url?: string | null;
}

interface AssignmentItem {
  id: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  attachment_url?: string | null;
  due_date: string | null;
  max_score?: number | null;
  subject?: string | null;
  status?: string | null;
  submission?: Submission;
}

type Tab = "todo" | "submitted" | "graded" | "late";

export default function StudentAssignmentsScreen() {
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [items, setItems] = useState<AssignmentItem[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("todo");

  const [open, setOpen] = useState<AssignmentItem | null>(null);
  const [sourceFor, setSourceFor] = useState<AssignmentItem | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [comments, setComments] = useState<AssignmentComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [detailTab, setDetailTab] = useState<"work" | "discuss">("work");

  const reload = useCallback(async () => {
    const session = await resolveActiveStudentSession();
    if (!session) {
      setItems([]);
      setStudentId(null);
      return;
    }
    setStudentId(session.id);
    const [assignments, submissions] = await Promise.all([
      listStudentAssignments(session.id),
      listStudentSubmissions(session.id),
    ]);
    const byAssignment = new Map(
      (submissions as Submission[]).map((s) => [s.assignment_id, s]),
    );
    setItems(
      (assignments as AssignmentItem[]).map((a) => ({
        ...a,
        submission: byAssignment.get(a.id),
      })),
    );
  }, []);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("student.assignmentsLoadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const buckets = useMemo(() => {
    const todo: AssignmentItem[] = [];
    const submitted: AssignmentItem[] = [];
    const graded: AssignmentItem[] = [];
    const late: AssignmentItem[] = [];
    const now = Date.now();
    for (const item of items) {
      const due = item.due_date ? new Date(item.due_date).getTime() : null;
      const submittedLate =
        !!due &&
        !!item.submission?.submitted_at &&
        new Date(item.submission.submitted_at).getTime() > due;
      const missingOverdue = !!due && due < now && !item.submission;

      if (item.submission?.status === "graded") {
        graded.push(item);
        if (submittedLate) late.push(item);
      } else if (item.submission?.status === "returned") {
        todo.push(item);
        if (missingOverdue || submittedLate) late.push(item);
      } else if (item.submission) {
        submitted.push(item);
        if (submittedLate) late.push(item);
      } else if (missingOverdue) {
        late.push(item);
        todo.push(item);
      } else {
        todo.push(item);
      }
    }
    const byDue = (a: AssignmentItem, b: AssignmentItem) =>
      new Date(a.due_date ?? 0).getTime() - new Date(b.due_date ?? 0).getTime();
    return {
      todo: todo.sort(byDue),
      submitted: submitted.sort(byDue),
      graded: graded.sort(byDue),
      late: late.sort(byDue),
    };
  }, [items]);

  const visible = buckets[tab];

  const averages = useMemo(() => {
    const scores = items
      .map((i) => i.submission?.score)
      .filter((s): s is number => typeof s === "number");
    if (!scores.length) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [items]);

  const openDetail = async (item: AssignmentItem) => {
    setOpen(item);
    setDetailTab("work");
    setCommentDraft("");
    if (!studentId) return;
    try {
      setComments(await listCommentsForStudent(item.id, studentId));
    } catch {
      setComments([]);
    }
  };

  const submit = async (item: AssignmentItem, pick: () => Promise<PickedFile | null>) => {
    if (!studentId) return;
    setSourceFor(null);
    const file = await pick();
    if (!file?.uri) return;
    setSubmitting(true);
    try {
      await submitAssignmentFile({
        assignmentId: item.id,
        studentId,
        uri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType,
        notes,
      });
      setNotes("");
      setOpen(null);
      await reload();
      setTab("submitted");
      showSuccess(t("student.submitted"), t("student.submittedHint"));
    } catch (e) {
      showError(t("student.submitFailed"), e);
    } finally {
      setSubmitting(false);
    }
  };

  const postComment = async () => {
    if (!open || !studentId || !commentDraft.trim()) return;
    setCommentBusy(true);
    try {
      await addStudentComment(open.id, studentId, commentDraft.trim());
      setCommentDraft("");
      setComments(await listCommentsForStudent(open.id, studentId));
      showSuccess(t("common.success"), t("assignment.action.discuss"));
    } catch (e) {
      showError(t("common.error"), e);
    } finally {
      setCommentBusy(false);
    }
  };

  const canSubmit = (item: AssignmentItem | null) => {
    if (!item) return false;
    if (!item.submission) return true;
    return item.submission.status === "returned";
  };

  return (
    <DashboardShell
      title={t("sidebar.assignments")}
      subtitle={`${items.length} ${t("student.totalAssigned").toLowerCase()}`}
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("student.assignmentsLoadFailed"), e);
        } finally {
          setRefreshing(false);
        }
      }}
    >
      {!studentId && !loading ? (
        <EmptyState
          icon={<GraduationCap size={24} color={colors.brandDeep} />}
          title={t("auth.studentSignIn")}
          subtitle={t("student.needTokenHint")}
          actionLabel={t("mobile.studentAccess")}
          onAction={() => router.replace("/(auth)/student-login")}
        />
      ) : (
        <>
          <StatStrip
            items={[
              { label: t("student.toDo"), value: buckets.todo.length },
              { label: t("status.graded"), value: buckets.graded.length },
              { label: t("assignment.late"), value: buckets.late.length },
              { label: t("assignment.stats.avgScore"), value: averages ?? "—" },
            ]}
          />

          <OptionGroup<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "todo", label: `${t("student.toDo")} (${buckets.todo.length})` },
              {
                value: "submitted",
                label: `${t("status.submitted")} (${buckets.submitted.length})`,
              },
              { value: "graded", label: `${t("status.graded")} (${buckets.graded.length})` },
              { value: "late", label: `${t("assignment.late")} (${buckets.late.length})` },
            ]}
          />

          {visible.length === 0 ? (
            <EmptyState
              icon={
                tab === "todo" ? (
                  <CheckCircle2 size={24} color={colors.emeraldText} />
                ) : (
                  <ClipboardList size={24} color={colors.brandDeep} />
                )
              }
              title={tab === "todo" ? t("student.allCaughtUp") : t("common.noData")}
              subtitle={tab === "todo" ? t("student.noPendingAssignments") : undefined}
            />
          ) : (
            visible.map((item) => {
              const due = item.due_date ? new Date(item.due_date) : null;
              const overdue = !!due && due.getTime() < Date.now() && !item.submission;
              const graded = item.submission?.status === "graded";
              const returned = item.submission?.status === "returned";
              return (
                <Card
                  key={item.id}
                  onPress={() => void openDetail(item)}
                  accent={
                    overdue || returned
                      ? colors.danger
                      : graded
                        ? colors.emerald
                        : colors.brand
                  }
                >
                  <View style={styles.row}>
                    <IconTile
                      size={40}
                      bg={overdue || returned ? colors.dangerSoft : colors.brandSoft}
                    >
                      <ClipboardList
                        size={19}
                        color={
                          overdue || returned ? colors.dangerText : colors.brandDeep
                        }
                      />
                    </IconTile>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodySm" weight="bold" numberOfLines={2}>
                        {item.title}
                      </Text>
                      {due ? (
                        <View style={styles.meta}>
                          <Calendar size={13} color={colors.textMuted} />
                          <Text variant="micro" weight="medium" color={colors.textMuted}>
                            {`${t("student.dueDate")} ${due.toLocaleDateString(locale, {
                              month: "short",
                              day: "numeric",
                            })}`}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {graded ? (
                      <View style={styles.scorePill}>
                        <Text variant="caption" weight="bold" tabular color={colors.emeraldText}>
                          {`${item.submission?.score ?? 0}`}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.badges}>
                    {overdue ? <Badge label={t("status.overdue")} tone="danger" /> : null}
                    {returned ? (
                      <Badge label={t("assignment.action.return")} tone="warning" />
                    ) : null}
                    {item.submission && !returned ? (
                      <Badge
                        label={graded ? t("status.graded") : t("status.submitted")}
                        tone={graded ? "success" : "info"}
                      />
                    ) : !returned ? (
                      <Badge label={t("student.notSubmitted")} tone="warning" />
                    ) : null}
                    {item.max_score ? (
                      <Badge
                        label={`${t("assignments.maxScore")} ${item.max_score}`}
                        tone="outline"
                      />
                    ) : null}
                  </View>
                </Card>
              );
            })
          )}
        </>
      )}

      <Sheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open?.title}
        subtitle={
          open?.due_date
            ? `${t("student.dueDate")} ${new Date(open.due_date).toLocaleDateString(locale)}`
            : undefined
        }
        footer={
          open && canSubmit(open) ? (
            <Button
              label={
                open.submission?.status === "returned"
                  ? t("student.resubmit")
                  : t("student.submitWork")
              }
              onPress={() => setSourceFor(open)}
              loading={submitting}
              icon={<Upload size={18} color={colors.white} />}
            />
          ) : null
        }
      >
        {open ? (
          <>
            <OptionGroup<"work" | "discuss">
              value={detailTab}
              onChange={setDetailTab}
              options={[
                { value: "work", label: t("assignment.card.instructions") },
                { value: "discuss", label: t("assignment.action.discuss") },
              ]}
            />

            {detailTab === "work" ? (
              <>
                {open.description ? <RichText source={open.description} /> : null}
                {open.instructions ? (
                  <View style={styles.block}>
                    <Text variant="micro" weight="bold" color={colors.brandDeep} uppercase>
                      {t("assignment.instructions")}
                    </Text>
                    <View style={{ marginTop: 6 }}>
                      <RichText source={open.instructions} />
                    </View>
                  </View>
                ) : null}

                {open.attachment_url ? (
                  <SheetAction
                    label={t("assignment.attachments")}
                    hint={t("assignment.action.view")}
                    icon={<ExternalLink size={18} color={colors.textSecondary} />}
                    onPress={() => void Linking.openURL(open.attachment_url!)}
                  />
                ) : null}

                {open.submission ? (
                  <View style={styles.submissionBox}>
                    <Text variant="micro" weight="bold" color={colors.brandDeep} uppercase>
                      {t("student.yourSubmission")}
                    </Text>
                    <Text variant="caption" color={colors.textSecondary} style={{ marginTop: 6 }}>
                      {open.submission.submitted_at
                        ? `${t("assignments.submittedOn")} ${new Date(
                            open.submission.submitted_at,
                          ).toLocaleString(locale)}`
                        : t("status.submitted")}
                    </Text>
                    {open.submission.file_url ? (
                      <SheetAction
                        label={t("assignment.attachments")}
                        hint={t("assignment.action.view")}
                        icon={<ExternalLink size={18} color={colors.textSecondary} />}
                        onPress={() => void Linking.openURL(open.submission!.file_url!)}
                      />
                    ) : null}
                    {open.submission.status === "graded" ? (
                      <Text variant="bodySm" weight="bold" style={{ marginTop: space.sm }}>
                        {`${t("assignments.score")}: ${open.submission.score ?? 0}/${
                          open.max_score ?? 10
                        }`}
                      </Text>
                    ) : null}
                    {open.submission.teacher_feedback ? (
                      <View style={{ marginTop: space.md }}>
                        <Text variant="micro" weight="bold" color={colors.brandDeep} uppercase>
                          {t("student.teacherFeedback")}
                        </Text>
                        <View style={{ marginTop: 6 }}>
                          <RichText source={open.submission.teacher_feedback} />
                        </View>
                      </View>
                    ) : null}
                    {open.submission.ai_feedback ? (
                      <View style={{ marginTop: space.md }}>
                        <Text variant="micro" weight="bold" color={colors.brandDeep} uppercase>
                          {t("assignment.action.aiGrade")}
                        </Text>
                        <View style={{ marginTop: 6 }}>
                          <RichText source={open.submission.ai_feedback} />
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : (
              <>
                {comments.length === 0 ? (
                  <Text variant="caption" color={colors.textMuted} center>
                    {t("assignment.grading.noSubmissions")}
                  </Text>
                ) : (
                  comments.map((c) => (
                    <View key={c.id} style={styles.comment}>
                      <Text variant="micro" weight="bold">
                        {c.author_name}
                      </Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {c.message}
                      </Text>
                    </View>
                  ))
                )}
                <Input
                  label={t("assignment.action.discuss")}
                  value={commentDraft}
                  onChangeText={setCommentDraft}
                  placeholder="…"
                  multiline
                />
                <Button
                  label={t("common.submit")}
                  onPress={postComment}
                  loading={commentBusy}
                  icon={<MessageCircle size={18} color={colors.white} />}
                />
              </>
            )}
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={!!sourceFor}
        onClose={() => setSourceFor(null)}
        title={t("student.submitWork")}
        subtitle={t("student.submitHint")}
      >
        {sourceFor ? (
          <>
            <Input
              label={t("assignments.feedbackLabel")}
              value={notes}
              onChangeText={setNotes}
              placeholder={t("assignments.feedbackPlaceholder")}
              multiline
            />
            <SheetAction
              label={t("uploads.camera")}
              hint={t("student.cameraHint")}
              icon={<Camera size={18} color={colors.textSecondary} />}
              onPress={() => void submit(sourceFor, takePhotoForUpload)}
            />
            <SheetAction
              label={t("uploads.gallery")}
              hint={t("uploads.galleryHint")}
              icon={<ImageIcon size={18} color={colors.textSecondary} />}
              onPress={() => void submit(sourceFor, pickImageForUpload)}
            />
            <SheetAction
              label={t("uploads.document")}
              hint={t("uploads.documentHint")}
              icon={<FileText size={18} color={colors.textSecondary} />}
              onPress={() => void submit(sourceFor, pickDocumentForUpload)}
            />
          </>
        ) : null}
      </Sheet>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.md },
  scorePill: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.emeraldSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  submissionBox: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandMute,
    marginTop: space.md,
  },
  block: { marginTop: space.md },
  comment: {
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
});
