import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Image, StyleSheet, View } from "react-native";
import {
  BookCheck,
  ClipboardList,
  FileText,
  Heart,
  MessageSquareQuote,
  Settings,
  Sparkles,
  Upload,
} from "lucide-react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { useDisplayIdentity } from "../../../src/hooks/useDisplayIdentity";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import { listParentWorks, type StudentWorkRow } from "../../../src/services/uploads";
import { colors, radius, space } from "../../../src/theme/tokens";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  IconTile,
  RichText,
  SectionHeader,
  Sheet,
  StatCard,
  Text,
  showError,
  statTones,
} from "../../../src/ui";

const isImage = (url: string) => /\.(png|jpe?g|gif|webp|heic)(\?|$)/i.test(url);

export default function ParentDashboardScreen() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const identity = useDisplayIdentity();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [works, setWorks] = useState<StudentWorkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<StudentWorkRow | null>(null);

  const reload = useCallback(async () => {
    if (!user) {
      setWorks([]);
      return;
    }
    setWorks(await listParentWorks(user.id));
  }, [user]);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("parent.loadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const stats = useMemo(
    () => ({
      total: works.length,
      reviewed: works.filter((w) => w.status === "reviewed").length,
    }),
    [works],
  );

  const firstName = identity.name?.split(" ")[0];

  const quickActions = [
    {
      key: "upload",
      label: t("parent.uploadWork"),
      hint: t("parent.uploadWorkHint"),
      icon: Upload,
      href: "/(roles)/parent/submissions",
    },
    {
      key: "submissions",
      label: t("admin.submissions"),
      hint: t("parent.submissionsHint"),
      icon: BookCheck,
      href: "/(roles)/parent/submissions",
    },
    {
      key: "settings",
      label: t("sidebar.settings"),
      hint: t("parent.settingsHint"),
      icon: Settings,
      href: "/(roles)/parent/settings",
    },
  ] as const;

  return (
    <DashboardShell
      title={t("parent.dashboard")}
      subtitle={identity.email ?? undefined}
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
    >
      <View style={styles.banner}>
        <View style={styles.orb} />
        <Avatar
          name={identity.name}
          uri={identity.avatarUrl}
          size={52}
          tone="onBrand"
          letters={2}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h3" weight="extrabold" color={colors.white} numberOfLines={1}>
            {firstName ? `${t("dashboard.welcomeBack")}, ${firstName}` : t("dashboard.welcomeBack")}
          </Text>
          <Text variant="micro" color={colors.onBrandMuted} numberOfLines={2}>
            {t("parent.bannerHint")}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <StatCard
          label={t("parent.uploaded")}
          value={stats.total}
          icon={<ClipboardList size={17} color={statTones.brand.iconFg} />}
          tone="brand"
        />
        <StatCard
          label={t("parent.reviewed")}
          value={stats.reviewed}
          icon={<MessageSquareQuote size={17} color={statTones.emerald.iconFg} />}
          tone="emerald"
        />
      </View>

      <SectionHeader title={t("dashboard.quickActions")} icon={<Sparkles size={17} color={colors.brand} />} />
      <View style={styles.actions}>
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Card
              key={action.key}
              onPress={() => router.push(action.href as never)}
              style={styles.actionCard}
              elevation="xs"
            >
              <IconTile size={40}>
                <Icon size={19} color={colors.brandDeep} />
              </IconTile>
              <Text variant="micro" weight="bold" center numberOfLines={2} style={{ marginTop: space.sm }}>
                {action.label}
              </Text>
            </Card>
          );
        })}
      </View>

      <SectionHeader
        title={t("parent.recentWork")}
        icon={<Heart size={17} color={colors.brand} />}
        action={
          works.length > 4 ? (
            <Button
              label={t("common.viewAll")}
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => router.push("/(roles)/parent/submissions")}
            />
          ) : undefined
        }
      />

      {works.length === 0 ? (
        <EmptyState
          icon={<Upload size={24} color={colors.brandDeep} />}
          title={t("parent.noWork")}
          subtitle={t("parent.noWorkHint")}
          actionLabel={t("parent.uploadWork")}
          onAction={() => router.push("/(roles)/parent/submissions")}
        />
      ) : (
        works.slice(0, 4).map((work) => {
          const reviewed = work.status === "reviewed";
          return (
            <Card
              key={work.id}
              padded={false}
              accent={reviewed ? colors.emerald : colors.amber}
              onPress={() => setOpen(work)}
            >
              <View style={styles.row}>
                {isImage(work.image_url) ? (
                  <Image source={{ uri: work.image_url }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <IconTile size={52} rounded={radius.md}>
                    <FileText size={21} color={colors.brandDeep} />
                  </IconTile>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodySm" weight="bold" numberOfLines={1}>
                    {work.student_name ?? t("parent.myChild")}
                  </Text>
                  <Text variant="micro" color={colors.textMuted} numberOfLines={1}>
                    {new Date(work.created_at).toLocaleDateString(locale)}
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
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  stats: { flexDirection: "row", gap: space.md },
  actions: { flexDirection: "row", gap: space.md },
  actionCard: {
    flexGrow: 1,
    flexBasis: "29%",
    alignItems: "center",
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.gray100 },
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
