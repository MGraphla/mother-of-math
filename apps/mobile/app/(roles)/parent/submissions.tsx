import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import {
  Camera,
  FileText,
  ImageIcon,
  MessageSquareQuote,
  Upload,
} from "lucide-react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import {
  pickDocumentForUpload,
  pickImageForUpload,
  takePhotoForUpload,
  type PickedFile,
} from "../../../src/native/uploads";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  listParentWorks,
  uploadStudentWorkFromUri,
  type StudentWorkRow,
} from "../../../src/services/uploads";
import { colors, radius, space } from "../../../src/theme/tokens";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  IconTile,
  Input,
  OptionGroup,
  RichText,
  SectionHeader,
  Sheet,
  SheetAction,
  Text,
  showError,
  showSuccess,
} from "../../../src/ui";

type Filter = "all" | "reviewed" | "waiting";

const isImage = (url: string) => /\.(png|jpe?g|gif|webp|heic)(\?|$)/i.test(url);

export default function ParentSubmissionsScreen() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [items, setItems] = useState<StudentWorkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<StudentWorkRow | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    setItems(await listParentWorks(user.id));
  }, [user]);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("parent.loadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const counts = useMemo(
    () => ({
      all: items.length,
      reviewed: items.filter((i) => i.status === "reviewed").length,
      waiting: items.filter((i) => i.status !== "reviewed").length,
    }),
    [items],
  );

  const visible = items.filter((i) =>
    filter === "all" ? true : filter === "reviewed" ? i.status === "reviewed" : i.status !== "reviewed",
  );

  const upload = async (pick: () => Promise<PickedFile | null>) => {
    if (!user) return;
    setSourceOpen(false);
    const file = await pick();
    if (!file?.uri) return;
    setUploading(true);
    try {
      const row = await uploadStudentWorkFromUri({
        teacherId: user.id,
        parentId: user.id,
        uri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType,
        studentName: studentName.trim() || t("parent.myChild"),
      });
      setItems((prev) => [row, ...prev]);
      showSuccess(t("parent.uploaded"), t("parent.uploadedHint"));
    } catch (e) {
      showError(t("uploads.uploadFailed"), e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardShell
      title={t("admin.submissions")}
      subtitle={t("parent.submissionsTagline")}
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("parent.loadFailed"), e);
        } finally {
          setRefreshing(false);
        }
      }}
      headerRight={
        <IconButton
          accessibilityLabel={t("parent.uploadWork")}
          onPress={() => setSourceOpen(true)}
          tone="brand"
        >
          <Upload size={19} color={colors.brandDeep} />
        </IconButton>
      }
    >
      <Card>
        <Input
          label={t("parent.childName")}
          value={studentName}
          onChangeText={setStudentName}
          placeholder={t("parent.childNamePlaceholder")}
          autoCapitalize="words"
          hint={t("parent.childNameHint")}
        />
        <Button
          label={t("parent.uploadWork")}
          onPress={() => setSourceOpen(true)}
          loading={uploading}
          icon={<Upload size={18} color={colors.white} />}
          style={{ marginTop: space.md }}
        />
      </Card>

      <OptionGroup<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: `${t("common.all")} (${counts.all})` },
          { value: "waiting", label: `${t("parent.waitingTab")} (${counts.waiting})` },
          { value: "reviewed", label: `${t("parent.reviewedTab")} (${counts.reviewed})` },
        ]}
      />

      <SectionHeader
        title={t("parent.recentWork")}
        icon={<MessageSquareQuote size={17} color={colors.brand} />}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<Upload size={24} color={colors.brandDeep} />}
          title={t("parent.noWork")}
          subtitle={t("parent.noWorkHint")}
          actionLabel={t("parent.uploadWork")}
          onAction={() => setSourceOpen(true)}
        />
      ) : (
        visible.map((item) => {
          const reviewed = item.status === "reviewed";
          return (
            <Card
              key={item.id}
              padded={false}
              accent={reviewed ? colors.emerald : colors.amber}
              onPress={() => setOpen(item)}
            >
              <View style={styles.row}>
                {isImage(item.image_url) ? (
                  <Image source={{ uri: item.image_url }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <IconTile size={56} rounded={radius.md}>
                    <FileText size={22} color={colors.brandDeep} />
                  </IconTile>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodySm" weight="bold" numberOfLines={1}>
                    {item.student_name ?? t("parent.myChild")}
                  </Text>
                  <Text variant="micro" color={colors.textMuted} numberOfLines={1}>
                    {`${item.subject ?? "Mathematics"} · ${new Date(
                      item.created_at,
                    ).toLocaleDateString(locale)}`}
                  </Text>
                  <View style={styles.badges}>
                    <Badge
                      label={reviewed ? t("parent.hasFeedback") : t("parent.awaitingFeedback")}
                      tone={reviewed ? "success" : "warning"}
                    />
                  </View>
                </View>
              </View>
            </Card>
          );
        })
      )}

      <Sheet
        visible={sourceOpen}
        onClose={() => setSourceOpen(false)}
        title={t("uploads.chooseSource")}
        subtitle={t("parent.chooseSourceHint")}
      >
        <SheetAction
          label={t("uploads.camera")}
          hint={t("parent.cameraHint")}
          icon={<Camera size={18} color={colors.textSecondary} />}
          onPress={() => void upload(takePhotoForUpload)}
        />
        <SheetAction
          label={t("uploads.gallery")}
          hint={t("uploads.galleryHint")}
          icon={<ImageIcon size={18} color={colors.textSecondary} />}
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
        title={open?.student_name ?? t("parent.myChild")}
        subtitle={open ? new Date(open.created_at).toLocaleString(locale) : undefined}
      >
        {open && isImage(open.image_url) ? (
          <Image source={{ uri: open.image_url }} style={styles.preview} resizeMode="contain" />
        ) : null}
        {open?.feedback ? (
          <View style={styles.feedback}>
            <Text variant="micro" weight="bold" color={colors.brandDeep} uppercase>
              {t("parent.teacherFeedback")}
            </Text>
            <View style={{ marginTop: space.sm }}>
              <RichText source={open.feedback} />
            </View>
          </View>
        ) : (
          <Text variant="caption" color={colors.textMuted} center>
            {t("parent.awaitingFeedbackHint")}
          </Text>
        )}
      </Sheet>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.gray100 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  feedback: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandMute,
  },
});
