import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import {
  Activity,
  BookOpen,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutGrid,
  MessageSquare,
  Users,
} from "lucide-react-native";
import { useLanguage } from "../../../src/context/LanguageContext";
import { useDisplayIdentity } from "../../../src/hooks/useDisplayIdentity";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import { roleNav, type NavItem } from "../../../src/navigation/navConfig";
import {
  fetchActivityTrends,
  fetchAdminOverview,
  type ActivityTrendPoint,
  type AdminOverview,
} from "../../../src/services/admin";
import { colors, radius, space } from "../../../src/theme/tokens";
import {
  Avatar,
  Card,
  CardHeader,
  IconTile,
  LineChart,
  OptionGroup,
  SectionHeader,
  StatCard,
  StatStrip,
  Text,
  showError,
  statTones,
} from "../../../src/ui";

type Metric = "submissions" | "assignments" | "lessonPlans";

export default function AdminDashboardScreen() {
  const { t, language } = useLanguage();
  const identity = useDisplayIdentity();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [trends, setTrends] = useState<ActivityTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metric, setMetric] = useState<Metric>("submissions");

  const reload = useCallback(async () => {
    const [counts, trend] = await Promise.all([fetchAdminOverview(), fetchActivityTrends(14)]);
    setOverview(counts);
    setTrends(trend);
  }, []);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("admin.loadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const series = useMemo(() => {
    const points = trends.slice(-7);
    return points.map((point, index) => ({
      label:
        index % 2 === 0
          ? new Date(point.date).toLocaleDateString(locale, { day: "numeric", month: "short" })
          : "",
      value: point[metric],
    }));
  }, [trends, metric, locale]);

  const seriesMax = Math.max(4, ...series.map((p) => p.value));

  const modules = useMemo(
    () =>
      roleNav.admin.groups.flatMap((group) =>
        group.items.filter((item) => item.href !== "/(roles)/admin"),
      ),
    [],
  );

  const label = (item: NavItem) => {
    const translated = t(item.labelKey);
    return translated === item.labelKey ? item.fallback : translated;
  };

  const firstName = identity.name?.split(" ")[0];

  return (
    <DashboardShell
      title={t("admin.dashboard")}
      subtitle={identity.email ?? undefined}
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("admin.loadFailed"), e);
        } finally {
          setRefreshing(false);
        }
      }}
    >
      <View style={styles.banner}>
        <View style={styles.orb} />
        <Avatar name={identity.name} uri={identity.avatarUrl} size={52} tone="onBrand" letters={2} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h3" weight="extrabold" color={colors.white} numberOfLines={1}>
            {firstName ? `${t("dashboard.welcomeBack")}, ${firstName}` : t("dashboard.welcomeBack")}
          </Text>
          <Text variant="micro" color={colors.onBrandMuted} numberOfLines={2}>
            {t("admin.bannerHint")}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <StatCard
          label={t("admin.totalTeachers")}
          value={overview?.teachers ?? 0}
          caption={t("admin.registered")}
          icon={<Users size={17} color={statTones.blue.iconFg} />}
          tone="blue"
        />
        <StatCard
          label={t("admin.totalLearners")}
          value={overview?.students ?? 0}
          caption={t("admin.acrossClasses")}
          icon={<GraduationCap size={17} color={statTones.emerald.iconFg} />}
          tone="emerald"
        />
        <StatCard
          label={t("admin.lessonPlans")}
          value={overview?.lessonPlans ?? 0}
          caption={t("admin.aiGenerated")}
          icon={<BookOpen size={17} color={statTones.violet.iconFg} />}
          tone="violet"
        />
        <StatCard
          label={t("admin.assignments")}
          value={overview?.assignments ?? 0}
          caption={t("admin.created")}
          icon={<ClipboardList size={17} color={statTones.amber.iconFg} />}
          tone="amber"
        />
      </View>

      <StatStrip
        items={[
          { label: t("admin.submissions"), value: overview?.submissions ?? 0 },
          { label: t("admin.chats"), value: overview?.conversations ?? 0 },
          { label: t("admin.resources"), value: overview?.resources ?? 0 },
          { label: t("admin.announcements"), value: overview?.announcements ?? 0 },
        ]}
      />

      <Card>
        <CardHeader
          title={t("admin.activityTrend")}
          subtitle={t("admin.activityTrendHint")}
          icon={
            <IconTile size={40}>
              <Activity size={19} color={colors.brandDeep} />
            </IconTile>
          }
        />
        <OptionGroup<Metric>
          value={metric}
          onChange={setMetric}
          options={[
            { value: "submissions", label: t("admin.submissions") },
            { value: "assignments", label: t("admin.assignments") },
            { value: "lessonPlans", label: t("admin.lessonPlans") },
          ]}
        />
        <View style={{ marginTop: space.md }}>
          <LineChart
            data={series}
            max={seriesMax}
            suffix=""
            ticks={[0, Math.round(seriesMax / 2), seriesMax]}
          />
        </View>
      </Card>

      <Card accent={colors.blue}>
        <CardHeader
          title={t("admin.aiUsage")}
          subtitle={t("admin.aiUsageHint")}
          icon={
            <IconTile size={40} bg={colors.blueSoft}>
              <MessageSquare size={19} color={colors.blueText} />
            </IconTile>
          }
        />
        <View style={styles.aiRow}>
          <View style={styles.aiCell}>
            <Text variant="stat" weight="bold" tabular>
              {overview?.conversations ?? 0}
            </Text>
            <Text variant="micro" color={colors.textMuted}>
              {t("admin.conversations")}
            </Text>
          </View>
          <View style={styles.aiDivider} />
          <View style={styles.aiCell}>
            <Text variant="stat" weight="bold" tabular>
              {overview?.messages ?? 0}
            </Text>
            <Text variant="micro" color={colors.textMuted}>
              {t("admin.messages")}
            </Text>
          </View>
        </View>
      </Card>

      <SectionHeader title={t("admin.console")} icon={<LayoutGrid size={17} color={colors.brand} />} />
      <View style={styles.grid}>
        {modules.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.href}
              onPress={() => router.push(item.href as never)}
              style={styles.tile}
              elevation="xs"
            >
              <IconTile size={38}>
                <Icon size={18} color={colors.brandDeep} />
              </IconTile>
              <Text
                variant="micro"
                weight="semibold"
                center
                numberOfLines={2}
                style={{ marginTop: space.sm }}
              >
                {label(item)}
              </Text>
            </Card>
          );
        })}
      </View>

      <Card>
        <View style={styles.footNote}>
          <FileText size={15} color={colors.textMuted} />
          <Text variant="micro" color={colors.textMuted} style={{ flex: 1 }}>
            {t("admin.footNote")}
          </Text>
        </View>
      </Card>
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
  stats: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  aiRow: { flexDirection: "row", alignItems: "center", marginTop: space.md },
  aiCell: { flex: 1, alignItems: "center" },
  aiDivider: { width: 1, height: 34, backgroundColor: colors.border },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: {
    flexGrow: 1,
    flexBasis: "28%",
    alignItems: "center",
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
  },
  footNote: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
