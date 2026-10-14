import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import {
  BookOpen,
  Download,
  ExternalLink,
  Eye,
  File,
  FileText,
  Folder,
  Grid,
  Image as ImageIcon,
  Link as LinkIcon,
  List,
  MoreVertical,
  Music,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  UploadCloud,
  Video,
  X,
} from "lucide-react-native";
import {
  DashedZone,
  MiniStatCard,
  PageHero,
  Panel,
  ToolbarSearch,
} from "../../../src/components/WebMatchChrome";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { downloadAndShare } from "../../../src/native/downloads";
import { savedFileHint } from "../../../src/native/saveFile";
import {
  pickAnyForUpload,
  pickDocumentForUpload,
  pickImageForUpload,
  type PickedFile,
} from "../../../src/native/uploads";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  RESOURCE_TOPICS,
  createResource,
  deleteResource,
  detectFileType,
  getTeacherResourceTopics,
  listResourcesForTeacher,
  updateResource,
  uploadResourceFile,
  type ResourceRow,
} from "../../../src/services/resources";
import { colors, radius, space } from "../../../src/theme/tokens";
import {
  Badge,
  Button,
  Input,
  OptionGroup,
  Select,
  Sheet,
  SheetAction,
  Text,
  confirmDelete,
  showError,
  showSuccess,
} from "../../../src/ui";

type ViewMode = "list" | "grid";
type UploadTab = "file" | "link" | "bulk";

type BulkItem = {
  id: string;
  file: PickedFile;
  title: string;
  topic: string;
};

const topicOptions = RESOURCE_TOPICS.map((t) => ({ value: t, label: t }));

const resourceUrl = (r: ResourceRow) => r.file_url || r.url || null;

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

const getInitials = (title: string): string => {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return title.substring(0, 2).toUpperCase() || "?";
};

const placeholderColors = (seed: string) => {
  const palette = [
    ["#8B5CF6", "#7C3AED"],
    ["#3B82F6", "#06B6D4"],
    ["#10B981", "#14B8A6"],
    ["#F59E0B", "#F97316"],
    ["#EC4899", "#F43F5E"],
    ["#6366F1", "#2563EB"],
    ["#D946EF", "#EC4899"],
    ["#22D3EE", "#3B82F6"],
  ] as const;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
};

const iconFor = (type?: string | null) => {
  switch ((type ?? "").toLowerCase()) {
    case "image":
      return ImageIcon;
    case "video":
      return Video;
    case "link":
      return LinkIcon;
    case "audio":
      return Music;
    case "pdf":
    case "document":
      return FileText;
    default:
      return File;
  }
};

const stripExtension = (name: string) => name.replace(/\.[^/.]+$/, "");

const fileTypeLabel = (type?: string | null): string => {
  switch ((type ?? "").toLowerCase()) {
    case "pdf":
      return "PDF";
    case "document":
      return "Document";
    case "video":
      return "Video";
    case "image":
      return "Image";
    case "link":
      return "Link";
    case "audio":
      return "Audio";
    case "spreadsheet":
      return "Spreadsheet";
    default:
      return type || "File";
  }
};

export default function TeacherResourcesScreen() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";
  const { width } = useWindowDimensions();
  const gridCardWidth = Math.floor((width - space.xl * 2 - space.md) / 2);

  const [items, setItems] = useState<ResourceRow[]>([]);
  const [existingTopics, setExistingTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<UploadTab>("file");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTopic, setFormTopic] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ResourceRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editFile, setEditFile] = useState<PickedFile | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editTitleError, setEditTitleError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    const [rows, topics] = await Promise.all([
      listResourcesForTeacher(user.id),
      getTeacherResourceTopics(user.id),
    ]);
    setItems(rows);
    setExistingTopics(topics);
  }, [user]);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("resources.loadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const stats = useMemo(() => {
    let documents = 0;
    let videos = 0;
    let links = 0;
    for (const r of items) {
      const type = (r.file_type ?? "").toLowerCase();
      if (type === "document" || type === "pdf") documents += 1;
      else if (type === "video") videos += 1;
      else if (type === "link") links += 1;
    }
    return {
      total: items.length,
      documents,
      videos,
      links,
      topics: existingTopics.length,
    };
  }, [items, existingTopics]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((r) => {
      if (topicFilter !== "all" && r.topic !== topicFilter) return false;
      if (!q) return true;
      return [r.title, r.description, r.topic]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [items, query, topicFilter]);

  const resourcesByTopic = useMemo(() => {
    const groups: Record<string, ResourceRow[]> = {};
    for (const r of visible) {
      const topic = r.topic || "Uncategorized";
      if (!groups[topic]) groups[topic] = [];
      groups[topic].push(r);
    }
    return groups;
  }, [visible]);

  const topicFilterOptions = useMemo(
    () => [
      { value: "all", label: "All Topics" },
      ...existingTopics.map((topic) => ({ value: topic, label: topic })),
    ],
    [existingTopics],
  );

  const resetUploadForm = () => {
    setUploadTab("file");
    setFormTitle("");
    setFormDescription("");
    setFormTopic("");
    setFormUrl("");
    setPickedFile(null);
    setBulkItems([]);
    setTitleError(null);
    setUrlError(null);
  };

  const openUpload = () => {
    resetUploadForm();
    setUploadOpen(true);
  };

  const openEdit = (resource: ResourceRow) => {
    setSelected(null);
    setEditing(resource);
    setEditTitle(resource.title);
    setEditDescription(resource.description ?? "");
    setEditTopic(resource.topic ?? "");
    setEditFile(null);
    setEditTitleError(null);
    setEditOpen(true);
  };

  const pickUploadFile = async () => {
    const picked = await pickAnyForUpload();
    if (!picked) return;
    setPickedFile(picked);
    if (!formTitle.trim()) setFormTitle(stripExtension(picked.name));
  };

  const addBulkFile = async () => {
    const picked = await pickAnyForUpload();
    if (!picked) return;
    setBulkItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: picked,
        title: stripExtension(picked.name),
        topic: formTopic || "",
      },
    ]);
  };

  const addBulkFromDocs = async () => {
    const picked = await pickDocumentForUpload();
    if (!picked) return;
    setBulkItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: picked,
        title: stripExtension(picked.name),
        topic: formTopic || "",
      },
    ]);
  };

  const addBulkFromImages = async () => {
    const picked = await pickImageForUpload();
    if (!picked) return;
    setBulkItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: picked,
        title: stripExtension(picked.name),
        topic: formTopic || "",
      },
    ]);
  };

  const submitUpload = async () => {
    if (!user) return;

    if (uploadTab === "bulk") {
      if (bulkItems.length === 0) {
        showError("No files", new Error("Add at least one file to upload."));
        return;
      }
      setSaving(true);
      try {
        let success = 0;
        for (const item of bulkItems) {
          const upload = await uploadResourceFile({
            teacherId: user.id,
            uri: item.file.uri,
            fileName: item.file.name,
            mimeType: item.file.mimeType,
          });
          await createResource({
            teacher_id: user.id,
            title: item.title.trim() || stripExtension(item.file.name),
            topic: item.topic || undefined,
            file_url: upload.file_url,
            file_type: upload.file_type,
          });
          success += 1;
        }
        setUploadOpen(false);
        resetUploadForm();
        await reload();
        showSuccess(
          "Upload complete",
          `Successfully uploaded ${success} resource${success === 1 ? "" : "s"}.`,
        );
      } catch (e) {
        showError(t("resources.publishFailed"), e);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!formTitle.trim()) {
      setTitleError(t("resources.titleRequired"));
      return;
    }

    if (uploadTab === "link" && !formUrl.trim()) {
      setUrlError("Please enter a URL.");
      return;
    }

    if (uploadTab === "file" && !pickedFile) {
      showError("Missing file", new Error("Please select a file to upload."));
      return;
    }

    setSaving(true);
    try {
      if (uploadTab === "file" && pickedFile) {
        const upload = await uploadResourceFile({
          teacherId: user.id,
          uri: pickedFile.uri,
          fileName: pickedFile.name,
          mimeType: pickedFile.mimeType,
        });
        await createResource({
          teacher_id: user.id,
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          topic: formTopic || undefined,
          file_url: upload.file_url,
          file_type: upload.file_type,
        });
      } else {
        const url = formUrl.trim();
        const lower = url.toLowerCase();
        const fileType =
          lower.includes("youtube.com") ||
          lower.includes("youtu.be") ||
          lower.includes("vimeo.com")
            ? "video"
            : "link";
        await createResource({
          teacher_id: user.id,
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          topic: formTopic || undefined,
          file_url: url,
          file_type: fileType,
        });
      }
      setUploadOpen(false);
      resetUploadForm();
      await reload();
      showSuccess(t("resources.published"), t("resources.publishedHint"));
    } catch (e) {
      showError(t("resources.publishFailed"), e);
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!user || !editing) return;
    if (!editTitle.trim()) {
      setEditTitleError(t("resources.titleRequired"));
      return;
    }

    setEditSaving(true);
    try {
      let fileUrl: string | undefined;
      let fileType: string | undefined;
      let thumbnail: string | null | undefined;

      if (editFile) {
        const upload = await uploadResourceFile({
          teacherId: user.id,
          uri: editFile.uri,
          fileName: editFile.name,
          mimeType: editFile.mimeType,
        });
        fileUrl = upload.file_url;
        fileType = upload.file_type;
        thumbnail = upload.file_type === "image" ? upload.file_url : null;
      }

      await updateResource(editing.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        topic: editTopic || null,
        ...(fileUrl
          ? {
              file_url: fileUrl,
              file_type: fileType,
              thumbnail_url: thumbnail,
            }
          : {}),
      });

      setEditOpen(false);
      setEditing(null);
      setEditFile(null);
      await reload();
      showSuccess("Resource updated", "Your changes were saved.");
    } catch (e) {
      showError("Could not update the resource", e);
    } finally {
      setEditSaving(false);
    }
  };

  const openResource = async (item: ResourceRow) => {
    const url = resourceUrl(item);
    if (!url) {
      showError(t("student.noFile"), new Error(t("student.noFileHint")));
      return;
    }
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) throw new Error("This link cannot be opened on this device.");
      await Linking.openURL(url);
    } catch (e) {
      showError("Could not open resource", e);
    }
  };

  const download = async (item: ResourceRow) => {
    const url = resourceUrl(item);
    if (!url) {
      showError(t("student.noFile"), new Error(t("student.noFileHint")));
      return;
    }
    setBusyId(item.id);
    try {
      const ext = url.split("?")[0].split(".").pop();
      const name = ext && ext.length <= 5 ? `${item.title}.${ext}` : item.title;
      await downloadAndShare(url, name);
      showSuccess("Saved to your phone", savedFileHint(name));
    } catch (e) {
      showError(t("student.downloadFailed"), e);
    } finally {
      setBusyId(null);
    }
  };

  const removeResource = (item: ResourceRow) => {
    setSelected(null);
    confirmDelete(item.title, async () => {
      try {
        await deleteResource(item.id);
        setItems((prev) => prev.filter((r) => r.id !== item.id));
        await reload();
        showSuccess("Resource deleted", "The resource was removed.");
      } catch (e) {
        showError(t("resources.deleteFailed"), e);
      }
    });
  };

  const renderListRow = (item: ResourceRow, index: number, total: number) => {
    const Icon = iconFor(item.file_type);
    const thumb =
      item.thumbnail_url || (item.file_type === "image" ? resourceUrl(item) : null);
    const isLast = index === total - 1;

    return (
      <Pressable
        key={item.id}
        onPress={() => setSelected(item)}
        style={[styles.listRow, !isLast && styles.listRowBorder]}
        accessibilityRole="button"
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.listThumb} />
        ) : (
          <View style={styles.listIconTile}>
            <Icon size={18} color={colors.brandDeep} />
          </View>
        )}
        <View style={styles.listMain}>
          <Text variant="bodySm" weight="bold" numberOfLines={2}>
            {item.title}
          </Text>
          {item.description ? (
            <Text
              variant="micro"
              color={colors.textMuted}
              numberOfLines={1}
              style={{ marginTop: 2 }}
            >
              {item.description}
            </Text>
          ) : null}
          <View style={styles.listMeta}>
            {item.topic ? <Badge label={item.topic} tone="outline" /> : null}
            <Text variant="micro" color={colors.textFaint}>
              {relativeTime(item.created_at, locale)}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => setSelected(item)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Resource actions"
        >
          <MoreVertical size={18} color={colors.textFaint} />
        </Pressable>
      </Pressable>
    );
  };

  const renderGridCard = (item: ResourceRow) => {
    const Icon = iconFor(item.file_type);
    const thumb =
      item.thumbnail_url ||
      (item.file_type === "image" ? resourceUrl(item) : null);
    const [from, to] = placeholderColors(item.topic || item.title);

    return (
      <Pressable
        key={item.id}
        onPress={() => setSelected(item)}
        style={[styles.gridCard, { width: gridCardWidth }]}
        accessibilityRole="button"
      >
        <View style={styles.gridThumbWrap}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.gridThumb} />
          ) : (
            <View style={[styles.gridPlaceholder, { backgroundColor: from }]}>
              <View style={[styles.gridPlaceholderTint, { backgroundColor: to }]} />
              <Text variant="h3" weight="bold" color={colors.white}>
                {getInitials(item.title)}
              </Text>
              <Text
                variant="micro"
                color="rgba(255,255,255,0.75)"
                style={{ marginTop: 2 }}
              >
                {(item.file_type || "file").toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.gridTypeChip}>
            <Icon size={12} color={colors.brandDeep} />
          </View>
        </View>
        <View style={styles.gridBody}>
          <Text variant="caption" weight="bold" numberOfLines={2}>
            {item.title}
          </Text>
          {item.description ? (
            <View style={styles.summaryBox}>
              <Sparkles size={12} color={colors.brandDeep} />
              <Text variant="micro" color={colors.textMuted} numberOfLines={3} style={{ flex: 1 }}>
                {item.description}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.gridFooter}>
          <View style={styles.gridFooterStats}>
            <Download size={14} color={colors.textMuted} />
            <Text variant="micro" color={colors.textMuted}>
              {item.download_count ?? 0}
            </Text>
            <Eye size={14} color={colors.textMuted} />
            <Text variant="micro" color={colors.textMuted}>
              {item.view_count ?? 0}
            </Text>
          </View>
          <Text variant="micro" color={colors.textFaint} numberOfLines={1}>
            {relativeTime(item.created_at, locale)}
          </Text>
        </View>
      </Pressable>
    );
  };

  const uploadFooterLabel =
    uploadTab === "bulk"
      ? `Upload ${bulkItems.length} File${bulkItems.length === 1 ? "" : "s"}`
      : "Save Resource";

  const selectedUrl = selected ? resourceUrl(selected) : null;
  const selectedIsImage =
    !!selected &&
    ((selected.file_type ?? "").toLowerCase() === "image" ||
      detectFileType(selectedUrl || "", undefined) === "image");

  return (
    <DashboardShell
      title="Resource Manager"
      hideTitle
      hideAvatar
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("resources.loadFailed"), e);
        } finally {
          setRefreshing(false);
        }
      }}
    >
      <PageHero
        icon={<BookOpen size={22} color={colors.brandDeep} />}
        title="Resource Manager"
        subtitle="Upload and organize learning materials for your students"
        actions={
          <View style={styles.heroActions}>
            <View style={styles.viewTrack}>
              <Pressable
                onPress={() => setViewMode("list")}
                style={[styles.viewBtn, viewMode === "list" && styles.viewBtnOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: viewMode === "list" }}
                accessibilityLabel="List view"
              >
                <List
                  size={16}
                  color={viewMode === "list" ? colors.text : colors.textMuted}
                />
              </Pressable>
              <Pressable
                onPress={() => setViewMode("grid")}
                style={[styles.viewBtn, viewMode === "grid" && styles.viewBtnOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: viewMode === "grid" }}
                accessibilityLabel="Grid view"
              >
                <Grid
                  size={16}
                  color={viewMode === "grid" ? colors.text : colors.textMuted}
                />
              </Pressable>
            </View>
            <Button
              label="Upload Resources"
              size="sm"
              icon={<UploadCloud size={16} color={colors.white} />}
              onPress={openUpload}
            />
          </View>
        }
      />

      <View style={styles.statsRow}>
        <MiniStatCard
          icon={<BookOpen size={16} color={colors.brandDeep} />}
          value={stats.total}
          label="Total"
          iconBg={colors.brandSoft}
        />
        <MiniStatCard
          icon={<FileText size={16} color={colors.brandDeep} />}
          value={stats.documents}
          label="Documents"
          iconBg={colors.brandSoft}
        />
        <MiniStatCard
          icon={<Video size={16} color={colors.brandDeep} />}
          value={stats.videos}
          label="Videos"
          iconBg={colors.brandSoft}
        />
        <MiniStatCard
          icon={<LinkIcon size={16} color={colors.brandDeep} />}
          value={stats.links}
          label="Links"
          iconBg={colors.brandSoft}
        />
        <MiniStatCard
          icon={<Folder size={16} color={colors.brandDeep} />}
          value={stats.topics}
          label="Topics"
          iconBg={colors.brandSoft}
        />
      </View>

      <View style={styles.filterRow}>
        <View style={styles.filterSearch}>
          <ToolbarSearch
            value={query}
            onChangeText={setQuery}
            placeholder="Search resources..."
          />
        </View>
        <Select
          value={topicFilter}
          onChange={setTopicFilter}
          options={topicFilterOptions}
          placeholder="All Topics"
          compact
        />
      </View>

      {visible.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <UploadCloud size={28} color={colors.textMuted} />
          </View>
          <Text variant="body" weight="semibold" center>
            {items.length === 0 ? "No resources found" : t("common.noResults")}
          </Text>
          <Text
            variant="caption"
            color={colors.textMuted}
            center
            style={{ marginTop: space.sm, maxWidth: 280 }}
          >
            {items.length === 0
              ? "Upload files or add links to share learning materials with your students."
              : "Try adjusting your search or filters to find what you're looking for."}
          </Text>
          {items.length === 0 ? (
            <Button
              label="Add First Resource"
              icon={<Plus size={16} color={colors.white} />}
              onPress={openUpload}
              style={{ marginTop: space.lg }}
            />
          ) : null}
        </View>
      ) : viewMode === "list" ? (
        <Panel>
          {visible.map((item, index) => renderListRow(item, index, visible.length))}
        </Panel>
      ) : (
        <View style={styles.gridSections}>
          {Object.entries(resourcesByTopic).map(([topic, topicResources]) => (
            <View key={topic} style={styles.topicSection}>
              <View style={styles.topicHeader}>
                <Folder size={18} color={colors.textMuted} />
                <Text variant="bodySm" weight="semibold" style={{ flex: 1 }}>
                  {topic}
                </Text>
                <Badge label={String(topicResources.length)} tone="neutral" />
              </View>
              <View style={styles.grid}>
                {topicResources.map(renderGridCard)}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Upload sheet */}
      <Sheet
        visible={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload Resources"
        subtitle="Upload files or add links to share with students"
        footer={
          <Button label={uploadFooterLabel} onPress={submitUpload} loading={saving} />
        }
      >
        <OptionGroup<UploadTab>
          value={uploadTab}
          onChange={(tab) => {
            setUploadTab(tab);
            setTitleError(null);
            setUrlError(null);
          }}
          variant="segment"
          options={[
            { value: "file", label: "Single File" },
            { value: "bulk", label: "Bulk Upload" },
            { value: "link", label: "Web Link" },
          ]}
        />

        {uploadTab !== "bulk" ? (
          <>
            <Input
              label="Title"
              value={formTitle}
              onChangeText={(v) => {
                setFormTitle(v);
                if (titleError) setTitleError(null);
              }}
              placeholder={t("resources.titlePlaceholder")}
              error={titleError}
              required
            />
            <Input
              label="Description"
              value={formDescription}
              onChangeText={setFormDescription}
              placeholder={t("resources.descriptionPlaceholder")}
              multiline
            />
            <Select
              label="Topic"
              value={formTopic}
              onChange={setFormTopic}
              options={topicOptions}
              placeholder="Select a topic"
            />
          </>
        ) : (
          <Select
            label="Default topic"
            value={formTopic}
            onChange={setFormTopic}
            options={topicOptions}
            placeholder="Select a topic"
            hint="Applied to newly added bulk files"
          />
        )}

        {uploadTab === "file" ? (
          pickedFile ? (
            <View style={styles.pickBlock}>
              <View style={styles.pickedFileRow}>
                <View style={styles.listIconTile}>
                  <File size={18} color={colors.brandDeep} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodySm" weight="semibold" numberOfLines={1}>
                    {pickedFile.name}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setPickedFile(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove file"
                >
                  <X size={16} color={colors.textMuted} />
                </Pressable>
              </View>
              <Button
                label="Choose different file"
                variant="ghost"
                size="sm"
                onPress={() => void pickUploadFile()}
              />
            </View>
          ) : (
            <DashedZone onPress={() => void pickUploadFile()}>
              <View style={styles.dropIcon}>
                <UploadCloud size={24} color={colors.textMuted} />
              </View>
              <Text variant="bodySm" weight="semibold">
                Click to upload
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                or drag and drop
              </Text>
            </DashedZone>
          )
        ) : null}

        {uploadTab === "link" ? (
          <Input
            label="URL"
            value={formUrl}
            onChangeText={(v) => {
              setFormUrl(v);
              if (urlError) setUrlError(null);
            }}
            placeholder="https://..."
            autoCapitalize="none"
            keyboardType="url"
            error={urlError}
            required
            hint="YouTube / Vimeo links are saved as videos"
          />
        ) : null}

        {uploadTab === "bulk" ? (
          <View style={{ gap: space.md }}>
            <View style={styles.bulkActions}>
              <Button
                label="Add file"
                variant="outline"
                size="sm"
                icon={<Plus size={16} color={colors.brandDark} />}
                onPress={() => void addBulkFile()}
              />
              <Button
                label="Document"
                variant="ghost"
                size="sm"
                onPress={() => void addBulkFromDocs()}
              />
              <Button
                label="Image"
                variant="ghost"
                size="sm"
                onPress={() => void addBulkFromImages()}
              />
            </View>

            {bulkItems.length === 0 ? (
              <Text variant="caption" color={colors.textMuted}>
                Pick files one by one. Each item gets an editable title and topic before upload.
              </Text>
            ) : (
              <>
                <View style={styles.bulkHeader}>
                  <Text variant="caption" weight="semibold">
                    Files to upload ({bulkItems.length})
                  </Text>
                  <Pressable onPress={() => setBulkItems([])} hitSlop={8}>
                    <Text variant="micro" weight="semibold" color={colors.dangerText}>
                      Clear all
                    </Text>
                  </Pressable>
                </View>
                {bulkItems.map((item) => (
                  <View key={item.id} style={styles.bulkCard}>
                    <View style={styles.bulkCardTop}>
                      <File size={18} color={colors.textMuted} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Input
                          value={item.title}
                          onChangeText={(title) =>
                            setBulkItems((prev) =>
                              prev.map((b) => (b.id === item.id ? { ...b, title } : b)),
                            )
                          }
                          placeholder="Title"
                        />
                        <Text variant="micro" color={colors.textFaint} numberOfLines={1}>
                          {item.file.name}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() =>
                          setBulkItems((prev) => prev.filter((b) => b.id !== item.id))
                        }
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Remove file"
                      >
                        <X size={16} color={colors.textMuted} />
                      </Pressable>
                    </View>
                    <Select
                      value={item.topic}
                      onChange={(topic) =>
                        setBulkItems((prev) =>
                          prev.map((b) => (b.id === item.id ? { ...b, topic } : b)),
                        )
                      }
                      options={topicOptions}
                      placeholder="Topic"
                      compact
                    />
                  </View>
                ))}
              </>
            )}
          </View>
        ) : null}
      </Sheet>

      {/* Edit sheet */}
      <Sheet
        visible={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        title="Edit Resource"
        subtitle="Update resource details"
        footer={<Button label="Update" onPress={submitEdit} loading={editSaving} />}
      >
        <Input
          label="Title"
          value={editTitle}
          onChangeText={(v) => {
            setEditTitle(v);
            if (editTitleError) setEditTitleError(null);
          }}
          error={editTitleError}
          required
        />
        <Input
          label="Description"
          value={editDescription}
          onChangeText={setEditDescription}
          placeholder={t("resources.descriptionPlaceholder")}
          multiline
        />
        <Select
          label="Topic"
          value={editTopic}
          onChange={setEditTopic}
          options={topicOptions}
          placeholder="Select a topic"
        />
        <Button
          label={editFile ? editFile.name : "Replace file (optional)"}
          variant={editFile ? "outline" : "ghost"}
          icon={<UploadCloud size={17} color={colors.brandDark} />}
          onPress={async () => {
            const picked = await pickAnyForUpload();
            if (picked) setEditFile(picked);
          }}
        />
      </Sheet>

      {/* Detail sheet */}
      <Sheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.title}
        subtitle={selected ? relativeTime(selected.created_at, locale) : undefined}
      >
        {selected ? (
          <>
            <View style={styles.badges}>
              <Badge label={fileTypeLabel(selected.file_type)} tone="outline" />
              {selected.topic ? (
                <Badge label={selected.topic} tone="neutral" />
              ) : null}
            </View>

            {selected.description ? (
              <Text variant="bodySm" color={colors.textSecondary} style={{ marginTop: space.sm }}>
                {selected.description}
              </Text>
            ) : null}

            {selectedIsImage && selectedUrl ? (
              <Image
                source={{ uri: selectedUrl }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : null}

            {selectedUrl ? (
              <SheetAction
                label="Open"
                hint="Open link or file in browser"
                icon={<ExternalLink size={18} color={colors.textSecondary} />}
                onPress={() => void openResource(selected)}
              />
            ) : null}

            <SheetAction
              label={t("common.download")}
              hint={
                selectedUrl
                  ? busyId === selected.id
                    ? "Preparing…"
                    : "Download / share"
                  : t("student.noFileHint")
              }
              icon={
                <Download
                  size={18}
                  color={busyId === selected.id ? colors.textFaint : colors.textSecondary}
                />
              }
              onPress={() => void download(selected)}
            />

            <SheetAction
              label="Edit"
              icon={<Pencil size={18} color={colors.textSecondary} />}
              onPress={() => openEdit(selected)}
            />

            <SheetAction
              label={t("common.delete")}
              destructive
              icon={<Trash2 size={18} color={colors.dangerText} />}
              onPress={() => removeResource(selected)}
            />
          </>
        ) : null}
      </Sheet>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  heroActions: {
    alignItems: "flex-end",
    gap: space.sm,
  },
  viewTrack: {
    flexDirection: "row",
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  viewBtn: {
    width: 36,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  viewBtnOn: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginBottom: space.md,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.md,
  },
  filterSearch: {
    flex: 1,
    minWidth: 0,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  listRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listIconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  listThumb: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  listMain: {
    flex: 1,
    minWidth: 0,
  },
  listMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: space.sm,
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  gridSections: {
    gap: space.lg,
    marginTop: space.sm,
  },
  topicSection: {
    gap: space.md,
  },
  topicHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
    marginTop: space.sm,
  },
  gridCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  gridThumbWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: colors.gray100,
    position: "relative",
  },
  gridThumb: { width: "100%", height: "100%" },
  gridPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  gridPlaceholderTint: {
    ...StyleSheet.absoluteFill,
    opacity: 0.35,
  },
  gridTypeChip: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  gridBody: {
    padding: space.md,
    gap: space.sm,
  },
  summaryBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.brandSoft,
  },
  gridFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bgSunken,
  },
  gridFooterStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.xxxl,
    paddingHorizontal: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    marginTop: space.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.bgSunken,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.md,
  },
  pickBlock: {
    gap: space.sm,
  },
  pickedFileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bgSunken,
  },
  dropIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.bgSunken,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.xs,
  },
  bulkActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  bulkHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bulkCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
    backgroundColor: colors.bgSunken,
  },
  bulkCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
  },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: radius.md,
    marginTop: space.md,
    backgroundColor: colors.gray100,
  },
});
