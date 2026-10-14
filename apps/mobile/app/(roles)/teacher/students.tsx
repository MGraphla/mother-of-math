import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import {
  CheckSquare,
  Copy,
  Download,
  FileSpreadsheet,
  Link2,
  Pause,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Share2,
  Square,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { buildStudentImportCsvTemplate, parseCsv } from "../../../src/lib/csv";
import { resolveSmsDialCountry } from "../../../src/lib/phone";
import {
  autoMapColumns,
  mapRowToPayload,
  validateAllRows,
  type BulkMappedRow,
  type BulkValidationIssue,
  type ColumnMapping,
} from "../../../src/lib/studentBulkImport";
import {
  STUDENT_FORM_FIELDS,
  STUDENT_FORM_SECTIONS,
  buildDefaultStudentForm,
  formDataToStudentPayload,
  type StudentFormSection,
} from "../../../src/lib/studentFormFields";
import { shareUtf8File } from "../../../src/native/shareFile";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  buildAccessLink,
  createStudent,
  deleteStudent,
  getStudentLastActiveAt,
  listStudentsForTeacher,
  regenerateAccessToken,
  sendStudentCodeSms,
  toggleStudentStatus,
  updateStudent,
  updateStudentStatus,
  type StudentRow,
} from "../../../src/services/students";
import { colors, radius, shadow, space } from "../../../src/theme/tokens";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  OptionGroup,
  Select,
  Sheet,
  SheetAction,
  StatStrip,
  Text,
  confirmDelete,
  showError,
  showSuccess,
} from "../../../src/ui";

type StatusFilter = "all" | "active" | "paused";
type FormMode = "create" | "edit";
type BulkStep = "upload" | "map" | "report" | "preview";

const formatRelative = (iso: string | null, locale: string) => {
  if (!iso) return null;
  try {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return locale.startsWith("fr") ? "à l'instant" : "just now";
    if (mins < 60) return locale.startsWith("fr") ? `il y a ${mins} min` : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return locale.startsWith("fr") ? `il y a ${hrs} h` : `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return locale.startsWith("fr") ? `il y a ${days} j` : `${days}d ago`;
  } catch {
    return null;
  }
};

function StudentFormFields({
  formData,
  setField,
  openSections,
  toggleSection,
}: {
  formData: Record<string, string>;
  setField: (key: string, value: string) => void;
  openSections: Record<StudentFormSection, boolean>;
  toggleSection: (id: StudentFormSection) => void;
}) {
  return (
    <View>
      {STUDENT_FORM_SECTIONS.map((section) => {
        const open = openSections[section.id];
        const fields = STUDENT_FORM_FIELDS.filter((f) => f.section === section.id);
        return (
          <View key={section.id} style={styles.sectionCard}>
            <Pressable onPress={() => toggleSection(section.id)} style={styles.sectionHeader}>
              <View style={{ flex: 1 }}>
                <Text variant="bodySm" weight="bold">
                  {section.title}
                </Text>
                <Text variant="micro" color={colors.textMuted}>
                  {section.description}
                </Text>
              </View>
              <Text variant="caption" color={colors.brand}>
                {open ? "Hide" : "Show"}
              </Text>
            </Pressable>
            {open
              ? fields.map((field) => {
                  if (field.type === "select" && field.options) {
                    return (
                      <Select
                        key={field.key}
                        label={field.label + (field.required ? " *" : "")}
                        value={(formData[field.key] || "") as string}
                        options={field.options.map((o) => ({ value: o, label: o }))}
                        onChange={(v) => setField(field.key, v)}
                        placeholder={field.placeholder || "Select…"}
                      />
                    );
                  }
                  return (
                    <Input
                      key={field.key}
                      label={field.label}
                      value={formData[field.key] || ""}
                      onChangeText={(v) => setField(field.key, v)}
                      placeholder={field.placeholder}
                      required={field.required}
                      multiline={field.type === "textarea"}
                      keyboardType={
                        field.type === "email"
                          ? "email-address"
                          : field.type === "tel"
                            ? "phone-pad"
                            : "default"
                      }
                      autoCapitalize={field.type === "email" ? "none" : "sentences"}
                    />
                  );
                })
              : null}
          </View>
        );
      })}
    </View>
  );
}

export default function TeacherStudentsScreen() {
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [items, setItems] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>(() =>
    buildDefaultStudentForm(profile ?? undefined),
  );
  const [openSections, setOpenSections] = useState<Record<StudentFormSection, boolean>>({
    basic: true,
    guardian: true,
    school: true,
    health: false,
    additional: false,
  });
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState<StudentRow | null>(null);
  const [qrStudent, setQrStudent] = useState<StudentRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState<BulkStep>("upload");
  const [bulkHeaders, setBulkHeaders] = useState<string[]>([]);
  const [bulkRows, setBulkRows] = useState<Record<string, unknown>[]>([]);
  const [bulkMapping, setBulkMapping] = useState<ColumnMapping>({});
  const [bulkIssues, setBulkIssues] = useState<BulkValidationIssue[]>([]);
  const [bulkValid, setBulkValid] = useState<BulkMappedRow[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    setItems(await listStudentsForTeacher(user.id));
  }, [user]);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("students.loadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((s) => {
      const status = s.account_status ?? "active";
      if (filter !== "all" && status !== filter) return false;
      if (!q) return true;
      return [
        s.full_name,
        s.student_code,
        s.parent_name,
        s.grade_level,
        s.admission_number,
        s.class_name,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, query, filter]);

  const activeCount = items.filter((s) => (s.account_status ?? "active") === "active").length;
  const pausedCount = items.length - activeCount;

  const setField = (key: string, value: string) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const toggleSection = (id: StudentFormSection) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  const openCreate = () => {
    setFormMode("create");
    setEditingId(null);
    setFormData(buildDefaultStudentForm(profile ?? undefined));
    setOpenSections({ basic: true, guardian: true, school: true, health: false, additional: false });
    setFormOpen(true);
  };

  const openEdit = (s: StudentRow) => {
    setFormMode("edit");
    setEditingId(s.id);
    const next: Record<string, string> = buildDefaultStudentForm(profile ?? undefined);
    for (const f of STUDENT_FORM_FIELDS) {
      if (f.key === "parent_phone_country") continue;
      const v = (s as any)[f.key];
      if (v != null && v !== "") next[f.key] = String(v);
    }
    setFormData(next);
    setOpenSections({ basic: true, guardian: true, school: true, health: true, additional: true });
    setViewing(null);
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (!user) return;
    if (!formData.full_name?.trim() || !formData.grade_level?.trim()) {
      showError(t("students.missingRequired"), new Error(t("students.missingRequiredHint")));
      return;
    }
    setSaving(true);
    try {
      if (formMode === "create") {
        const payload = formDataToStudentPayload(formData, user.id);
        if (!payload.school_name && profile?.school_name) payload.school_name = profile.school_name;
        const created = await createStudent({
          ...(payload as any),
          teacher_id: user.id,
          full_name: payload.full_name,
          grade_level: payload.grade_level,
        });
        setFormOpen(false);
        await reload();
        setViewing(created);
        showSuccess(t("students.created"), t("students.tokenReady"));

        const phone = created.parent_phone || formData.parent_phone;
        if (phone) {
          const link = buildAccessLink(created.access_token);
          const smsCountry = resolveSmsDialCountry(
            formData.parent_phone_country || profile?.country || created.nationality,
          );
          const sms = await sendStudentCodeSms({
            parentPhone: phone,
            studentName: created.full_name,
            studentCode: created.student_code,
            accessLink: link,
            country: smsCountry,
          });
          if (sms.success) showSuccess(t("students.smsSent"), "");
          else showError(t("students.smsFailed"), new Error(sms.error || "SMS failed"));
        }
      } else if (editingId) {
        const patch: Record<string, string | null> = {};
        for (const f of STUDENT_FORM_FIELDS) {
          if (f.key === "parent_phone_country") continue;
          const v = formData[f.key]?.trim() || "";
          patch[f.key] = v || null;
        }
        const updated = await updateStudent(editingId, patch);
        setFormOpen(false);
        await reload();
        setViewing(updated);
        showSuccess(t("students.updated"), "");
      }
    } catch (e) {
      showError(formMode === "create" ? t("students.createFailed") : t("students.updateFailed"), e);
    } finally {
      setSaving(false);
    }
  };

  const copyAccessLink = async (s: StudentRow) => {
    if (!s.access_token) return;
    const link = buildAccessLink(s.access_token);
    await Clipboard.setStringAsync(link);
    showSuccess(t("students.linkCopied"), t("students.linkCopiedHint"));
  };

  const shareAccessLink = async (s: StudentRow) => {
    if (!s.access_token) return;
    const link = buildAccessLink(s.access_token);
    try {
      await Share.share({
        message: `${s.full_name} — ${s.student_code || ""} ${link}`.trim(),
        url: link,
      });
    } catch (e) {
      showError(t("students.shareFailed"), e);
    }
  };

  const exportCsv = async () => {
    const rows = selectedIds.size
      ? items.filter((s) => selectedIds.has(s.id))
      : items;
    if (!rows.length) {
      showError(t("students.exportEmpty"), new Error("No students"));
      return;
    }
    const headers = [
      "Learner ID",
      "Full Name",
      "Grade/Class",
      "Parent Name",
      "Parent Phone",
      "Parent Email",
      "School",
      "Status",
      "DOB",
      "Gender",
      "Admission No",
      "Access Link",
    ];
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      headers.join(","),
      ...rows.map((s) =>
        [
          s.student_code || "",
          s.full_name,
          [s.grade_level, s.class_name].filter(Boolean).join(" / "),
          s.parent_name || "",
          s.parent_phone || "",
          s.parent_email || "",
          s.school_name || "",
          s.account_status || "active",
          s.date_of_birth || "",
          s.gender || "",
          s.admission_number || "",
          s.access_token ? buildAccessLink(s.access_token) : "",
        ]
          .map(esc)
          .join(","),
      ),
    ];
    try {
      await shareUtf8File(
        `students_${new Date().toISOString().slice(0, 10)}.csv`,
        lines.join("\n"),
        "text/csv",
      );
      showSuccess(t("students.exported"), "");
    } catch (e) {
      showError(t("students.exportFailed"), e);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulkStatus = async (status: "active" | "paused") => {
    const ids = [...selectedIds];
    try {
      for (const id of ids) await updateStudentStatus(id, status);
      setSelectedIds(new Set());
      await reload();
      showSuccess(t("students.bulkUpdated"), "");
    } catch (e) {
      showError(t("students.updateFailed"), e);
    }
  };

  const runBulkDelete = () => {
    const ids = [...selectedIds];
    confirmDelete(`${ids.length} learners`, async () => {
      try {
        for (const id of ids) await deleteStudent(id);
        setSelectedIds(new Set());
        await reload();
      } catch (e) {
        showError(t("students.deleteFailed"), e);
      }
    });
  };

  const pickBulkFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const name = (asset.name || "").toLowerCase();
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        showError(
          t("students.bulkCsvOnly"),
          new Error(t("students.bulkCsvOnlyHint")),
        );
        return;
      }
      const text = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const { headers, rows } = parseCsv(text);
      if (!headers.length || !rows.length) {
        showError(t("students.bulkEmpty"), new Error("Empty file"));
        return;
      }
      setBulkHeaders(headers);
      setBulkRows(rows);
      setBulkMapping(autoMapColumns(headers));
      setBulkIssues([]);
      setBulkValid([]);
      setBulkStep("map");
    } catch (e) {
      showError(t("students.bulkFailed"), e);
    }
  };

  const runBulkValidate = () => {
    const defaults = {
      school_name: profile?.school_name,
      grade_level: profile?.grade_levels?.split(",")[0]?.trim(),
    };
    const mapped = bulkRows.map((row, i) =>
      mapRowToPayload(row, bulkMapping, i + 2, defaults),
    );
    const { issues, validRows } = validateAllRows(mapped);
    setBulkIssues(issues);
    setBulkValid(validRows);
    setBulkStep(issues.length ? "report" : "preview");
  };

  const runBulkImport = async () => {
    if (!user || !bulkValid.length) return;
    setBulkBusy(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const row of bulkValid) {
        try {
          const payload: Record<string, string> = { teacher_id: user.id };
          for (const [k, v] of Object.entries(row.payload)) {
            if (v) payload[k] = v;
          }
          if (!payload.full_name || !payload.grade_level) {
            fail++;
            continue;
          }
          await createStudent({
            ...(payload as any),
            teacher_id: user.id,
            full_name: payload.full_name,
            grade_level: payload.grade_level,
          });
          ok++;
        } catch {
          fail++;
        }
      }
      await reload();
      showSuccess(
        t("students.bulkDone"),
        `${ok} ${t("students.bulkSuccess")}, ${fail} ${t("students.bulkFailedCount")}`,
      );
      if (fail === 0) {
        setBulkOpen(false);
        setBulkStep("upload");
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const shareTemplate = async () => {
    try {
      await shareUtf8File(
        "student_upload_template.csv",
        buildStudentImportCsvTemplate(),
        "text/csv",
      );
    } catch (e) {
      showError(t("students.exportFailed"), e);
    }
  };

  return (
    <DashboardShell
      title={t("sidebar.studentAccounts")}
      subtitle={t("students.pageSubtitle")}
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("students.loadFailed"), e);
        } finally {
          setRefreshing(false);
        }
      }}
      search={{
        value: query,
        onChangeText: setQuery,
        placeholder: t("students.searchPlaceholder"),
      }}
      headerRight={
        <View style={styles.headerActions}>
          <IconButton accessibilityLabel={t("students.export")} onPress={() => void exportCsv()}>
            <Download size={18} color={colors.textSecondary} />
          </IconButton>
          <IconButton accessibilityLabel={t("students.create")} onPress={openCreate} tone="brand">
            <Plus size={20} color={colors.brandDeep} />
          </IconButton>
        </View>
      }
    >
      <StatStrip
        items={[
          { label: t("dashboard.totalStudents"), value: items.length },
          { label: t("status.active"), value: activeCount },
          { label: t("students.paused"), value: pausedCount },
        ]}
      />

      <View style={styles.topActions}>
        <Button
          label={t("students.bulkUpload")}
          variant="outline"
          onPress={() => {
            setBulkStep("upload");
            setBulkOpen(true);
          }}
          icon={<Upload size={16} color={colors.brandDark} />}
          style={{ flex: 1 }}
        />
        <Button
          label={t("students.create")}
          onPress={openCreate}
          icon={<UserPlus size={16} color={colors.white} />}
          style={{ flex: 1 }}
        />
      </View>

      <OptionGroup<StatusFilter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: t("common.all") },
          { value: "active", label: t("status.active") },
          { value: "paused", label: t("students.paused") },
        ]}
      />

      {selectedIds.size > 0 ? (
        <View style={styles.bulkBar}>
          <Text variant="caption" weight="semibold" color={colors.brandDeep}>
            {selectedIds.size} {t("students.selected")}
          </Text>
          <View style={styles.bulkBarActions}>
            <IconButton
              accessibilityLabel={t("students.pauseAccount")}
              onPress={() => void runBulkStatus("paused")}
            >
              <Pause size={16} color={colors.amber} />
            </IconButton>
            <IconButton
              accessibilityLabel={t("students.activateAccount")}
              onPress={() => void runBulkStatus("active")}
            >
              <Play size={16} color={colors.brand} />
            </IconButton>
            <IconButton accessibilityLabel={t("common.delete")} tone="danger" onPress={runBulkDelete}>
              <Trash2 size={16} color={colors.dangerText} />
            </IconButton>
            <IconButton
              accessibilityLabel={t("common.cancel")}
              onPress={() => setSelectedIds(new Set())}
            >
              <X size={16} color={colors.textMuted} />
            </IconButton>
          </View>
        </View>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Users size={24} color={colors.brandDeep} />}
          title={items.length === 0 ? t("dashboard.noStudentsYet") : t("common.noResults")}
          subtitle={items.length === 0 ? t("students.createHint") : t("students.adjustSearch")}
          actionLabel={items.length === 0 ? t("students.create") : undefined}
          onAction={items.length === 0 ? openCreate : undefined}
        />
      ) : (
        visible.map((s) => {
          const paused = (s.account_status ?? "active") !== "active";
          const selected = selectedIds.has(s.id);
          const last = formatRelative(getStudentLastActiveAt(s), locale);
          return (
            <Card key={s.id} padded={false}>
              <Pressable onPress={() => setViewing(s)} onLongPress={() => toggleSelect(s.id)}>
                <View style={styles.row}>
                  <Pressable onPress={() => toggleSelect(s.id)} hitSlop={8} style={styles.checkHit}>
                    {selected ? (
                      <CheckSquare size={20} color={colors.brand} />
                    ) : (
                      <Square size={20} color={colors.borderStrong} />
                    )}
                  </Pressable>
                  <Avatar name={s.full_name} size={44} letters={2} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="bodySm" weight="bold" numberOfLines={1}>
                      {s.full_name}
                    </Text>
                    <Text variant="micro" color={colors.textMuted} numberOfLines={1}>
                      {[s.student_code, s.grade_level, s.class_name].filter(Boolean).join(" · ") ||
                        t("students.noGrade")}
                    </Text>
                    {s.parent_name ? (
                      <Text variant="micro" color={colors.textFaint} numberOfLines={1}>
                        {s.parent_name}
                        {s.parent_phone ? ` · ${s.parent_phone}` : ""}
                      </Text>
                    ) : null}
                    <View style={styles.badges}>
                      <Badge
                        label={paused ? t("students.paused") : t("status.active")}
                        tone={paused ? "warning" : "success"}
                      />
                      {last ? <Badge label={last} tone="outline" /> : null}
                    </View>
                  </View>
                  <IconButton
                    accessibilityLabel={t("students.copyLink")}
                    size={34}
                    onPress={() => void copyAccessLink(s)}
                  >
                    <Link2 size={16} color={colors.brandDeep} />
                  </IconButton>
                </View>
              </Pressable>
            </Card>
          );
        })
      )}

      {/* Create / Edit */}
      <Sheet
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title={formMode === "create" ? t("students.enrollTitle") : t("students.editTitle")}
        subtitle={t("students.createHint")}
        footer={
          <Button
            label={formMode === "create" ? t("students.create") : t("common.save")}
            onPress={() => void submitForm()}
            loading={saving}
            icon={<UserPlus size={18} color={colors.white} />}
          />
        }
      >
        <StudentFormFields
          formData={formData}
          setField={setField}
          openSections={openSections}
          toggleSection={toggleSection}
        />
      </Sheet>

      {/* View */}
      <Sheet
        visible={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.full_name}
        subtitle={
          viewing
            ? [viewing.student_code, viewing.grade_level, viewing.class_name]
                .filter(Boolean)
                .join(" · ") || undefined
            : undefined
        }
      >
        {viewing ? (
          <ScrollView>
            <View style={styles.tokenBox}>
              <Text variant="micro" weight="semibold" color={colors.textMuted} uppercase>
                {t("students.accessLink")}
              </Text>
              <Text variant="caption" weight="medium" style={{ marginTop: 6 }} selectable>
                {viewing.access_token ? buildAccessLink(viewing.access_token) : "—"}
              </Text>
              <Text variant="micro" color={colors.textFaint} style={{ marginTop: 6 }}>
                {formatRelative(getStudentLastActiveAt(viewing), locale) ||
                  t("students.neverLoggedIn")}
              </Text>
            </View>

            <SheetAction
              label={t("students.copyLink")}
              icon={<Copy size={18} color={colors.textSecondary} />}
              onPress={() => void copyAccessLink(viewing)}
            />
            <SheetAction
              label={t("students.shareLink")}
              icon={<Share2 size={18} color={colors.textSecondary} />}
              onPress={() => void shareAccessLink(viewing)}
            />
            <SheetAction
              label={t("students.showQr")}
              icon={<QrCode size={18} color={colors.textSecondary} />}
              onPress={() => {
                setQrStudent(viewing);
                setViewing(null);
              }}
            />
            <SheetAction
              label={t("students.editTitle")}
              icon={<UserPlus size={18} color={colors.textSecondary} />}
              onPress={() => openEdit(viewing)}
            />
            <SheetAction
              label={
                (viewing.account_status ?? "active") === "active"
                  ? t("students.pauseAccount")
                  : t("students.activateAccount")
              }
              icon={
                (viewing.account_status ?? "active") === "active" ? (
                  <Pause size={18} color={colors.textSecondary} />
                ) : (
                  <Play size={18} color={colors.textSecondary} />
                )
              }
              onPress={() => {
                const target = viewing;
                setViewing(null);
                void (async () => {
                  try {
                    await toggleStudentStatus(target);
                    await reload();
                  } catch (e) {
                    showError(t("students.updateFailed"), e);
                  }
                })();
              }}
            />

            {STUDENT_FORM_SECTIONS.map((section) => {
              const filled = STUDENT_FORM_FIELDS.filter((f) => {
                if (f.key === "parent_phone_country") return false;
                if (f.section !== section.id) return false;
                const v = (viewing as any)[f.key];
                return v != null && String(v).trim() !== "";
              });
              if (!filled.length) return null;
              return (
                <View key={section.id} style={styles.viewSection}>
                  <Text variant="micro" weight="bold" color={colors.textMuted} uppercase>
                    {section.title}
                  </Text>
                  {filled.map((f) => (
                    <View key={f.key} style={{ marginTop: 8 }}>
                      <Text variant="micro" color={colors.textFaint}>
                        {f.label}
                      </Text>
                      <Text variant="caption" weight="medium">
                        {String((viewing as any)[f.key])}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })}

            <SheetAction
              label={t("common.delete")}
              hint={t("students.deleteHint")}
              destructive
              icon={<Trash2 size={18} color={colors.dangerText} />}
              onPress={() => {
                const target = viewing;
                setViewing(null);
                confirmDelete(target.full_name, async () => {
                  try {
                    await deleteStudent(target.id);
                    await reload();
                  } catch (e) {
                    showError(t("students.deleteFailed"), e);
                  }
                });
              }}
            />
          </ScrollView>
        ) : null}
      </Sheet>

      {/* QR */}
      <Sheet
        visible={!!qrStudent}
        onClose={() => setQrStudent(null)}
        title={t("students.showQr")}
        subtitle={qrStudent?.full_name}
        footer={
          qrStudent ? (
            <View style={{ gap: 8 }}>
              <Button
                label={t("students.copyLink")}
                variant="outline"
                onPress={() => void copyAccessLink(qrStudent)}
              />
              <Button
                label={t("students.newToken")}
                onPress={() =>
                  void (async () => {
                    try {
                      const token = await regenerateAccessToken(qrStudent.id);
                      const updated = { ...qrStudent, access_token: token };
                      setQrStudent(updated);
                      await reload();
                      showSuccess(t("students.tokenRegen"), t("students.tokenRegenHint"));
                    } catch (e) {
                      showError(t("students.updateFailed"), e);
                    }
                  })()
                }
                icon={<RefreshCw size={16} color={colors.white} />}
              />
            </View>
          ) : undefined
        }
      >
        {qrStudent?.access_token ? (
          <View style={styles.qrWrap}>
            <Image
              source={{
                uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                  buildAccessLink(qrStudent.access_token),
                )}`,
              }}
              style={styles.qrImage}
            />
            <Text variant="micro" color={colors.textMuted} center>
              {buildAccessLink(qrStudent.access_token)}
            </Text>
          </View>
        ) : null}
      </Sheet>

      {/* Bulk CSV wizard */}
      <Sheet
        visible={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title={t("students.bulkUpload")}
        subtitle={t("students.bulkHint")}
        footer={
          bulkStep === "map" ? (
            <Button label={t("students.bulkValidate")} onPress={runBulkValidate} />
          ) : bulkStep === "preview" ? (
            <Button
              label={`${t("students.bulkImport")} (${bulkValid.length})`}
              onPress={() => void runBulkImport()}
              loading={bulkBusy}
            />
          ) : bulkStep === "report" ? (
            <Button label={t("students.bulkBackMap")} variant="outline" onPress={() => setBulkStep("map")} />
          ) : (
            <Button
              label={t("students.bulkPickFile")}
              onPress={() => void pickBulkFile()}
              icon={<FileSpreadsheet size={16} color={colors.white} />}
            />
          )
        }
      >
        {bulkStep === "upload" ? (
          <View style={{ gap: 12 }}>
            <Text variant="caption" color={colors.textMuted}>
              {t("students.bulkCsvOnlyHint")}
            </Text>
            <Button
              label={t("students.bulkTemplate")}
              variant="outline"
              onPress={() => void shareTemplate()}
            />
          </View>
        ) : null}

        {bulkStep === "map" ? (
          <View style={{ gap: 10 }}>
            <Text variant="caption" color={colors.textMuted}>
              {bulkRows.length} {t("students.bulkRows")} · {bulkHeaders.length}{" "}
              {t("students.bulkColumns")}
            </Text>
            {STUDENT_FORM_FIELDS.filter((f) => f.key !== "parent_phone_country").map((f) => (
              <Select
                key={f.key}
                label={f.label + (f.required ? " *" : "")}
                value={(bulkMapping[f.key as keyof ColumnMapping] as string) || ""}
                options={[
                  { value: "", label: t("students.bulkSkip") },
                  ...bulkHeaders.map((h) => ({ value: h, label: h })),
                ]}
                onChange={(v) =>
                  setBulkMapping((prev) => ({
                    ...prev,
                    [f.key]: v || undefined,
                  }))
                }
                placeholder={t("students.bulkSkip")}
              />
            ))}
          </View>
        ) : null}

        {bulkStep === "report" ? (
          <View style={{ gap: 8 }}>
            <Text variant="caption" weight="semibold" color={colors.dangerText}>
              {bulkIssues.length} {t("students.bulkIssues")}
            </Text>
            {bulkIssues.slice(0, 40).map((issue, i) => (
              <Text key={`${issue.rowNumber}-${i}`} variant="micro" color={colors.textMuted}>
                Row {issue.rowNumber} · {issue.field}: {issue.message}
              </Text>
            ))}
          </View>
        ) : null}

        {bulkStep === "preview" ? (
          <View style={{ gap: 8 }}>
            <Text variant="caption" weight="semibold">
              {bulkValid.length} {t("students.bulkReady")}
            </Text>
            {bulkValid.slice(0, 8).map((row) => (
              <View key={row.rowNumber} style={styles.previewRow}>
                <Text variant="caption" weight="semibold">
                  {row.payload.full_name}
                </Text>
                <Text variant="micro" color={colors.textMuted}>
                  {row.payload.grade_level}
                </Text>
              </View>
            ))}
            {bulkBusy ? <ActivityIndicator color={colors.brand} /> : null}
          </View>
        ) : null}
      </Sheet>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: "row", alignItems: "center", gap: 2 },
  topActions: { flexDirection: "row", gap: 8, marginBottom: space.md },
  bulkBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: space.md,
    marginBottom: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandMute,
  },
  bulkBarActions: { flexDirection: "row", alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.lg,
  },
  checkHit: { paddingRight: 2 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  sectionCard: {
    marginBottom: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    backgroundColor: colors.surface,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: space.sm,
  },
  tokenBox: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandMute,
    marginBottom: space.md,
  },
  viewSection: {
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  qrWrap: { alignItems: "center", gap: 12, paddingVertical: space.lg },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow.xs,
  },
  previewRow: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSunken,
  },
});
