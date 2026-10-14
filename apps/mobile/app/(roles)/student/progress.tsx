import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Award, MessageSquareQuote, TrendingUp } from "lucide-react-native";
import { useLanguage } from "../../../src/context/LanguageContext";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  listStudentSubmissions,
  resolveActiveStudentSession,
} from "../../../src/services/studentPortal";
import { colors, radius, space } from "../../../src/theme/tokens";
import {
  Badge,
  Card,
  CardHeader,
  CardSection,
  EmptyState,
  IconTile,
  LineChart,
  ProgressRing,
  RichText,
  Sheet,
  StatCard,
  Text,
  showError,
} from "../../../src/ui";

interface Submission {
  id: string;
  status: string | null;
  score: number | null;
  submitted_at: string | null;
  teacher_feedback: string | null;
  assignments?:
    | { title?: string; max_score?: number }
    | { title?: string; max_score?: number }[]
    | null;
}

const titleOf = (row: Submission, fallback: string) => {
  const a = Array.isArray(row.assignments) ? row.assignments[0] : row.assignments;
  return a?.title ?? fallback;
};

const maxOf = (row: Submission) => {
  const a = Array.isArray(row.assignments) ? row.assignments[0] : row.assignments;
  return a?.max_score ?? 10;
};

export default function StudentProgressScreen() {
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<Submission | null>(null);

  const reload = useCallback(async () => {
    const session = await resolveActiveStudentSession();
    if (!session) {
      setRows([]);
      return;
    }
    setRows((await listStudentSubmissions(session.id)) as Submission[]);
  }, []);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("student.progressLoadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const stats = useMemo(() => {
    const graded = rows.filter((r) => r.score != null);
    const percentages = graded.map((r) => Math.round(((r.score ?? 0) / maxOf(r)) * 100));
    const average = percentages.length
      ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length)
      : 0;
    const best = percentages.length ? Math.max(...percentages) : 0;

    // Oldest first, so the trend line reads left to right like the web chart.
    const trend = [...graded]
      .reverse()
      .slice(-8)
      .map((r, i) => ({
        label: r.submitted_at
          ? new Date(r.submitted_at).toLocaleDateString(locale, { month: "short", day: "numeric" })
          : String(i + 1),
        value: Math.round(((r.score ?? 0) / maxOf(r)) * 100),
      }));

    return { graded, average, best, trend };
  }, [rows, locale]);

  return (
    <DashboardShell
      title={t("common.progress")}
      subtitle={t("student.progressTagline")}
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("student.progressLoadFailed"), e);
        } finally {
          setRefreshing(false);
        }
      }}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={<Award size={24} color={colors.brandDeep} />}
          title={t("student.noGradedYet")}
          subtitle={t("student.progressEmptyHint")}
        />
      ) : (
        <>
          <Card>
            <View style={styles.hero}>
              <ProgressRing
                value={stats.average}
                size={104}
                caption={t("dashboard.averageScore")}
              />
              <View style={{ flex: 1, minWidth: 0, gap: space.sm }}>
                <Text variant="h3" weight="bold">
                  {stats.average >= 80
                    ? t("student.doingGreat")
                    : stats.average >= 50
                      ? t("student.keepGoing")
                      : t("student.needsPractice")}
                </Text>
                <Text variant="caption" color={colors.textMuted}>
                  {`${stats.graded.length} ${t("student.gradedItems")} · ${t(
                    "student.bestScore",
                  )} ${stats.best}%`}
                </Text>
              </View>
            </View>
          </Card>

          <View style={styles.statGrid}>
            <StatCard
              label={t("student.completed")}
              value={rows.length}
              caption={t("student.submissionsMade")}
              tone="brand"
              icon={<Award size={20} color={colors.brandDeep} />}
            />
            <StatCard
              label={t("status.graded")}
              value={stats.graded.length}
              caption={t("student.basedOnGraded")}
              tone="emerald"
              icon={<TrendingUp size={20} color={colors.emeraldText} />}
            />
          </View>

          {stats.trend.length > 1 ? (
            <Card>
              <CardHeader
                title={t("student.scoreTrend")}
                icon={
                  <IconTile size={40}>
                    <TrendingUp size={19} color={colors.brandDeep} />
                  </IconTile>
                }
              />
              <View style={{ marginTop: space.md }}>
                <LineChart data={stats.trend} />
              </View>
            </Card>
          ) : null}

          <CardSection
            title={t("student.recentGrades")}
            icon={<MessageSquareQuote size={18} color={colors.brand} />}
          >
            {rows.map((row, i) => {
              const graded = row.score != null;
              const pct = graded ? Math.round(((row.score ?? 0) / maxOf(row)) * 100) : 0;
              const good = pct >= 80;
              return (
                <Card
                  key={row.id}
                  padded={false}
                  elevation="none"
                  onPress={() => setOpen(row)}
                  style={i > 0 ? styles.divided : undefined}
                >
                  <View style={styles.gradeRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodySm" weight="semibold" numberOfLines={1}>
                        {titleOf(row, t("common.assignment"))}
                      </Text>
                      <View style={styles.badges}>
                        <Badge
                          label={graded ? t("status.graded") : t("status.submitted")}
                          tone={graded ? "success" : "info"}
                        />
                        {row.submitted_at ? (
                          <Text variant="micro" color={colors.textMuted}>
                            {new Date(row.submitted_at).toLocaleDateString(locale)}
                          </Text>
                        ) : null}
                      </View>
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
                        {graded ? `${pct}%` : "—"}
                      </Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </CardSection>
        </>
      )}

      <Sheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open ? titleOf(open, t("common.assignment")) : undefined}
        subtitle={
          open?.submitted_at
            ? `${t("assignments.submittedOn")} ${new Date(open.submitted_at).toLocaleString(locale)}`
            : undefined
        }
      >
        {open ? (
          <>
            <View style={styles.scoreBox}>
              <Text variant="micro" weight="bold" color={colors.brandDeep} uppercase>
                {t("assignments.score")}
              </Text>
              <Text variant="h1" weight="extrabold" tabular style={{ marginTop: 4 }}>
                {open.score != null ? `${open.score}/${maxOf(open)}` : "—"}
              </Text>
            </View>
            {open.teacher_feedback ? (
              <View>
                <Text variant="micro" weight="bold" color={colors.brandDeep} uppercase>
                  {t("student.teacherFeedback")}
                </Text>
                <View style={{ marginTop: 6 }}>
                  <RichText source={open.teacher_feedback} />
                </View>
              </View>
            ) : (
              <Text variant="caption" color={colors.textMuted}>
                {t("student.noFeedbackYet")}
              </Text>
            )}
          </>
        ) : null}
      </Sheet>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: space.lg },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  gradeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.border },
  badges: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  scorePill: {
    minWidth: 48,
    height: 40,
    paddingHorizontal: space.sm,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreBox: {
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandMute,
    alignItems: "center",
  },
});
