import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import {
  Activity,
  ClipboardList,
  GraduationCap,
  LayoutGrid,
  School,
  Users,
} from "lucide-react-native";
import { useLanguage } from "../../../src/context/LanguageContext";
import { useDisplayIdentity } from "../../../src/hooks/useDisplayIdentity";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import { roleNav, type NavItem } from "../../../src/navigation/navConfig";
import {
  fetchActivityTrends,
  fetchAdminOverview,
  fetchAllSchools,
  type ActivityTrendPoint,
  type AdminOverview,
} from "../../../src/services/admin";
import { colors, radius, space } from "../../../src/theme/tokens";
import {
  Avatar,
  Card,
  CardHeader,
  EmptyState,
  IconTile,
  LineChart,
  SectionHeader,
  StatCard,
  StatStrip,
  Text,
  showError,
  statTones,
} from "../../../src/ui";

interface SchoolRow {
  name: string;
  city?: string | null;
  country?: string | null;
  teacherCount: number;
}

export default function MonitorDashboardScreen() {
  const { t, language } = useLanguage();
  const identity = useDisplayIdentity();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [trends, setTrends] = useState<ActivityTrendPoint[]>([]);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    const [counts, trend, schoolRows] = await Promise.all([
      fetchAdminOverview(),
      fetchActivityTrends(14),
      fetchAllSchools(),
    ]);
    setOverview(counts);
    setTrends(trend);
    setSchools(schoolRows as SchoolRow[]);
  }, []);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("monitor.loadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const series = useMemo(
    () =>
      trends.slice(-7).map((point, index) => ({
        label:
          index % 2 === 0
            ? new Date(point.date).toLocaleDateString(locale, { day: "numeric", month: "short" })
            : "",
        value: point.submissions + point.assignments + point.lessonPlans,
      })),
    [trends, locale],
  );

  const seriesMax = Math.max(4, ...series.map((p) => p.value));

  const topSchools = useMemo(
    () => [...schools].sort((a, b) => b.teacherCount - a.teacherCount).slice(0, 5),
    [schools],
  );

  const modules = useMemo(
    () =>
      roleNav.monitor.groups.flatMap((group) =>
        group.items.filter((item) => item.href !== "/(roles)/monitor"),
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
      title={t("monitor.dashboard")}
      subtitle={identity.email ?? undefined}
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("monitor.loadFailed"), e);
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
            {t("monitor.bannerHint")}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <StatCard
          label={t("admin.totalTeachers")}
          value={overview?.teachers ?? 0}
          caption={t("monitor.inScope")}
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
      </View>

      <StatStrip
        items={[
          { label: t("monitor.schools"), value: schools.length },
          { label: t("admin.assignments"), value: overview?.assignments ?? 0 },
          { label: t("admin.submissions"), value: overview?.submissions ?? 0 },
          { label: t("admin.lessonPlans"), value: overview?.lessonPlans ?? 0 },
        ]}
      />

      <Card>
        <CardHeader
          title={t("monitor.platformActivity")}
          subtitle={t("monitor.platformActivityHint")}
          icon={
            <IconTile size={40}>
              <Activity size={19} color={colors.brandDeep} />
            </IconTile>
          }
        />
        <LineChart
          data={series}
          max={seriesMax}
          suffix=""
          ticks={[0, Math.round(seriesMax / 2), seriesMax]}
        />
      </Card>

      <SectionHeader title={t("monitor.topSchools")} icon={<School size={17} color={colors.brand} />} />

      {topSchools.length === 0 ? (
        <EmptyState
          icon={<School size={24} color={colors.brandDeep} />}
          title={t("monitor.noSchools")}
          subtitle={t("monitor.noSchoolsHint")}
        />
      ) : (
        topSchools.map((school, index) => (
          <Card key={`${school.name}-${index}`} padded={false}>
            <View style={styles.schoolRow}>
              <View style={styles.rank}>
                <Text variant="caption" weight="bold" tabular color={colors.brandDeep}>
                  {`${index + 1}`}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodySm" weight="bold" numberOfLines={1}>
                  {school.name}
                </Text>
                <Text variant="micro" color={colors.textMuted} numberOfLines={1}>
                  {[school.city, school.country].filter(Boolean).join(", ") || t("monitor.unknownPlace")}
                </Text>
              </View>
              <View style={styles.countPill}>
                <Users size={12} color={colors.brandDeep} />
                <Text variant="micro" weight="bold" tabular color={colors.brandDeep}>
                  {`${school.teacherCount}`}
                </Text>
              </View>
            </View>
          </Card>
        ))
      )}

      <SectionHeader title={t("monitor.tools")} icon={<LayoutGrid size={17} color={colors.brand} />} />
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
          <ClipboardList size={15} color={colors.textMuted} />
          <Text variant="micro" color={colors.textMuted} style={{ flex: 1 }}>
            {t("monitor.footNote")}
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
  stats: { flexDirection: "row", gap: space.md },
  schoolRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  rank: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.brandTint,
  },
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
