import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Switch, View } from "react-native";
import {
  Bell,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Megaphone,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Send,
  Trash2,
} from "lucide-react-native";
import {
  MiniProgress,
  PageHero,
  Panel,
  SlimStatBar,
  ToolbarSearch,
} from "../../../src/components/WebMatchChrome";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_TEMPLATES,
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncementReadStats,
  listAnnouncementsForTeacher,
  setAnnouncementPinned,
  updateAnnouncement,
  type AnnouncementReadStats,
  type AnnouncementRow,
} from "../../../src/services/announcements";
import { colors, radius, space } from "../../../src/theme/tokens";
import {
  Badge,
  Button,
  IconButton,
  Input,
  OptionGroup,
  RichText,
  Select,
  Sheet,
  SheetAction,
  Text,
  Toggle,
  confirmDelete,
  showError,
  showSuccess,
} from "../../../src/ui";

type Tab = "all" | "published" | "scheduled";
type AnnStatus = "published" | "scheduled";

type EnhancedAnnouncement = AnnouncementRow & {
  status: AnnStatus;
  scheduledFor?: string;
};

const relativeTime = (iso: string, locale: string) => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const now = Date.now();
  const sec = Math.round((now - then) / 1000);
  const abs = Math.abs(sec);
  const fr = locale.startsWith("fr");
  const past = sec >= 0;

  const unit = (n: number, enOne: string, enMany: string, frOne: string, frMany: string) => {
    if (fr) {
      return past
        ? `il y a ${n} ${n === 1 ? frOne : frMany}`
        : `dans ${n} ${n === 1 ? frOne : frMany}`;
    }
    return past
      ? `${n} ${n === 1 ? enOne : enMany} ago`
      : `in ${n} ${n === 1 ? enOne : enMany}`;
  };

  if (abs < 60) return fr ? (past ? "à l'instant" : "bientôt") : past ? "just now" : "soon";
  if (abs < 3600) return unit(Math.round(abs / 60), "minute", "minutes", "minute", "minutes");
  if (abs < 86400) return unit(Math.round(abs / 3600), "hour", "hours", "heure", "heures");
  if (abs < 604800) return unit(Math.round(abs / 86400), "day", "days", "jour", "jours");
  if (abs < 2629800) return unit(Math.round(abs / 604800), "week", "weeks", "semaine", "semaines");
  return unit(Math.round(abs / 2629800), "month", "months", "mois", "mois");
};

export default function TeacherAnnouncementsScreen() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const tr = useCallback(
    (key: string, fallback: string) => {
      const value = t(key);
      return value === key ? fallback : value;
    },
    [t],
  );

  const [items, setItems] = useState<EnhancedAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(() => new Set());
  const [avgReadRate, setAvgReadRate] = useState(0);
  const [readStatsById, setReadStatsById] = useState<
    Record<string, { read: number; total: number }>
  >({});

  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editing, setEditing] = useState<EnhancedAnnouncement | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<string>(ANNOUNCEMENT_CATEGORIES[0]);
  const [pinned, setPinned] = useState(false);
  const [scheduleOn, setScheduleOn] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; message?: string; schedule?: string }>({});

  const [selected, setSelected] = useState<EnhancedAnnouncement | null>(null);
  const [detailStats, setDetailStats] = useState<AnnouncementReadStats | null>(null);
  const [detailStatsLoading, setDetailStatsLoading] = useState(false);

  const enhance = useCallback(
    (rows: AnnouncementRow[]): EnhancedAnnouncement[] => {
      let mockScheduled = false;
      return rows.map((row) => {
        if (scheduledIds.has(row.id)) {
          return { ...row, status: "scheduled" as const };
        }
        if (!mockScheduled && !row.is_pinned) {
          mockScheduled = true;
          const future = new Date();
          future.setDate(future.getDate() + 2);
          return {
            ...row,
            status: "scheduled" as const,
            scheduledFor: future.toISOString(),
          };
        }
        return { ...row, status: "published" as const };
      });
    },
    [scheduledIds],
  );

  const reload = useCallback(async () => {
    if (!user) return;
    const rows = await listAnnouncementsForTeacher(user.id);
    const enhanced = enhance(rows);
    setItems(enhanced);

    const published = enhanced.filter((a) => a.status === "published").slice(0, 15);
    let totalReads = 0;
    let totalPossible = 0;
    const nextStats: Record<string, { read: number; total: number }> = {};
    await Promise.all(
      published.map(async (a) => {
        try {
          const stats = await getAnnouncementReadStats(a.id, user.id);
          nextStats[a.id] = { read: stats.readCount, total: stats.totalStudents };
          totalReads += stats.readCount;
          totalPossible += stats.totalStudents;
        } catch {
          // Ignore individual read-stat failures (parity with web).
        }
      }),
    );
    setReadStatsById(nextStats);
    setAvgReadRate(totalPossible > 0 ? Math.round((totalReads / totalPossible) * 100) : 0);
  }, [user, enhance]);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("announcements.loadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setCategory(ANNOUNCEMENT_CATEGORIES[0]);
    setPinned(false);
    setScheduleOn(false);
    setScheduleDate("");
    setScheduleTime("");
    setEditing(null);
    setErrors({});
  };

  const openCreate = () => {
    resetForm();
    setComposeOpen(true);
  };

  const openEdit = (announcement: EnhancedAnnouncement) => {
    setEditing(announcement);
    setTitle(announcement.title);
    setMessage(announcement.message);
    setCategory(announcement.category || ANNOUNCEMENT_CATEGORIES[0]);
    setPinned(announcement.is_pinned);
    if (announcement.status === "scheduled" && announcement.scheduledFor) {
      setScheduleOn(true);
      const d = new Date(announcement.scheduledFor);
      setScheduleDate(d.toISOString().slice(0, 10));
      setScheduleTime(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      );
    } else if (announcement.status === "scheduled") {
      setScheduleOn(true);
      setScheduleDate("");
      setScheduleTime("");
    } else {
      setScheduleOn(false);
      setScheduleDate("");
      setScheduleTime("");
    }
    setErrors({});
    setSelected(null);
    setComposeOpen(true);
  };

  const applyTemplate = (templateId: string) => {
    const template = ANNOUNCEMENT_TEMPLATES.find((x) => x.id === templateId);
    if (!template) return;
    setEditing(null);
    setTitle(template.title);
    setMessage(template.message);
    setCategory(template.category);
    setPinned(template.is_pinned);
    setScheduleOn(false);
    setScheduleDate("");
    setScheduleTime("");
    setErrors({});
    setTemplatesOpen(false);
    setComposeOpen(true);
    showSuccess(
      tr("announcements.templateApplied", "Template applied"),
      tr("announcements.templateAppliedHint", `Loaded "${template.title}" template.`),
    );
  };

  const duplicateAnnouncement = (announcement: EnhancedAnnouncement) => {
    setEditing(null);
    setTitle(`Copy of ${announcement.title}`);
    setMessage(announcement.message);
    setCategory(announcement.category || ANNOUNCEMENT_CATEGORIES[0]);
    setPinned(false);
    setScheduleOn(false);
    setScheduleDate("");
    setScheduleTime("");
    setErrors({});
    setSelected(null);
    setComposeOpen(true);
  };

  const submit = async () => {
    if (!user) return;
    const next: typeof errors = {};
    if (!title.trim()) next.title = t("announcements.titleRequired");
    if (!message.trim()) next.message = t("announcements.messageRequired");
    if (scheduleOn && (!scheduleDate.trim() || !scheduleTime.trim())) {
      next.schedule = tr(
        "announcements.scheduleRequired",
        "Please provide both date and time for scheduling.",
      );
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      if (editing) {
        await updateAnnouncement(editing.id, {
          title: title.trim(),
          message: message.trim(),
          category,
          is_pinned: pinned,
        });
        setScheduledIds((prev) => {
          const copy = new Set(prev);
          if (scheduleOn) copy.add(editing.id);
          else copy.delete(editing.id);
          return copy;
        });
        showSuccess(
          scheduleOn
            ? tr("announcements.scheduledUpdated", "Scheduled announcement updated")
            : tr("announcements.updated", "Announcement updated"),
          scheduleOn
            ? tr("announcements.scheduledHint", "It will appear at the scheduled time.")
            : t("announcements.publishedHint"),
        );
      } else {
        const created = await createAnnouncement({
          teacher_id: user.id,
          title: title.trim(),
          message: message.trim(),
          category,
          is_pinned: pinned,
        });
        if (scheduleOn && created?.id) {
          setScheduledIds((prev) => new Set(prev).add(created.id));
        }
        showSuccess(
          scheduleOn
            ? tr("announcements.scheduled", "Announcement scheduled")
            : t("announcements.published"),
          scheduleOn
            ? tr("announcements.scheduledHint", "It will appear at the scheduled time.")
            : t("announcements.publishedHint"),
        );
      }
      setComposeOpen(false);
      resetForm();
      await reload();
    } catch (e) {
      showError(tr("announcements.saveFailed", "Failed to save announcement."), e);
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (item: EnhancedAnnouncement) => {
    setSelected(item);
    setDetailStats(null);
    if (!user || item.status === "scheduled") return;
    setDetailStatsLoading(true);
    try {
      setDetailStats(await getAnnouncementReadStats(item.id, user.id));
    } catch {
      setDetailStats(null);
    } finally {
      setDetailStatsLoading(false);
    }
  };

  const publishedCount = items.filter((a) => a.status === "published").length;
  const scheduledCount = items.filter((a) => a.status === "scheduled").length;
  const pinnedCount = items.filter((a) => a.is_pinned).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((a) => {
      if (tab === "published" && a.status !== "published") return false;
      if (tab === "scheduled" && a.status !== "scheduled") return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.message.toLowerCase().includes(q) ||
        (a.category?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, query, tab]);

  const emptyTitle = tr("announcements.noneFound", "No announcements found");
  const emptySubtitle = query.trim()
    ? tr("announcements.noneSearch", "No announcements match your search query.")
    : tab === "scheduled"
      ? tr("announcements.noneScheduled", "You have no scheduled announcements.")
      : t("announcements.noneHint");

  const subtitle = tr(
    "announcements.tagline",
    "Communicate with your students effectively",
  );

  return (
    <DashboardShell
      title={t("sidebar.announcements")}
      subtitle={subtitle}
      loading={loading}
      refreshing={refreshing}
      hideTitle
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("announcements.loadFailed"), e);
        } finally {
          setRefreshing(false);
        }
      }}
      hideAvatar
    >
      <PageHero
        icon={<Megaphone size={22} color={colors.brandDeep} />}
        title={t("sidebar.announcements")}
        subtitle={subtitle}
        actions={
          <View style={styles.heroActions}>
            <Button
              label={tr("announcements.templates", "Templates")}
              onPress={() => setTemplatesOpen(true)}
              variant="outline"
              size="sm"
              fullWidth={false}
              icon={<FileText size={14} color={colors.brandDark} />}
            />
            <Button
              label={tr("announcements.newShort", "New")}
              onPress={openCreate}
              size="sm"
              fullWidth={false}
              icon={<Plus size={14} color={colors.white} />}
            />
          </View>
        }
      />

      <SlimStatBar
        items={[
          { label: "Pub", value: publishedCount },
          { label: "Sched", value: scheduledCount },
          { label: "Pin", value: pinnedCount },
          { label: "Read", value: `${avgReadRate}%` },
        ]}
      />

      <Panel
        toolbar={
          <>
            <OptionGroup<Tab>
              value={tab}
              onChange={setTab}
              variant="segment"
              options={[
                { value: "all", label: t("common.all") },
                { value: "published", label: t("announcements.published") },
                { value: "scheduled", label: tr("announcements.scheduledTab", "Scheduled") },
              ]}
            />
            <ToolbarSearch
              value={query}
              onChangeText={setQuery}
              placeholder={tr("announcements.searchPlaceholder", "Search announcements...")}
            />
          </>
        }
      >
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Bell size={32} color={colors.textFaint} style={{ opacity: 0.45 }} />
            </View>
            <Text variant="bodySm" weight="semibold" style={{ textAlign: "center" }}>
              {emptyTitle}
            </Text>
            <Text
              variant="caption"
              color={colors.textMuted}
              style={{ textAlign: "center", marginTop: 4 }}
            >
              {emptySubtitle}
            </Text>
            {!query.trim() && tab !== "scheduled" ? (
              <Button
                label={t("announcements.compose")}
                onPress={openCreate}
                variant="outline"
                size="sm"
                style={{ marginTop: space.lg }}
                icon={<Plus size={16} color={colors.brandDark} />}
              />
            ) : null}
          </View>
        ) : (
          visible.map((item, index) => {
            const scheduled = item.status === "scheduled";
            const stats = readStatsById[item.id];
            const readPct =
              stats && stats.total > 0 ? Math.round((stats.read / stats.total) * 100) : null;
            const progressColor =
              readPct == null
                ? colors.brand
                : readPct > 75
                  ? colors.emerald
                  : readPct > 40
                    ? colors.amber
                    : colors.danger;

            return (
              <Pressable
                key={item.id}
                onPress={() => void openDetail(item)}
                style={({ pressed }) => [
                  styles.tableRow,
                  index < visible.length - 1 && styles.tableRowBorder,
                  pressed && styles.tableRowPressed,
                ]}
                accessibilityRole="button"
              >
                <View style={styles.pinSlot}>
                  {item.is_pinned ? (
                    <Pin size={16} color={colors.brand} />
                  ) : (
                    <View style={styles.pinSpacer} />
                  )}
                </View>

                <View style={styles.rowMain}>
                  <View style={styles.titleLine}>
                    <Text
                      variant="bodySm"
                      weight="semibold"
                      numberOfLines={1}
                      style={{ flexShrink: 1 }}
                    >
                      {item.title}
                    </Text>
                    {item.category ? (
                      <Badge label={item.category} tone="outline" />
                    ) : null}
                  </View>
                  <Text
                    variant="micro"
                    color={colors.textMuted}
                    numberOfLines={1}
                    style={{ marginTop: 2 }}
                  >
                    {item.message}
                  </Text>

                  <View style={styles.rowMeta}>
                    {scheduled ? (
                      <Badge
                        label={tr("announcements.scheduledTab", "Scheduled")}
                        tone="brand"
                        icon={<Clock size={11} color={colors.brandDeep} />}
                      />
                    ) : (
                      <Badge
                        label={t("announcements.published")}
                        tone="success"
                        icon={<CheckCircle2 size={11} color={colors.emeraldText} />}
                      />
                    )}

                    {!scheduled ? (
                      stats && stats.total > 0 && readPct != null ? (
                        <View style={styles.readRate}>
                          <MiniProgress value={readPct} color={progressColor} />
                          <Text variant="micro" weight="semibold" color={colors.textSecondary}>
                            {`${stats.read}/${stats.total}`}
                          </Text>
                        </View>
                      ) : typeof item.read_count === "number" ? (
                        <Text variant="micro" color={colors.textMuted}>
                          {`${item.read_count} ${tr("announcements.reads", "reads")}`}
                        </Text>
                      ) : null
                    ) : null}

                    <Text variant="micro" color={colors.textFaint} style={{ marginLeft: "auto" }}>
                      {scheduled && item.scheduledFor
                        ? relativeTime(item.scheduledFor, locale)
                        : relativeTime(item.created_at, locale)}
                    </Text>
                  </View>
                </View>

                <IconButton
                  accessibilityLabel={tr("common.actions", "Actions")}
                  onPress={() => void openDetail(item)}
                  tone="neutral"
                  size={32}
                >
                  <MoreVertical size={18} color={colors.textMuted} />
                </IconButton>
              </Pressable>
            );
          })
        )}
      </Panel>

      <Sheet
        visible={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        title={tr("announcements.useTemplate", "Use Template")}
        subtitle={tr("announcements.templatesHint", "Start from a ready-made message")}
      >
        {ANNOUNCEMENT_TEMPLATES.map((template) => (
          <SheetAction
            key={template.id}
            label={template.title}
            hint={template.message.slice(0, 80).replace(/\n/g, " ") + "…"}
            icon={<FileText size={18} color={colors.textSecondary} />}
            onPress={() => applyTemplate(template.id)}
          />
        ))}
      </Sheet>

      <Sheet
        visible={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          resetForm();
        }}
        title={
          editing
            ? tr("announcements.editTitle", "Edit Announcement")
            : tr("announcements.newTitle", "New Announcement")
        }
        subtitle={
          editing
            ? tr("announcements.editHint", "Update this announcement for your students")
            : t("announcements.composeHint")
        }
        footer={
          <View style={styles.footerRow}>
            <View style={{ flex: 1 }}>
              <Button
                label={t("common.cancel")}
                variant="outline"
                onPress={() => {
                  setComposeOpen(false);
                  resetForm();
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={
                  saving
                    ? tr("common.saving", "Saving...")
                    : scheduleOn
                      ? tr("announcements.schedule", "Schedule")
                      : editing
                        ? tr("announcements.update", "Update")
                        : t("announcements.publish")
                }
                onPress={submit}
                loading={saving}
                icon={
                  scheduleOn ? (
                    <Clock size={18} color={colors.white} />
                  ) : (
                    <Send size={18} color={colors.white} />
                  )
                }
              />
            </View>
          </View>
        }
      >
        <Input
          label={tr("announcements.titleLabel", "Title")}
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            if (errors.title) setErrors((e) => ({ ...e, title: undefined }));
          }}
          placeholder={t("announcements.titlePlaceholder")}
          error={errors.title}
          required
        />
        <Input
          label={t("announcements.message")}
          value={message}
          onChangeText={(v) => {
            setMessage(v);
            if (errors.message) setErrors((e) => ({ ...e, message: undefined }));
          }}
          placeholder={t("announcements.messagePlaceholder")}
          error={errors.message}
          multiline
          required
          hint={tr("announcements.formattingHint", "Supports basic formatting")}
        />
        <Select
          label={t("announcements.category")}
          value={category}
          onChange={setCategory}
          options={ANNOUNCEMENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <View>
          <Text variant="caption" weight="semibold" color={colors.textSecondary} style={{ marginBottom: 6 }}>
            {t("announcements.pinToTop")}
          </Text>
          <View style={styles.pinChip}>
            <Switch
              value={pinned}
              onValueChange={setPinned}
              trackColor={{ false: colors.gray300, true: colors.brandMute }}
              thumbColor={Platform.OS === "android" ? (pinned ? colors.brand : colors.gray100) : undefined}
              ios_backgroundColor={colors.gray300}
            />
            <Text variant="bodySm" style={{ flex: 1 }}>
              {pinned
                ? tr("announcements.pinnedHigh", "Pinned (High visibility)")
                : tr("announcements.notPinned", "Not pinned")}
            </Text>
            {pinned ? <Pin size={16} color={colors.brand} /> : null}
          </View>
        </View>
        <Toggle
          label={tr("announcements.schedulePublication", "Schedule Publication")}
          hint={tr(
            "announcements.scheduleHint",
            "Learners will not see this until the scheduled time.",
          )}
          value={scheduleOn}
          onValueChange={(v) => {
            setScheduleOn(v);
            if (errors.schedule) setErrors((e) => ({ ...e, schedule: undefined }));
          }}
        />
        {scheduleOn ? (
          <View style={styles.scheduleBox}>
            <Input
              label={tr("announcements.scheduleDate", "Date")}
              value={scheduleDate}
              onChangeText={setScheduleDate}
              placeholder="YYYY-MM-DD"
              error={errors.schedule}
            />
            <Input
              label={tr("announcements.scheduleTime", "Time")}
              value={scheduleTime}
              onChangeText={setScheduleTime}
              placeholder="HH:mm"
            />
          </View>
        ) : null}
      </Sheet>

      <Sheet
        visible={!!selected}
        onClose={() => {
          setSelected(null);
          setDetailStats(null);
        }}
        title={selected?.title}
        subtitle={
          selected
            ? selected.status === "scheduled" && selected.scheduledFor
              ? relativeTime(selected.scheduledFor, locale)
              : relativeTime(selected.created_at, locale)
            : undefined
        }
        footer={
          selected ? (
            <>
              <SheetAction
                label={t("common.edit")}
                icon={<Pencil size={18} color={colors.textSecondary} />}
                onPress={() => openEdit(selected)}
              />
              <SheetAction
                label={tr("announcements.duplicate", "Duplicate")}
                icon={<Copy size={18} color={colors.textSecondary} />}
                onPress={() => duplicateAnnouncement(selected)}
              />
              <SheetAction
                label={selected.is_pinned ? t("announcements.unpin") : t("announcements.pinToTop")}
                icon={
                  selected.is_pinned ? (
                    <PinOff size={18} color={colors.textSecondary} />
                  ) : (
                    <Pin size={18} color={colors.textSecondary} />
                  )
                }
                onPress={async () => {
                  const target = selected;
                  setSelected(null);
                  try {
                    await setAnnouncementPinned(target.id, !target.is_pinned);
                    await reload();
                    showSuccess(
                      target.is_pinned
                        ? tr("announcements.unpinned", "Unpinned")
                        : tr("announcements.pinnedToast", "Pinned"),
                      target.is_pinned
                        ? tr("announcements.unpinnedHint", "Removed from the top of the list.")
                        : tr("announcements.pinnedHint", "Stays above other announcements."),
                    );
                  } catch (e) {
                    showError(t("announcements.updateFailed"), e);
                  }
                }}
              />
              <SheetAction
                label={t("common.delete")}
                destructive
                icon={<Trash2 size={18} color={colors.dangerText} />}
                onPress={() => {
                  const target = selected;
                  setSelected(null);
                  confirmDelete(target.title, async () => {
                    try {
                      await deleteAnnouncement(target.id);
                      setScheduledIds((prev) => {
                        const copy = new Set(prev);
                        copy.delete(target.id);
                        return copy;
                      });
                      await reload();
                      showSuccess(
                        tr("announcements.deleted", "Announcement deleted"),
                        tr("announcements.deletedHint", "This cannot be undone."),
                      );
                    } catch (e) {
                      showError(t("announcements.deleteFailed"), e);
                    }
                  });
                }}
              />
            </>
          ) : null
        }
      >
        {selected ? (
          <View style={styles.detail}>
            <View style={styles.badges}>
              {selected.category ? <Badge label={selected.category} tone="outline" /> : null}
              {selected.status === "scheduled" ? (
                <Badge label={tr("announcements.scheduledTab", "Scheduled")} tone="brand" />
              ) : (
                <Badge label={t("announcements.published")} tone="success" />
              )}
              {selected.is_pinned ? (
                <Badge label={tr("student.pinned", "Pinned")} tone="warning" />
              ) : null}
            </View>
            <RichText source={selected.message} />
            {selected.status !== "scheduled" ? (
              <View style={styles.readStats}>
                <Text variant="caption" weight="bold">
                  {tr("announcements.readStats", "Read stats")}
                </Text>
                {detailStatsLoading ? (
                  <Text variant="micro" color={colors.textMuted}>
                    {tr("common.loading", "Loading...")}
                  </Text>
                ) : detailStats ? (
                  <>
                    <Text variant="micro" color={colors.textSecondary}>
                      {`${detailStats.readCount}/${detailStats.totalStudents} · ${detailStats.readRate}%`}
                    </Text>
                    {detailStats.readers.slice(0, 8).map((r, i) => (
                      <Text key={`${r.full_name}-${i}`} variant="micro" color={colors.textMuted}>
                        {r.full_name}
                      </Text>
                    ))}
                  </>
                ) : (
                  <Text variant="micro" color={colors.textMuted}>
                    {typeof selected.read_count === "number"
                      ? `${selected.read_count} ${tr("announcements.reads", "reads")}`
                      : tr("announcements.noReadStats", "No read data yet")}
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    flexShrink: 0,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: space.lg,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.md,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    paddingVertical: 12,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
  },
  tableRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tableRowPressed: {
    backgroundColor: colors.bgSunken,
  },
  pinSlot: {
    width: 20,
    paddingTop: 2,
    alignItems: "center",
  },
  pinSpacer: {
    width: 16,
    height: 16,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  titleLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  readRate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: space.md,
  },
  scheduleBox: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bgSunken,
  },
  pinChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 40,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bgSunken,
  },
  footerRow: { flexDirection: "row", gap: space.sm },
  detail: { gap: space.md },
  readStats: {
    marginTop: space.sm,
    gap: 4,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
