import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Inbox,
  MessageCircle,
  Star,
  Upload,
  UserPlus,
  Users,
} from "lucide-react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { supabase } from "../../../src/lib/supabase";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  fetchTeacherDashboard,
  type TeacherDashboardData,
} from "../../../src/services/teacherDashboard";
import { colors, layout, radius, space } from "../../../src/theme/tokens";
import {
  Badge,
  BarChart,
  Card,
  CardSection,
  EmptyState,
  IconTile,
  SectionHeader,
  StatCard,
  Text,
  showError,
} from "../../../src/ui";

const QUICK_ACTIONS = [
  { href: "/(roles)/teacher/assignments", labelKey: "sidebar.assignments", Icon: ClipboardList },
  { href: "/(roles)/teacher/lesson-plan-generator", labelKey: "sidebar.lessonPlans", Icon: BookOpen },
  { href: "/(roles)/teacher/chatbot", labelKey: "sidebar.chatBot", Icon: MessageCircle },
  { href: "/(roles)/teacher/uploads", labelKey: "sidebar.uploadWork", Icon: Upload },
  { href: "/(roles)/teacher/students", labelKey: "sidebar.studentAccounts", Icon: UserPlus },
] as const;

const STATUS_TONE = {
  graded: "success",
  returned: "info",
  pending: "warning",
} as const;

export default function TeacherDashboard() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setData(await fetchTeacherDashboard(supabase, user.id));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load()
      .catch((e) => showError(t("dashboard.snapshot"), e))
      .finally(() => setLoading(false));
  }, [user, load, t]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      showError(t("common.refresh"), e);
    } finally {
      setRefreshing(false);
    }
  };

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const hasTrend = !!data?.trend.some((p) => p.value > 0);

  return (
    <DashboardShell
      title={t("sidebar.dashboard")}
      subtitle={profile?.school_name ?? t("mobile.teacherPortal")}
      loading={loading}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {/* Welcome banner — the web's `bg-primary` hero with soft white orbs. */}
      <View style={styles.banner}>
        <View style={[styles.orb, { top: -40, right: -30 }]} />
        <View style={[styles.orb, { bottom: -50, left: -40, width: 150, height: 150 }]} />
        <View style={styles.bannerContent}>
          <Text variant="micro" weight="semibold" color={colors.onBrandFaint} uppercase>
            {t("mobile.teacherPortal")}
          </Text>
          <Text variant="h1" weight="extrabold" color={colors.white} style={{ marginTop: 4 }}>
            {`${t("dashboard.welcomeBack")}, ${firstName}!`}
          </Text>
          <Text variant="bodySm" color={colors.onBrandMuted} style={{ marginTop: 6 }}>
            {t("dashboard.snapshot")}
          </Text>
          <Pressable
            onPress={() => router.push("/(roles)/teacher/assignments")}
            style={({ pressed }) => [styles.bannerCta, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
          >
            <Text variant="caption" weight="bold" color={colors.white}>
              {t("sidebar.assignments")}
            </Text>
            <ArrowRight size={16} color={colors.white} />
          </Pressable>
        </View>
      </View>

      {/* KPI grid — same four metrics and accent colours as the web dashboard. */}
      <View style={styles.statGrid}>
        <StatCard
          label={t("dashboard.totalStudents")}
          value={data?.stats.totalStudents ?? 0}
          caption={t("sidebar.studentAccounts")}
          tone="brand"
          icon={<Users size={20} color={colors.brandDeep} />}
        />
        <StatCard
          label={t("dashboard.assignmentsGraded")}
          value={data?.stats.assignmentsGraded ?? 0}
          caption={t("common.assignment")}
          tone="emerald"
          icon={<ClipboardCheck size={20} color={colors.emeraldText} />}
        />
        <StatCard
          label={t("dashboard.averageScore")}
          value={`${data?.stats.averageScore ?? 0}%`}
          caption={t("student.basedOnGraded")}
          tone="amber"
          icon={<Star size={20} color={colors.amberText} />}
        />
        <StatCard
          label={t("dashboard.lessonPlansCreated")}
          value={data?.stats.lessonPlansCreated ?? 0}
          caption={t("sidebar.lessonPlans")}
          tone="blue"
          icon={<BookOpen size={20} color={colors.blueText} />}
        />
      </View>

      <CardSection title={t("dashboard.performanceTrend")}>
        <View style={styles.chartWrap}>
          {hasTrend ? (
            <BarChart data={data?.trend ?? []} height={210} />
          ) : (
            <Text variant="caption" color={colors.textMuted} center style={styles.chartEmpty}>
              {t("dashboard.noPerformanceTrendData")}
            </Text>
          )}
        </View>
      </CardSection>

      <CardSection
        title={t("dashboard.recentSubmissions")}
        right={
          <Pressable
            onPress={() => router.push("/(roles)/teacher/assignments")}
            hitSlop={layout.hitSlop}
            accessibilityRole="button"
          >
            <Text variant="micro" weight="semibold" color={colors.brandDark}>
              {t("common.viewAll")}
            </Text>
          </Pressable>
        }
      >
        {data?.recentSubmissions.length ? (
          data.recentSubmissions.map((sub, i) => (
            <View key={sub.id} style={[styles.subRow, i > 0 && styles.subRowDivider]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodySm" weight="semibold" numberOfLines={1}>
                  {sub.studentName}
                </Text>
                <Text
                  variant="micro"
                  color={colors.textMuted}
                  numberOfLines={1}
                  style={{ marginTop: 2 }}
                >
                  {sub.assignmentTitle}
                </Text>
              </View>
              <Badge label={t(`status.${sub.status}`)} tone={STATUS_TONE[sub.status]} />
              <Text variant="caption" weight="bold" tabular style={styles.subScore}>
                {sub.score != null ? `${sub.score}/${sub.maxScore}` : "—"}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyPad}>
            <Text variant="caption" color={colors.textMuted} center>
              {t("dashboard.noSubmissions")}
            </Text>
          </View>
        )}
      </CardSection>

      <SectionHeader title={t("mobile.quickActions")} />
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map(({ href, labelKey, Icon }) => (
          <Card key={href} onPress={() => router.push(href)} style={styles.quickCard} elevation="xs">
            <IconTile size={42}>
              <Icon size={20} color={colors.brandDeep} />
            </IconTile>
            <Text variant="micro" weight="semibold" center numberOfLines={2} style={styles.quickLabel}>
              {t(labelKey)}
            </Text>
          </Card>
        ))}
      </View>

      {!loading && data?.stats.totalStudents === 0 ? (
        <EmptyState
          icon={<Inbox size={24} color={colors.brandDeep} />}
          title={t("dashboard.noStudentsYet")}
          subtitle={t("dashboard.createStudentAccounts")}
          actionLabel={t("sidebar.studentAccounts")}
          onAction={() => router.push("/(roles)/teacher/students")}
        />
      ) : null}
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  bannerContent: { padding: space.lg },
  bannerCta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: space.lg,
    paddingHorizontal: space.lg,
    height: 42,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
  },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  chartWrap: { padding: space.md },
  chartEmpty: { paddingVertical: space.xxxl, paddingHorizontal: space.lg },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  subRowDivider: { borderTopWidth: layout.hairline, borderTopColor: colors.border },
  subScore: { minWidth: 52, textAlign: "right" },
  emptyPad: { padding: space.xl },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  quickCard: {
    flexGrow: 1,
    flexBasis: "29%",
    alignItems: "center",
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
  },
  quickLabel: { marginTop: space.sm },
});
