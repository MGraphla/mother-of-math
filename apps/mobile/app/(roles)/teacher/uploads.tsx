import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileDown,
  FileText,
  FolderOpen,
  HelpCircle,
  LayoutGrid,
  List,
  Save,
  SortAsc,
  SortDesc,
  Sparkles,
  Trash2,
  Upload as UploadIcon,
} from "lucide-react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { shareTextFile } from "../../../src/native/exportText";
import {
  pickDocumentForUpload,
  pickImageForUpload,
  takePhotoForUpload,
  type PickedFile,
} from "../../../src/native/uploads";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import { listStudentsForTeacher, type StudentRow } from "../../../src/services/students";
import {
  analyzeAndSaveStudentWork,
  deleteStudentWork,
  isWorkAnalyzed,
  isWorkError,
  isWorkPending,
  listStudentWorks,
  parseWorkFeedbackPanels,
  updateStudentWorkFeedback,
  updateStudentWorkFields,
  uploadStudentWorkFromUri,
  type StudentWorkRow,
} from "../../../src/services/uploads";
import { colors, layout, radius, space } from "../../../src/theme/tokens";
import {
  Badge,
  Button,
  IconButton,
  Input,
  RichText,
  Select,
  Sheet,
  SheetAction,
  Text,
  confirmDelete,
  showError,
  showSuccess,
} from "../../../src/ui";

type TabId = "upload" | "analyzed" | "pending" | "errors";
type ViewMode = "list" | "grid";

const isImage = (url: string, mime?: string | null) =>
  (mime?.startsWith("image/") ?? false) || /\.(png|jpe?g|gif|webp|heic)(\?|$)/i.test(url);

const gradeTone = (percent: number | null): "success" | "warning" | "danger" | "neutral" => {
  if (percent == null) return "neutral";
  if (percent >= 70) return "success";
  if (percent >= 50) return "warning";
  return "danger";
};

export default function TeacherUploadsScreen() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [items, setItems] = useState<StudentWorkRow[]>([]);
  const [sessionIds, setSessionIds] = useState<Set<string>>(new Set());
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [sourceOpen, setSourceOpen] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [tab, setTab] = useState<TabId>("upload");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState<StudentWorkRow | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftGrade, setDraftGrade] = useState("");
  const [draftStudentId, setDraftStudentId] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    const [works, roster] = await Promise.all([
      listStudentWorks(user.id),
      listStudentsForTeacher(user.id),
    ]);
    setItems(works);
    setStudents(roster);
  }, [user]);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("uploads.loadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const learnerOptions = useMemo(
    () => [
      { value: "", label: t("uploads.noLearner") },
      ...students.map((s) => ({
        value: s.id,
        label: s.grade_level ? `${s.full_name} (${s.grade_level})` : s.full_name,
      })),
    ],
    [students, t],
  );

  const stats = useMemo(() => {
    const analyzed = items.filter(isWorkAnalyzed);
    const pending = items.filter(isWorkPending);
    const errors = items.filter(isWorkError);
    const grades = analyzed
      .map((w) => (w.feedback ? parseWorkFeedbackPanels(w.feedback).scorePercent : null))
      .filter((g): g is number => g != null);
    const avg =
      grades.length > 0 ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : null;
    return {
      total: items.length,
      analyzed: analyzed.length,
      pending: pending.length,
      errors: errors.length,
      avg,
    };
  }, [items]);

  const sortedItems = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortAsc ? da - db : db - da;
    });
    return list;
  }, [items, sortAsc]);

  const sessionFiles = useMemo(
    () => sortedItems.filter((w) => sessionIds.has(w.id)),
    [sortedItems, sessionIds],
  );

  const filteredForTab = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list =
      tab === "upload"
        ? sessionFiles
        : tab === "analyzed"
          ? sortedItems.filter(isWorkAnalyzed)
          : tab === "pending"
            ? sortedItems.filter(isWorkPending)
            : sortedItems.filter(isWorkError);

    if (!q) return list;
    return list.filter((w) => {
      const hay = [w.student_name, w.subject, w.grade, w.file_name, w.error_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tab, sessionFiles, sortedItems, search]);

  const markAnalyzing = (id: string, on: boolean) => {
    setAnalyzingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runAnalysis = async (work: StudentWorkRow, notes?: string) => {
    markAnalyzing(work.id, true);
    try {
      const { work: updated } = await analyzeAndSaveStudentWork(work, notes);
      setItems((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      if (open?.id === updated.id) {
        setOpen(updated);
        setDraftNotes("");
      }
      return updated;
    } catch (e) {
      await updateStudentWorkFields(work.id, { status: "error" }).catch(() => null);
      setItems((prev) => prev.map((w) => (w.id === work.id ? { ...w, status: "error" } : w)));
      throw e;
    } finally {
      markAnalyzing(work.id, false);
    }
  };

  const upload = async (pick: () => Promise<PickedFile | null>) => {
    if (!user) return;
    setSourceOpen(false);
    const file = await pick();
    if (!file?.uri) return;
    setUploading(true);
    try {
      const row = await uploadStudentWorkFromUri({
        teacherId: user.id,
        uri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType,
        subject: "Mathematics",
      });
      setItems((prev) => [row, ...prev]);
      setSessionIds((prev) => new Set([row.id, ...prev]));
      setTab("upload");
      try {
        await runAnalysis(row);
      } catch (e) {
        showError(t("uploads.analysisFailed"), e);
      }
    } catch (e) {
      showError(t("uploads.uploadFailed"), e);
    } finally {
      setUploading(false);
    }
  };

  const openWork = (item: StudentWorkRow) => {
    setOpen(item);
    setDraftName(item.student_name ?? "");
    setDraftSubject(item.subject ?? "Mathematics");
    setDraftGrade(item.grade ?? "");
    setDraftStudentId(item.student_id ?? "");
    setDraftNotes("");
  };

  const selectDraftLearner = (id: string) => {
    setDraftStudentId(id);
    if (!id) return;
    const s = students.find((x) => x.id === id);
    if (!s) return;
    setDraftName(s.full_name);
    if (s.grade_level) setDraftGrade(s.grade_level);
  };

  const saveMeta = async () => {
    if (!open) return;
    setSaving(true);
    try {
      const updated = await updateStudentWorkFields(open.id, {
        student_name: draftName.trim() || null,
        subject: draftSubject.trim() || "Mathematics",
        grade: draftGrade.trim() || null,
        student_id: draftStudentId || null,
      });
      setItems((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setOpen(updated);
      showSuccess(t("uploads.metaSaved"), t("uploads.feedbackSavedHint"));
    } catch (e) {
      showError(t("uploads.saveFailed"), e);
    } finally {
      setSaving(false);
    }
  };

  const saveFeedback = async () => {
    if (!open?.feedback) return;
    setSaving(true);
    try {
      const updated = await updateStudentWorkFeedback(open.id, open.feedback, {
        error_type: open.error_type ?? undefined,
        remediation: open.remediation ?? undefined,
        status: "reviewed",
      });
      setItems((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setOpen(null);
      showSuccess(t("uploads.feedbackSaved"), t("uploads.feedbackSavedHint"));
    } catch (e) {
      showError(t("uploads.saveFailed"), e);
    } finally {
      setSaving(false);
    }
  };

  const removeWork = (work: StudentWorkRow) => {
    confirmDelete(work.student_name || work.file_name || t("uploads.unnamed"), () => {
      void (async () => {
        try {
          await deleteStudentWork(work);
          setItems((prev) => prev.filter((w) => w.id !== work.id));
          setSessionIds((prev) => {
            const next = new Set(prev);
            next.delete(work.id);
            return next;
          });
          if (open?.id === work.id) setOpen(null);
          showSuccess(t("uploads.deleted"), t("uploads.deletedHint"));
        } catch (e) {
          showError(t("uploads.deleteFailed"), e);
        }
      })();
    });
  };

  const clearAll = () => {
    if (items.length === 0) return;
    confirmDelete(t("uploads.clearAllConfirm"), () => {
      void (async () => {
        try {
          await Promise.all(items.map((w) => deleteStudentWork(w)));
          setItems([]);
          setSessionIds(new Set());
          setOpen(null);
          showSuccess(t("uploads.deleted"), t("uploads.clearedHint"));
        } catch (e) {
          showError(t("uploads.deleteFailed"), e);
        }
      })();
    });
  };

  const exportPdf = async () => {
    const analyzed = items.filter((w) => w.feedback);
    if (analyzed.length === 0) return;
    setExporting(true);
    try {
      const body = analyzed
        .map((w, i) => {
          const panels = parseWorkFeedbackPanels(w.feedback || "", {
            errorType: w.error_type,
            remediation: w.remediation,
          });
          return [
            `── ${i + 1}. ${w.student_name || w.file_name || "Unnamed"} ──`,
            `Subject: ${w.subject || "Mathematics"}`,
            `Score: ${panels.scoreLabel || "—"}`,
            "",
            w.feedback || "",
            "",
          ].join("\n");
        })
        .join("\n");
      await shareTextFile(
        `learner-work-report-${new Date().toISOString().slice(0, 10)}.txt`,
        `Mother of Math — Learner Work Analysis\n\n${body}`,
      );
    } catch (e) {
      showError(t("uploads.exportFailed"), e);
    } finally {
      setExporting(false);
    }
  };

  const openPanels = open?.feedback
    ? parseWorkFeedbackPanels(open.feedback, {
        errorType: open.error_type,
        remediation: open.remediation,
      })
    : null;

  const tipCards = [
    { title: t("uploads.tipLighting"), body: t("uploads.tipLightingDesc") },
    { title: t("uploads.tipFlat"), body: t("uploads.tipFlatDesc") },
    { title: t("uploads.tipFrame"), body: t("uploads.tipFrameDesc") },
    { title: t("uploads.tipFocus"), body: t("uploads.tipFocusDesc") },
  ];

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "upload", label: t("uploads.tabUpload") },
    { id: "analyzed", label: t("uploads.tabHistory"), count: stats.analyzed || undefined },
    { id: "pending", label: t("uploads.tabPending"), count: stats.pending || undefined },
    { id: "errors", label: t("uploads.tabErrors"), count: stats.errors || undefined },
  ];

  const renderFileRow = (item: StudentWorkRow) => {
    const busy = analyzingIds.has(item.id);
    const analyzed = isWorkAnalyzed(item);
    const errored = isWorkError(item);
    const panels = item.feedback
      ? parseWorkFeedbackPanels(item.feedback, {
          errorType: item.error_type,
          remediation: item.remediation,
        })
      : null;
    const score = panels?.scorePercent ?? null;

    if (viewMode === "grid") {
      return (
        <Pressable key={item.id} onPress={() => openWork(item)} style={styles.gridCard}>
          {isImage(item.image_url, item.file_type) ? (
            <Image source={{ uri: item.image_url }} style={styles.gridThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.gridThumb, styles.gridPlaceholder]}>
              <FileText size={22} color={colors.textMuted} />
            </View>
          )}
          <Text variant="micro" weight="semibold" numberOfLines={1} style={{ marginTop: 6 }}>
            {item.student_name || item.file_name || t("uploads.unnamed")}
          </Text>
          {score != null ? (
            <Text variant="micro" color={colors.brandDeep} weight="bold" style={{ marginTop: 2 }}>
              {panels?.scoreLabel ?? `${score}%`}
            </Text>
          ) : null}
        </Pressable>
      );
    }

    return (
      <Pressable key={item.id} onPress={() => openWork(item)} style={styles.fileRow}>
        {isImage(item.image_url, item.file_type) ? (
          <Image source={{ uri: item.image_url }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.gridPlaceholder]}>
            <FileText size={18} color={colors.brandDeep} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodySm" weight="semibold" numberOfLines={1}>
            {item.student_name || item.file_name || t("uploads.unnamed")}
          </Text>
          <Text variant="micro" color={colors.textMuted} numberOfLines={1}>
            {new Date(item.created_at).toLocaleDateString(locale)}
            {item.file_size ? ` · ${(item.file_size / 1024).toFixed(0)} KB` : ""}
          </Text>
          <View style={styles.badges}>
            <Badge
              label={
                busy
                  ? t("uploads.analyzing")
                  : analyzed
                    ? "success"
                    : errored
                      ? "error"
                      : "uploaded"
              }
              tone={busy ? "info" : analyzed ? "success" : errored ? "danger" : "neutral"}
            />
            {score != null ? (
              <Badge
                label={panels?.scoreLabel ? `${panels.scoreLabel} · ${score}%` : `${score}%`}
                tone={gradeTone(score)}
              />
            ) : null}
          </View>
        </View>
        <IconButton
          accessibilityLabel={t("uploads.delete")}
          onPress={() => removeWork(item)}
          tone="danger"
          size={32}
        >
          <Trash2 size={15} color={colors.danger} />
        </IconButton>
      </Pressable>
    );
  };

  return (
    <DashboardShell
      title={t("uploads.title")}
      loading={loading}
      refreshing={refreshing}
      hideAvatar
      padded={false}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("uploads.loadFailed"), e);
        } finally {
          setRefreshing(false);
        }
      }}
      headerRight={
        <Pressable
          onPress={() => setShowGuidelines((v) => !v)}
          style={styles.tipsBtn}
          accessibilityRole="button"
        >
          <HelpCircle size={13} color={colors.brand} />
          <Text style={styles.tipsLabel}>{t("uploads.tips")}</Text>
          {showGuidelines ? (
            <ChevronUp size={13} color={colors.brand} />
          ) : (
            <ChevronDown size={13} color={colors.brand} />
          )}
        </Pressable>
      }
    >
      <View style={styles.page}>
        {showGuidelines ? (
          <View style={styles.guidelines}>
            <Text variant="caption" weight="bold" color={colors.brandDeep}>
              {t("uploads.photoGuidelinesTitle")}
            </Text>
            {tipCards.map((tip, i) => (
              <View key={tip.title} style={{ marginTop: i === 0 ? 8 : 6 }}>
                <Text variant="micro" weight="semibold">
                  {`${i + 1}. ${tip.title}`}
                </Text>
                <Text variant="micro" color={colors.textMuted}>
                  {tip.body}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Toolbar — same controls as web mobile */}
        <View style={styles.toolbar}>
          <View style={styles.viewToggle}>
            <Pressable
              onPress={() => setViewMode("list")}
              style={[styles.viewBtn, viewMode === "list" && styles.viewBtnOn]}
            >
              <List size={14} color={viewMode === "list" ? colors.white : colors.textMuted} />
            </Pressable>
            <Pressable
              onPress={() => setViewMode("grid")}
              style={[styles.viewBtn, viewMode === "grid" && styles.viewBtnOn]}
            >
              <LayoutGrid size={14} color={viewMode === "grid" ? colors.white : colors.textMuted} />
            </Pressable>
          </View>

          {stats.analyzed > 0 ? (
            <Pressable onPress={() => void exportPdf()} disabled={exporting} style={styles.pdfBtn}>
              {exporting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <FileDown size={13} color={colors.white} />
              )}
              <Text style={styles.pdfLabel}>PDF</Text>
            </Pressable>
          ) : null}

          <Pressable onPress={() => setSortAsc((v) => !v)} style={styles.iconBtn}>
            {sortAsc ? (
              <SortAsc size={14} color={colors.textMuted} />
            ) : (
              <SortDesc size={14} color={colors.textMuted} />
            )}
          </Pressable>

          <Pressable
            onPress={clearAll}
            disabled={items.length === 0}
            style={[styles.clearBtn, items.length === 0 && { opacity: 0.35 }]}
          >
            <Trash2 size={13} color={colors.danger} />
            <Text style={styles.clearLabel}>{t("uploads.clear")}</Text>
          </Pressable>
        </View>

        {/* Stats — web mobile strip */}
        {stats.total > 0 ? (
          <View style={styles.stats}>
            {[
              { label: t("uploads.statFiles"), value: String(stats.total) },
              { label: t("uploads.statAnalyzed"), value: String(stats.analyzed) },
              { label: t("uploads.statErrors"), value: String(stats.errors) },
              {
                label: t("uploads.statAvg"),
                value: stats.avg != null ? `${stats.avg}%` : "—",
              },
            ].map((cell, i) => (
              <View key={cell.label} style={[styles.statCell, i > 0 && styles.statBorder]}>
                <Text style={styles.statLabel}>{cell.label}</Text>
                <Text style={styles.statValue}>{cell.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Tabs */}
        <View style={styles.tabs}>
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                style={[styles.tab, active && styles.tabOn]}
              >
                <Text style={[styles.tabText, active && styles.tabTextOn]} numberOfLines={1}>
                  {item.label}
                </Text>
                {item.count != null ? (
                  <View
                    style={[
                      styles.tabCount,
                      item.id === "errors" ? styles.tabCountDanger : styles.tabCountDark,
                    ]}
                  >
                    <Text style={styles.tabCountText}>
                      {item.count > 99 ? "99+" : item.count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {tab === "upload" ? (
          <View>
            {/* Dropzone — web AnimatedBorder (gray → emerald) */}
            <Pressable
              onPress={() => !uploading && setSourceOpen(true)}
              disabled={uploading}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={["#F3F4F6", "#10B981", "#F3F4F6", "#D1FAE5"]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.dropFrame}
              >
                <View style={[styles.dropBody, uploading && { opacity: 0.55 }]}>
                  {uploading ? (
                    <ActivityIndicator size="large" color={colors.brand} />
                  ) : (
                    <UploadIcon size={40} color={colors.textMuted} strokeWidth={1.5} />
                  )}
                  <Text style={styles.dropTitle}>
                    {uploading ? t("uploads.uploading") : t("uploads.dropTitle")}
                  </Text>
                  <Text style={styles.dropSub}>
                    {uploading ? t("uploads.uploadingWait") : t("uploads.dropSubtitle")}
                  </Text>
                  <Text style={styles.dropMeta}>{t("uploads.dropLimits")}</Text>
                </View>
              </LinearGradient>
            </Pressable>

            {sessionFiles.length > 0 ? (
              <View style={{ marginTop: 12, gap: 8 }}>
                <Input
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t("uploads.searchFiles")}
                />
                <View style={viewMode === "grid" ? styles.grid : styles.list}>
                  {filteredForTab.map(renderFileRow)}
                </View>
              </View>
            ) : !uploading ? (
              <Text style={styles.hint}>
                {t("uploads.uploadHintPrefix")}
                <Text style={styles.hintBold}>{t("uploads.tabAnalyzed")}</Text>
                {t("uploads.uploadHintSuffix")}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {filteredForTab.length > 0 || tab === "analyzed" ? (
              <Input
                value={search}
                onChangeText={setSearch}
                placeholder={
                  tab === "analyzed" ? t("uploads.searchHistory") : t("uploads.searchFiles")
                }
              />
            ) : null}

            {filteredForTab.length === 0 ? (
              <View style={styles.empty}>
                <FolderOpen size={40} color={colors.gray300} strokeWidth={1.5} />
                <Text style={styles.emptyTitle}>
                  {tab === "analyzed" ? t("uploads.noHistory") : t("uploads.noneInTab")}
                </Text>
                <Text style={styles.emptySub}>
                  {tab === "analyzed" ? t("uploads.noHistoryHint") : t("uploads.noneInTabHint")}
                </Text>
              </View>
            ) : (
              <View style={viewMode === "grid" ? styles.grid : styles.list}>
                {filteredForTab.map(renderFileRow)}
              </View>
            )}
          </View>
        )}
      </View>

      <Sheet
        visible={sourceOpen}
        onClose={() => setSourceOpen(false)}
        title={t("uploads.chooseSource")}
        subtitle={t("uploads.chooseSourceHint")}
      >
        <SheetAction
          label={t("uploads.camera")}
          hint={t("uploads.cameraHint")}
          icon={<UploadIcon size={18} color={colors.textSecondary} />}
          onPress={() => void upload(takePhotoForUpload)}
        />
        <SheetAction
          label={t("uploads.gallery")}
          hint={t("uploads.galleryHint")}
          icon={<LayoutGrid size={18} color={colors.textSecondary} />}
          onPress={() => void upload(pickImageForUpload)}
        />
        <SheetAction
          label={t("uploads.document")}
          hint={t("uploads.documentHint")}
          icon={<FileText size={18} color={colors.textSecondary} />}
          onPress={() => void upload(pickDocumentForUpload)}
        />
      </Sheet>

      <Sheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open?.student_name || open?.file_name || t("uploads.unnamed")}
        subtitle={open ? new Date(open.created_at).toLocaleString(locale) : undefined}
        footer={
          <View style={styles.sheetActions}>
            <Button
              label={
                open && isWorkAnalyzed(open) ? t("uploads.reanalyze") : t("uploads.runAnalysis")
              }
              variant="outline"
              size="sm"
              loading={!!open && analyzingIds.has(open.id)}
              icon={<Sparkles size={16} color={colors.brandDark} />}
              onPress={() => {
                if (!open) return;
                void runAnalysis(open, draftNotes.trim() || undefined)
                  .then(() =>
                    showSuccess(t("uploads.analysisDone"), t("uploads.analysisDoneHint")),
                  )
                  .catch((e) => showError(t("uploads.analysisFailed"), e));
              }}
            />
            <Button
              label={t("uploads.saveFeedback")}
              size="sm"
              loading={saving}
              icon={<Save size={16} color={colors.white} />}
              onPress={() => void (open?.feedback ? saveFeedback() : saveMeta())}
            />
          </View>
        }
      >
        {open && isImage(open.image_url, open.file_type) ? (
          <Image source={{ uri: open.image_url }} style={styles.preview} resizeMode="contain" />
        ) : null}

        <Select
          label={t("uploads.linkLearner")}
          value={draftStudentId}
          options={learnerOptions}
          onChange={selectDraftLearner}
        />
        <Input
          label={t("uploads.studentName")}
          value={draftName}
          onChangeText={setDraftName}
          placeholder={t("uploads.studentNamePlaceholder")}
          autoCapitalize="words"
          containerStyle={{ marginTop: space.md }}
        />
        <View style={styles.metaRow}>
          <View style={{ flex: 1 }}>
            <Input
              label={t("uploads.subject")}
              value={draftSubject}
              onChangeText={setDraftSubject}
              placeholder={t("uploads.subjectPlaceholder")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label={t("uploads.gradeLevel")}
              value={draftGrade}
              onChangeText={setDraftGrade}
              placeholder={t("uploads.gradePlaceholder")}
            />
          </View>
        </View>

        <Button
          label={t("uploads.saveDetails")}
          variant="ghost"
          size="sm"
          loading={saving}
          onPress={() => void saveMeta()}
          fullWidth={false}
          style={{ marginTop: space.sm, alignSelf: "flex-start" }}
        />

        <Input
          label={t("uploads.notes")}
          value={draftNotes}
          onChangeText={setDraftNotes}
          placeholder={t("uploads.notesPlaceholder")}
          multiline
          containerStyle={{ marginTop: space.md }}
        />

        {openPanels ? (
          <View style={styles.panels}>
            {(openPanels.scoreLabel || openPanels.scorePercent != null) && (
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <CheckCircle2 size={14} color={colors.brandDeep} />
                  <Text variant="micro" weight="bold" color={colors.brandDeep} uppercase>
                    {t("uploads.sectionGrade")}
                  </Text>
                </View>
                <Text variant="body" weight="bold">
                  {openPanels.scoreLabel
                    ? `${openPanels.scoreLabel}${
                        openPanels.scorePercent != null ? ` · ${openPanels.scorePercent}%` : ""
                      }`
                    : `${openPanels.scorePercent}%`}
                </Text>
              </View>
            )}

            {(openPanels.analysis || open?.feedback) && (
              <View style={styles.panel}>
                <Text variant="micro" weight="bold" color={colors.brandDeep} uppercase>
                  {t("uploads.sectionAnalysis")}
                </Text>
                <View style={{ marginTop: space.sm }}>
                  <RichText source={openPanels.analysis || open?.feedback || ""} />
                </View>
              </View>
            )}

            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <AlertTriangle size={14} color={colors.amberText} />
                <Text variant="micro" weight="bold" color={colors.amberText} uppercase>
                  {t("uploads.sectionErrorType")}
                </Text>
              </View>
              <Text variant="caption" color={colors.textSecondary}>
                {openPanels.displayError}
              </Text>
            </View>

            <View style={[styles.panel, styles.remediation]}>
              <Text variant="micro" weight="bold" color={colors.brandDeep} uppercase>
                {t("uploads.sectionRemediation")}
              </Text>
              <View style={{ marginTop: space.sm }}>
                <RichText source={openPanels.displayRemediation} />
              </View>
            </View>
          </View>
        ) : null}

        <Button
          label={t("uploads.delete")}
          variant="danger"
          size="sm"
          icon={<Trash2 size={16} color={colors.white} />}
          onPress={() => open && removeWork(open)}
          style={{ marginTop: space.lg }}
        />
      </Sheet>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 8,
  },

  tipsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(0,158,63,0.2)",
    backgroundColor: "rgba(0,158,63,0.05)",
  },
  tipsLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.brand,
  },

  guidelines: {
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandMute,
    borderRadius: 12,
    padding: 12,
  },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  viewToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: "hidden",
  },
  viewBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  viewBtnOn: { backgroundColor: colors.secondary },
  pdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: "rgba(0,158,63,0.9)",
  },
  pdfLabel: { fontSize: 11, fontWeight: "700", color: colors.white },
  iconBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  clearLabel: { fontSize: 11, fontWeight: "600", color: colors.danger },

  stats: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(228,228,231,0.8)",
    backgroundColor: "rgba(241,243,246,0.5)",
    overflow: "hidden",
  },
  statCell: { flex: 1, paddingVertical: 6, paddingHorizontal: 2, alignItems: "center" },
  statBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(228,228,231,0.8)" },
  statLabel: { fontSize: 9, fontWeight: "500", color: colors.textMuted, lineHeight: 11 },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: colors.bgSunken,
    borderRadius: 8,
    padding: 2,
    height: 36,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 6,
    paddingHorizontal: 2,
  },
  tabOn: { backgroundColor: colors.surface },
  tabText: { fontSize: 11, fontWeight: "500", color: colors.textMuted },
  tabTextOn: { color: colors.text, fontWeight: "600" },
  tabCount: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  tabCountDark: { backgroundColor: colors.secondary },
  tabCountDanger: { backgroundColor: colors.danger },
  tabCountText: { fontSize: 9, fontWeight: "700", color: colors.white },

  dropFrame: {
    borderRadius: 10,
    padding: 3,
  },
  dropBody: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  dropTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  dropSub: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
  dropMeta: {
    marginTop: 6,
    fontSize: 10,
    color: colors.textFaint,
    textAlign: "center",
  },
  hint: {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  hintBold: { fontSize: 13, fontWeight: "700", color: colors.textMuted },

  list: { gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gridCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 8,
    backgroundColor: colors.surface,
  },
  gridThumb: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: colors.gray100,
  },
  gridPlaceholder: { alignItems: "center", justifyContent: "center" },

  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.brandTint,
  },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },

  empty: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
    textAlign: "center",
  },
  emptySub: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 17,
  },

  metaRow: { flexDirection: "row", gap: space.md, marginTop: space.md },
  preview: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    backgroundColor: colors.gray100,
    marginBottom: space.md,
  },
  panels: { gap: space.md, marginTop: space.lg },
  panel: {
    padding: space.md,
    borderRadius: 10,
    backgroundColor: colors.gray50,
    borderWidth: layout.hairline,
    borderColor: colors.border,
  },
  panelHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  remediation: { backgroundColor: colors.brandTint, borderColor: colors.brandMute },
  sheetActions: { flexDirection: "row", gap: space.sm },
});
