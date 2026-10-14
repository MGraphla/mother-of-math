import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ClipboardList, Download } from "lucide-react-native";
import { useLanguage } from "../../../src/context/LanguageContext";
import { shareTextFile } from "../../../src/native/exportText";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import { fetchAllAssignmentsAdmin } from "../../../src/services/admin";
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

type Filter = "all" | "active" | "draft" | "closed" | "overdue";

interface AdminAssignment {
  id?: string;
  title?: string;
  subject?: string;
  grade_level?: string;
  status?: string;
  due_date?: string;
  teacher_id?: string;
  teacher_name?: string;
  created_at?: string;
  assigned_count?: number;
  submission_count?: number;
  graded_count?: number;
  avg_score?: number;
  max_score?: number;
}

const normalizeStatus = (status?: string | null) =>
  status === "published" ? "active" : status || "draft";

export default function AdminAssignmentsScreen() {
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<AdminAssignment[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const reload = useCallback(async () => {
    setItems((await fetchAllAssignmentsAdmin()) as AdminAssignment[]);
  }, []);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("common.failedToLoadAssignments"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    return items.filter((a) => {
      const status = normalizeStatus(a.status);
      const due = a.due_date ? new Date(a.due_date).getTime() : null;
      const overdue = status === "active" && !!due && due < now;
      if (filter === "active" && (status !== "active" || overdue)) return false;
      if (filter === "overdue" && !overdue) return false;
      if (filter === "draft" && status !== "draft") return false;
      if (filter === "closed" && status !== "closed") return false;
      if (!q) return true;
      return [a.title, a.subject, a.grade_level, a.teacher_name, a.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, query, filter]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: items.length,
      active: items.filter((a) => normalizeStatus(a.status) === "active").length,
      overdue: items.filter((a) => {
        const due = a.due_date ? new Date(a.due_date).getTime() : null;
        return normalizeStatus(a.status) === "active" && !!due && due < now;
      }).length,
      graded: items.reduce((n, a) => n + Number(a.graded_count ?? 0), 0),
    };
  }, [items]);

  const exportCsv = async () => {
    try {
      const headers = [
        "Title",
        "Subject",
        "Grade",
        "Status",
        "Due",
        "Teacher",
        "Assigned",
        "Submitted",
        "Graded",
        "AvgScore",
      ];
      const lines = [
        headers.join(","),
        ...visible.map((a) =>
          [
            a.title ?? "",
            a.subject ?? "",
            a.grade_level ?? "",
            normalizeStatus(a.status),
            a.due_date ?? "",
            a.teacher_name ?? a.teacher_id ?? "",
            a.assigned_count ?? "",
            a.submission_count ?? "",
            a.graded_count ?? "",
            a.avg_score ?? "",
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        ),
      ];
      await shareTextFile(`assignments_${Date.now()}.csv`, lines.join("\n"));
      showSuccess(t("assignment.action.exportCsv"), t("common.success"));
    } catch (e) {
      showError(t("common.error"), e);
    }
  };

  return (
    <DashboardShell
      title={t("sidebar.assignments")}
      subtitle={`${items.length} ${t("sidebar.assignments").toLowerCase()}`}
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("common.failedToLoadAssignments"), e);
        } finally {
          setRefreshing(false);
        }
      }}
      search={{
        value: query,
        onChangeText: setQuery,
        placeholder: t("assignment.searchPlaceholder"),
      }}
      headerRight={
        <IconButton
          accessibilityLabel={t("assignment.action.exportCsv")}
          onPress={() => void exportCsv()}
          tone="brand"
        >
          <Download size={18} color={colors.brandDeep} />
        </IconButton>
      }
    >
      <StatStrip
        items={[
          { label: t("assignment.stats.total"), value: stats.total },
          { label: t("assignment.stats.active"), value: stats.active },
          { label: t("assignment.stats.overdue"), value: stats.overdue },
          { label: t("assignment.stats.aiGraded"), value: stats.graded },
        ]}
      />

      <OptionGroup<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: t("assignment.tabs.all") },
          { value: "active", label: t("assignment.tabs.active") },
          { value: "overdue", label: t("assignment.tabs.overdue") },
          { value: "draft", label: t("assignment.tabs.drafts") },
          { value: "closed", label: t("assignment.tabs.closed") },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={24} color={colors.brandDeep} />}
          title={t("assignment.empty.title")}
          subtitle={t("assignment.empty.adjust")}
        />
      ) : (
        visible.map((item, idx) => {
          const status = normalizeStatus(item.status);
          const due = item.due_date ? new Date(item.due_date) : null;
          const overdue =
            status === "active" && !!due && due.getTime() < Date.now();
          return (
            <Card
              key={item.id ?? idx}
              accent={overdue ? colors.amber : colors.brand}
            >
              <View style={styles.row}>
                <IconTile size={40}>
                  <ClipboardList size={19} color={colors.brandDeep} />
                </IconTile>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodySm" weight="bold" numberOfLines={2}>
                    {item.title ?? `Assignment ${idx + 1}`}
                  </Text>
                  <Text variant="micro" color={colors.textMuted} numberOfLines={1}>
                    {[item.teacher_name, item.subject, item.grade_level]
                      .filter(Boolean)
                      .join(" · ") || item.teacher_id}
                  </Text>
                </View>
              </View>
              <View style={styles.badges}>
                <Badge
                  label={status}
                  tone={
                    status === "active"
                      ? "success"
                      : status === "closed"
                        ? "neutral"
                        : "warning"
                  }
                />
                {due ? (
                  <Badge
                    label={due.toLocaleDateString(locale, {
                      month: "short",
                      day: "numeric",
                    })}
                    tone={overdue ? "warning" : "outline"}
                  />
                ) : null}
                {item.submission_count != null ? (
                  <Badge
                    label={`${item.submission_count} ${t("assignment.card.submissions")}`}
                    tone="outline"
                  />
                ) : null}
                {item.avg_score != null ? (
                  <Badge
                    label={`${t("assignment.stats.avgScore")} ${item.avg_score}`}
                    tone="brand"
                  />
                ) : null}
              </View>
            </Card>
          );
        })
      )}
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.md },
});
