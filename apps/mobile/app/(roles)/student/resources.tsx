import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Linking, StyleSheet, View } from "react-native";
import {
  BookOpen,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Link as LinkIcon,
  Video,
} from "lucide-react-native";
import { useLanguage } from "../../../src/context/LanguageContext";
import { downloadAndShare } from "../../../src/native/downloads";
import { savedFileHint } from "../../../src/native/saveFile";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  listStudentResources,
  resolveActiveStudentSession,
} from "../../../src/services/studentPortal";
import { colors, radius, space } from "../../../src/theme/tokens";
import {
  Badge,
  Card,
  EmptyState,
  IconTile,
  RichText,
  Select,
  Sheet,
  SheetAction,
  Text,
  showError,
  showSuccess,
} from "../../../src/ui";

interface ResourceRow {
  id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  file_type: string | null;
  topic: string | null;
  grade_level: string | null;
  created_at: string;
  thumbnail_url?: string | null;
}

const iconFor = (type?: string | null) => {
  const t = (type ?? "").toLowerCase();
  if (t.includes("image") || /png|jpe?g|gif|webp/.test(t)) return ImageIcon;
  if (t.includes("video") || /mp4|mov|avi|youtube|vimeo/.test(t)) return Video;
  if (t.includes("link")) return LinkIcon;
  if (t.includes("sheet") || /xls|csv/.test(t)) return FileSpreadsheet;
  if (t.includes("pdf") || t.includes("word") || /docx?/.test(t)) return FileText;
  return BookOpen;
};

export default function StudentResourcesScreen() {
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [items, setItems] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [open, setOpen] = useState<ResourceRow | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const session = await resolveActiveStudentSession();
    if (!session) {
      setItems([]);
      return;
    }
    setItems(
      (await listStudentResources(session.teacher_id, session.grade_level)) as ResourceRow[],
    );
  }, []);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("student.resourcesLoadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const topics = useMemo(
    () =>
      Array.from(
        new Set(items.map((r) => r.topic).filter((x): x is string => !!x && !!x.trim())),
      ).sort(),
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((r) => {
      if (topic !== "all" && r.topic !== topic) return false;
      if (!q) return true;
      return [r.title, r.description, r.topic]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [items, query, topic]);

  const openUrl = async (url: string | null | undefined) => {
    if (!url) return;
    await Linking.openURL(url);
  };

  const download = async (item: ResourceRow) => {
    if (!item.file_url) return;
    setBusy(true);
    try {
      await downloadAndShare(item.file_url, item.title);
      showSuccess(t("common.download"), savedFileHint(item.title));
    } catch (e) {
      showError(t("common.error"), e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell
      title={t("sidebar.resources")}
      subtitle={`${items.length} ${t("sidebar.resources").toLowerCase()}`}
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("student.resourcesLoadFailed"), e);
        } finally {
          setRefreshing(false);
        }
      }}
      search={{
        value: query,
        onChangeText: setQuery,
        placeholder: t("assignment.searchPlaceholder"),
      }}
    >
      <Select
        label={t("assignment.filter.allLevels") === "assignment.filter.allLevels" ? "Topic" : "Topic"}
        value={topic}
        onChange={setTopic}
        options={[
          { value: "all", label: "All Topics" },
          ...topics.map((tp) => ({ value: tp, label: tp })),
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={24} color={colors.brandDeep} />}
          title={t("common.noData")}
        />
      ) : (
        visible.map((item) => {
          const Icon = iconFor(item.file_type || item.file_url);
          const thumb =
            item.thumbnail_url ||
            ((item.file_type ?? "").includes("image") ? item.file_url : null);
          return (
            <Card key={item.id} onPress={() => setOpen(item)} accent={colors.brand}>
              <View style={styles.row}>
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.thumb} />
                ) : (
                  <IconTile size={40}>
                    <Icon size={19} color={colors.brandDeep} />
                  </IconTile>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodySm" weight="bold" numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.description ? (
                    <Text variant="micro" color={colors.textMuted} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.badges}>
                {item.file_type ? <Badge label={item.file_type} tone="outline" /> : null}
                {item.topic ? <Badge label={item.topic} tone="brand" /> : null}
                {item.grade_level ? <Badge label={item.grade_level} tone="neutral" /> : null}
                <Text variant="micro" color={colors.textFaint}>
                  {new Date(item.created_at).toLocaleDateString(locale, {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
            </Card>
          );
        })
      )}

      <Sheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open?.title}
        subtitle={open?.topic ?? undefined}
        footer={
          open?.file_url ? (
            <>
              <SheetAction
                label="Open"
                icon={<ExternalLink size={18} color={colors.textSecondary} />}
                onPress={() => void openUrl(open.file_url)}
              />
              <SheetAction
                label={t("common.download") !== "common.download" ? t("common.download") : "Download"}
                icon={<Download size={18} color={colors.textSecondary} />}
                onPress={() => void download(open)}
              />
            </>
          ) : null
        }
      >
        {open?.description ? <RichText source={open.description} /> : null}
        {open?.file_type?.includes("image") && open.file_url ? (
          <Image source={{ uri: open.file_url }} style={styles.preview} resizeMode="contain" />
        ) : null}
        {busy ? (
          <Text variant="caption" color={colors.textMuted} center>
            …
          </Text>
        ) : null}
      </Sheet>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: space.md,
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.gray100,
  },
  preview: {
    width: "100%",
    height: 220,
    marginTop: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
});
