import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Download, FileCheck2 } from "lucide-react-native";
import { useLanguage } from "../../../src/context/LanguageContext";
import { shareTextFile } from "../../../src/native/exportText";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import { fetchAllSubmissionsAdmin } from "../../../src/services/admin";
import { colors, space } from "../../../src/theme/tokens";
import {
  Badge,
  Card,
  EmptyState,
  IconButton,
  IconTile,
  OptionGroup,
  StatStrip,
  Text,
  showError,
  showSuccess,
} from "../../../src/ui";

type Filter = "all" | "submitted" | "graded" | "returned";

interface AdminSubmission {
  id?: string;
  status?: string;
  score?: number | null;
  ai_score?: number | null;
  submitted_at?: string | null;
  assignment_title?: string;
  student_name?: string;
  teacher_name?: string;
  title?: string;
}

export default function AdminSubmissionsScreen() {
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<AdminSubmission[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const reload = useCallback(async () => {
    setItems((await fetchAllSubmissionsAdmin()) as AdminSubmission[]);
  }, []);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("common.error"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((s) => {
      if (filter !== "all" && (s.status || "submitted") !== filter) return false;
      if (!q) return true;
      return [s.assignment_title, s.title, s.student_name, s.teacher_name, s.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, query, filter]);

  const stats = useMemo(() => {
    const graded = items.filter((s) => s.status === "graded");
    const scores = graded
      .map((s) => s.score)
      .filter((n): n is number => typeof n === "number");
    return {
      submitted: items.length,
      graded: graded.length,
      returned: items.filter((s) => s.status === "returned").length,
      avg: scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0,
    };
  }, [items]);

  const exportCsv = async () => {
    try {
      const headers = ["Assignment", "Student", "Teacher", "Status", "Score", "AI Score", "Submitted"];
      const lines = [
        headers.join(","),
        ...visible.map((s) =>
          [
            s.assignment_title ?? s.title ?? "",
            s.student_name ?? "",
            s.teacher_name ?? "",
            s.status ?? "",
            s.score ?? "",
            s.ai_score ?? "",
            s.submitted_at ?? "",
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        ),
      ];
      await shareTextFile(`submissions_${Date.now()}.csv`, lines.join("\n"));
      showSuccess(t("assignment.action.exportCsv"), t("common.success"));
    } catch (e) {
      showError(t("common.error"), e);
    }
  };

  return (
    <DashboardShell
      title="Submissions"
      subtitle={`${items.length}`}
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("common.error"), e);
        } finally {
          setRefreshing(false);
        }
      }}
      search={{ value: query, onChangeText: setQuery, placeholder: t("assignment.searchPlaceholder") }}
      headerRight={
        <IconButton accessibilityLabel={t("assignment.action.exportCsv")} onPress={() => void exportCsv()} tone="brand">
          <Download size={18} color={colors.brandDeep} />
        </IconButton>
      }
    >
      <StatStrip
        items={[
          { label: t("status.submitted"), value: stats.submitted },
          { label: t("status.graded"), value: stats.graded },
          { label: t("assignment.action.return"), value: stats.returned },
          { label: t("assignment.stats.avgScore"), value: stats.avg || "—" },
        ]}
      />

      <OptionGroup<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: t("common.all") },
          { value: "submitted", label: t("status.submitted") },
          { value: "graded", label: t("status.graded") },
          { value: "returned", label: t("assignment.action.return") },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<FileCheck2 size={24} color={colors.brandDeep} />}
          title={t("common.noData")}
        />
      ) : (
        visible.map((item, idx) => (
          <Card key={item.id ?? idx} accent={colors.brand}>
            <View style={styles.row}>
              <IconTile size={40}>
                <FileCheck2 size={19} color={colors.brandDeep} />
              </IconTile>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodySm" weight="bold" numberOfLines={2}>
                  {item.assignment_title ?? item.title ?? `Submission ${idx + 1}`}
                </Text>
                <Text variant="micro" color={colors.textMuted} numberOfLines={1}>
                  {[item.student_name, item.teacher_name].filter(Boolean).join(" · ")}
                </Text>
              </View>
            </View>
            <View style={styles.badges}>
              <Badge
                label={item.status ?? "submitted"}
                tone={
                  item.status === "graded"
                    ? "success"
                    : item.status === "returned"
                      ? "warning"
                      : "info"
                }
              />
              {item.score != null ? (
                <Badge label={`${t("assignment.score")} ${item.score}`} tone="brand" />
              ) : null}
              {item.ai_score != null ? (
                <Badge label={`AI ${item.ai_score}`} tone="outline" />
              ) : null}
              {item.submitted_at ? (
                <Badge
                  label={new Date(item.submitted_at).toLocaleDateString(locale, {
                    month: "short",
                    day: "numeric",
                  })}
                  tone="outline"
                />
              ) : null}
            </View>
          </Card>
        ))
      )}
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.md },
});
