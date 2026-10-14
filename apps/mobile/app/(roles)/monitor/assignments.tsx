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
  Select,
  StatStrip,
  Text,
  showError,
  showSuccess,
} from "../../../src/ui";

type StatusFilter = "all" | "active" | "draft" | "closed" | "overdue";
type Range = "7" | "30" | "90" | "all";
type SortKey = "newest" | "oldest" | "due" | "title";

interface MonitorAssignment {
  id?: string;
  title?: string;
  subject?: string;
  grade_level?: string;
  status?: string;
  due_date?: string;
  created_at?: string;
  teacher_name?: string;
  submission_count?: number;
  graded_count?: number;
  assigned_count?: number;
  avg_score?: number;
}

const normalizeStatus = (status?: string | null) =>
  status === "published" ? "active" : status || "draft";

export default function MonitorAssignmentsScreen() {
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<MonitorAssignment[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [range, setRange] = useState<Range>("30");
  const [sort, setSort] = useState<SortKey>("newest");

  const reload = useCallback(async () => {
    setItems((await fetchAllAssignmentsAdmin()) as MonitorAssignment[]);
  }, []);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("common.failedToLoadAssignments"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  // Soft live refresh similar to web monitor (~45s).
  useEffect(() => {
    const id = setInterval(() => {
      void reload().catch(() => undefined);
    }, 45000);
    return () => clearInterval(id);
  }, [reload]);

  const ranged = useMemo(() => {
    if (range === "all") return items;
    const days = Number(range);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return items.filter((a) => {
      const created = a.created_at ? new Date(a.created_at).getTime() : 0;
      return created >= cutoff;
    });
  }, [items, range]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const filtered = ranged.filter((a) => {
      const status = normalizeStatus(a.status);
      const due = a.due_date ? new Date(a.due_date).getTime() : null;
      const overdue = status === "active" && !!due && due < now;
      if (filter === "active" && (status !== "active" || overdue)) return false;
      if (filter === "overdue" && !overdue) return false;
      if (filter === "draft" && status !== "draft") return false;
      if (filter === "closed" && status !== "closed") return false;
      if (!q) return true;
      return [a.title, a.subject, a.grade_level, a.teacher_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });

    return filtered.sort((a, b) => {
      if (sort === "title") return String(a.title ?? "").localeCompare(String(b.title ?? ""));
      if (sort === "due") {
        return new Date(a.due_date ?? 0).getTime() - new Date(b.due_date ?? 0).getTime();
      }
      if (sort === "oldest") {
        return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
      }
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });
  }, [ranged, query, filter, sort]);

  const stats = useMemo(() => {
    const now = Date.now();
    const submitted = ranged.reduce((n, a) => n + Number(a.submission_count ?? 0), 0);
    const assigned = ranged.reduce((n, a) => n + Number(a.assigned_count ?? 0), 0);
    const graded = ranged.reduce((n, a) => n + Number(a.graded_count ?? 0), 0);
    const scores = ranged
      .map((a) => a.avg_score)
      .filter((s): s is number => typeof s === "number");
    return {
      total: ranged.length,
      rate: assigned ? Math.round((submitted / assigned) * 100) : 0,
      overdue: ranged.filter((a) => {
        const due = a.due_date ? new Date(a.due_date).getTime() : null;
        return normalizeStatus(a.status) === "active" && !!due && due < now;
      }).length,
      avg: scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0,
      graded,
    };
  }, [ranged]);

  const exportCsv = async () => {
    try {
      const headers = ["Title", "Status", "Due", "Grade", "Subject", "Submitted", "Graded", "Avg"];
      const lines = [
        headers.join(","),
        ...visible.map((a) =>
          [
            a.title ?? "",
            normalizeStatus(a.status),
            a.due_date ?? "",
            a.grade_level ?? "",
            a.subject ?? "",
            a.submission_count ?? "",
            a.graded_count ?? "",
            a.avg_score ?? "",
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        ),
      ];
      await shareTextFile(`monitor_assignments_${Date.now()}.csv`, lines.join("\n"));
      showSuccess(t("assignment.action.exportCsv"), t("common.success"));
    } catch (e) {
      showError(t("common.error"), e);
    }
  };

  return (
    <DashboardShell
      title={t("sidebar.assignments")}
      subtitle={`${visible.length} ${t("sidebar.assignments").toLowerCase()}`}
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
          { label: t("assignment.card.submissions"), value: `${stats.rate}%` },
          { label: t("assignment.stats.overdue"), value: stats.overdue },
          { label: t("assignment.stats.avgScore"), value: stats.avg || "—" },
        ]}
      />

      <Select
        label={t("common.all")}
        value={range}
        onChange={(v) => setRange(v as Range)}
        options={[
          { value: "7", label: "7d" },
          { value: "30", label: "30d" },
          { value: "90", label: "90d" },
          { value: "all", label: t("common.all") },
        ]}
      />

      <Select
        label={t("assignment.status")}
        value={sort}
        onChange={(v) => setSort(v as SortKey)}
        options={[
          { value: "newest", label: "Newest" },
          { value: "oldest", label: "Oldest" },
          { value: "due", label: t("assignment.dueDate") },
          { value: "title", label: t("assignment.title") },
        ]}
      />

      <OptionGroup<StatusFilter>
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
          const assigned = Number(item.assigned_count ?? 0);
          const submitted = Number(item.submission_count ?? 0);
          const completion = assigned ? Math.round((submitted / assigned) * 100) : null;
          return (
            <Card key={item.id ?? idx} accent={overdue ? colors.amber : colors.brand}>
              <View style={styles.row}>
                <IconTile size={40}>
                  <ClipboardList size={19} color={colors.brandDeep} />
                </IconTile>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodySm" weight="bold" numberOfLines={2}>
                    {item.title ?? `Assignment ${idx + 1}`}
                  </Text>
                  <Text variant="micro" color={colors.textMuted} numberOfLines={1}>
                    {[item.grade_level, item.subject, item.teacher_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
              </View>
              <View style={styles.badges}>
                <Badge
                  label={status}
                  tone={status === "active" ? "success" : "neutral"}
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
                {completion != null ? (
                  <Badge label={`${completion}%`} tone="brand" />
                ) : null}
                {item.avg_score != null ? (
                  <Badge
                    label={`${t("assignment.stats.avgScore")} ${item.avg_score}`}
                    tone="outline"
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
