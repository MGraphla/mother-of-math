import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookCheck,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  Megaphone,
  TrendingUp,
  UserCircle,
} from "lucide-react-native";
import { useLanguage } from "../../../src/context/LanguageContext";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  listStudentAssignments,
  listStudentSubmissions,
  resolveActiveStudentSession,
  type StudentSession,
} from "../../../src/services/studentPortal";
import { colors, layout, radius, space } from "../../../src/theme/tokens";
import {
  Avatar,
  Badge,
  Card,
  CardSection,
  EmptyState,
  IconTile,
  SectionHeader,
  StatCard,
  Text,
  showError,
} from "../../../src/ui";

interface Assignment {
  id: string;
  title: string;
  due_date: string;
  subject?: string | null;
  max_score?: number | null;
}

interface Submission {
  id: string;
  assignment_id: string;
  status: string;
  score: number | null;
  submitted_at: string;
  assignments?: { title?: string; max_score?: number } | { title?: string; max_score?: number }[] | null;
}

const QUICK_ACTIONS = [
  { href: "/(roles)/student/assignments", labelKey: "sidebar.assignments", Icon: BookCheck },
  { href: "/(roles)/student/progress", labelKey: "common.progress", Icon: Award },
  { href: "/(roles)/student/analysis", labelKey: "sidebar.myFeedback", Icon: Brain },
  { href: "/(roles)/student/resources", labelKey: "sidebar.resources", Icon: BookOpen },
  { href: "/(roles)/student/announcements", labelKey: "sidebar.announcements", Icon: Megaphone },
  { href: "/(roles)/student/profile", labelKey: "nav.profile", Icon: UserCircle },
] as const;

const shortDate = (iso: string, locale: string) =>
  new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric" });

export default function StudentDashboard() {
  const { t, language } = useLanguage();
  const [session, setSession] = useState<StudentSession | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const active = await resolveActiveStudentSession();
    setSession(active);
    if (!active) {
      setAssignments([]);
      setSubmissions([]);
      return;
    }
    const [a, s] = await Promise.all([
      listStudentAssignments(active.id),
      listStudentSubmissions(active.id),
    ]);
    setAssignments(a as Assignment[]);
    setSubmissions(s as Submission[]);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => showError(t("student.loadingDashboard"), e))
      .finally(() => setLoading(false));
  }, [load, t]);

  const derived = useMemo(() => {
    const submittedIds = new Set(submissions.map((s) => s.assignment_id));
    const now = Date.now();

    const pending = assignments
      .filter((a) => !submittedIds.has(a.id) && new Date(a.due_date).getTime() > now)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    const overdue = assignments
      .filter((a) => !submittedIds.has(a.id) && new Date(a.due_date).getTime() < now)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    const graded = submissions.filter((s) => s.status === "graded");
    const averageScore = graded.length
      ? Math.round(graded.reduce((sum, s) => sum + (s.score ?? 0), 0) / graded.length)
      : 0;
    const completionRate = assignments.length
      ? Math.round((submissions.length / assignments.length) * 100)
      : 0;

    return { pending, overdue, graded, averageScore, completionRate };
  }, [assignments, submissions]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("student.goodMorning");
    if (hour < 18) return t("student.goodAfternoon");
    return t("student.goodEvening");
  }, [t]);

  const locale = language === "fr" ? "fr-FR" : "en-GB";
  const firstName = session?.full_name?.split(" ")[0] ?? t("common.student");

  return (
    <DashboardShell
      title={t("sidebar.dashboard")}
      subtitle={session?.class_name ?? t("student.portal")}
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await load();
        } catch (e) {
          showError(t("common.refresh"), e);
        } finally {
          setRefreshing(false);
        }
      }}
    >
      {!session && !loading ? (
        <EmptyState
          icon={<GraduationCap size={24} color={colors.brandDeep} />}
          title={t("auth.studentSignIn")}
          subtitle={t("student.enterTokenHint")}
          actionLabel={t("mobile.studentEmailLogin")}
          onAction={() => router.replace("/(auth)/student-login")}
        />
      ) : null}

      {session ? (
        <>
          {/* Welcome banner — the web's primary-green hero with avatar and badges. */}
          <View style={styles.banner}>
            <View style={[styles.orb, { top: -45, right: -35 }]} />
            <View style={[styles.orb, { bottom: -55, left: -45, width: 160, height: 160 }]} />
            <View style={styles.bannerContent}>
              <View style={styles.bannerTop}>
                <View style={styles.avatarWrap}>
                  <Avatar name={session.full_name} size={60} tone="onBrand" />
                  <View style={styles.onlineDot} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="h2" weight="extrabold" color={colors.white} numberOfLines={2}>
                    {`${greeting}, ${firstName}!`}
                  </Text>
                  <Text variant="caption" color={colors.onBrandMuted} style={{ marginTop: 4 }}>
                    {`${t("common.youHave")} ${derived.pending.length} ${t("student.assignmentsPending")}.`}
                  </Text>
                </View>
              </View>

              <View style={styles.badgeRow}>
                {session.grade_level ? <Badge label={session.grade_level} tone="onBrand" /> : null}
                {session.class_name ? <Badge label={session.class_name} tone="onBrand" /> : null}
                <Badge label={t("student.activeStudent")} tone="onBrand" />
              </View>

              <Pressable
                onPress={() => router.push("/(roles)/student/assignments")}
                style={({ pressed }) => [styles.bannerCta, pressed && { opacity: 0.9 }]}
                accessibilityRole="button"
              >
                <Text variant="caption" weight="bold" color={colors.white}>
                  {t("student.startLearning")}
                </Text>
                <ArrowRight size={16} color={colors.white} />
              </Pressable>
            </View>
          </View>

          <View style={styles.statGrid}>
            <StatCard
              label={t("sidebar.assignments")}
              value={assignments.length}
              caption={t("student.totalAssigned")}
              tone="brand"
              icon={<BookCheck size={20} color={colors.brandDeep} />}
            />
            <StatCard
              label={t("student.pending")}
              value={derived.pending.length}
              caption={t("student.dueSoon")}
              tone="amber"
              icon={<Clock size={20} color={colors.amberText} />}
            />
            <StatCard
              label={t("student.completed")}
              value={submissions.length}
              caption={`${derived.completionRate}% ${t("student.completionRate")}`}
              tone="emerald"
              icon={<CheckCircle2 size={20} color={colors.emeraldText} />}
            />
            <StatCard
              label={t("dashboard.averageScore")}
              value={derived.averageScore > 0 ? `${derived.averageScore}%` : "—"}
              caption={t("student.basedOnGraded")}
              tone="blue"
              icon={<TrendingUp size={20} color={colors.blueText} />}
            />
          </View>

          <SectionHeader
            title={t("student.upcomingDueDates")}
            icon={<Clock size={18} color={colors.brand} />}
            action={
              <Pressable
                onPress={() => router.push("/(roles)/student/assignments")}
                hitSlop={layout.hitSlop}
                accessibilityRole="button"
              >
                <Text variant="micro" weight="semibold" color={colors.brandDark}>
                  {t("student.viewAll")}
                </Text>
              </Pressable>
            }
          />

          {derived.pending.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={24} color={colors.emeraldText} />}
              title={t("student.allCaughtUp")}
              subtitle={t("student.noPendingAssignments")}
            />
          ) : (
            derived.pending.slice(0, 3).map((a) => {
              const due = new Date(a.due_date);
              const soon = due.getTime() - Date.now() < 1000 * 60 * 60 * 48;
              return (
                <Card
                  key={a.id}
                  accent={colors.brand}
                  onPress={() => router.push("/(roles)/student/assignments")}
                >
                  <View style={styles.assignmentTop}>
                    {a.subject ? <Badge label={a.subject} tone="brand" /> : null}
                    {soon ? <Badge label={t("status.dueSoon")} tone="danger" /> : null}
                  </View>
                  <Text variant="h3" weight="bold" style={{ marginTop: space.sm }} numberOfLines={2}>
                    {a.title}
                  </Text>
                  <View style={styles.assignmentMeta}>
                    <Calendar size={14} color={colors.textMuted} />
                    <Text variant="caption" weight="medium" color={colors.textMuted}>
                      {`${t("student.dueDate")}: ${shortDate(a.due_date, locale)}`}
                    </Text>
                  </View>
                </Card>
              );
            })
          )}

          {derived.overdue.length > 0 ? (
            <>
              <SectionHeader
                title={t("status.overdue")}
                icon={<AlertCircle size={18} color={colors.danger} />}
              />
              {derived.overdue.slice(0, 2).map((a) => (
                <Card
                  key={a.id}
                  accent={colors.danger}
                  onPress={() => router.push("/(roles)/student/assignments")}
                >
                  <Text variant="bodySm" weight="semibold" numberOfLines={2}>
                    {a.title}
                  </Text>
                  <Text
                    variant="caption"
                    weight="medium"
                    color={colors.dangerText}
                    style={{ marginTop: 4 }}
                  >
                    {`${t("student.dueDate")}: ${shortDate(a.due_date, locale)}`}
                  </Text>
                </Card>
              ))}
            </>
          ) : null}

          <CardSection
            title={t("student.recentGrades")}
            icon={<GraduationCap size={18} color={colors.emeraldText} />}
          >
            {derived.graded.length > 0 ? (
              derived.graded.slice(0, 5).map((sub, i) => {
                const meta = Array.isArray(sub.assignments) ? sub.assignments[0] : sub.assignments;
                const good = (sub.score ?? 0) >= 80;
                return (
                  <View key={sub.id} style={[styles.gradeRow, i > 0 && styles.gradeDivider]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodySm" weight="medium" numberOfLines={1}>
                        {meta?.title ?? t("common.assignment")}
                      </Text>
                      <Text variant="micro" color={colors.textMuted} style={{ marginTop: 2 }}>
                        {shortDate(sub.submitted_at, locale)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.scorePill,
                        { backgroundColor: good ? colors.emeraldSoft : colors.amberSoft },
                      ]}
                    >
                      <Text
                        variant="caption"
                        weight="bold"
                        tabular
                        color={good ? colors.emeraldText : colors.amberText}
                      >
                        {sub.score ?? "—"}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyPad}>
                <Text variant="caption" color={colors.textMuted} center>
                  {t("student.noGradedYet")}
                </Text>
              </View>
            )}
          </CardSection>

          <SectionHeader title={t("mobile.quickActions")} />
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map(({ href, labelKey, Icon }) => (
              <Card
                key={href}
                onPress={() => router.push(href)}
                style={styles.quickCard}
                elevation="xs"
              >
                <IconTile size={42}>
                  <Icon size={20} color={colors.brandDeep} />
                </IconTile>
                <Text
                  variant="micro"
                  weight="semibold"
                  center
                  numberOfLines={2}
                  style={{ marginTop: space.sm }}
                >
                  {t(labelKey)}
                </Text>
              </Card>
            ))}
          </View>

          {/* Motivational card, matching the web's quote panel. */}
          <View style={styles.quote}>
            <View style={[styles.orb, { top: -30, right: -20, width: 90, height: 90 }]} />
            <Text variant="bodySm" weight="medium" color={colors.white} center style={styles.quoteText}>
              “Mathematics is the language with which God has written the universe.”
            </Text>
            <Text variant="micro" weight="semibold" color={colors.onBrandMuted} center>
              — Galileo Galilei
            </Text>
          </View>
        </>
      ) : null}
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: radius.lg, backgroundColor: colors.brand, overflow: "hidden" },
  orb: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  bannerContent: { padding: space.lg },
  bannerTop: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatarWrap: { position: "relative" },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: radius.full,
    backgroundColor: "#4ADE80",
    borderWidth: 2,
    borderColor: colors.white,
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.md },
  bannerCta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "center",
    gap: 6,
    marginTop: space.lg,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
  },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  assignmentTop: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  assignmentMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: space.md },
  gradeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  gradeDivider: { borderTopWidth: layout.hairline, borderTopColor: colors.border },
  scorePill: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyPad: { padding: space.xl },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  quickCard: {
    flexGrow: 1,
    flexBasis: "29%",
    alignItems: "center",
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
  },
  quote: {
    borderRadius: radius.lg,
    backgroundColor: colors.brandDeep,
    padding: space.xl,
    overflow: "hidden",
  },
  quoteText: { marginBottom: space.sm, fontStyle: "italic" },
});
