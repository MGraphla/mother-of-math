import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Download, MessageSquare } from "lucide-react-native";
import { useLanguage } from "../../../src/context/LanguageContext";
import { shareTextFile } from "../../../src/native/exportText";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import { fetchAllComments } from "../../../src/services/admin";
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

type Filter = "all" | "public" | "private";

interface AdminComment {
  id?: string;
  message?: string;
  is_private?: boolean;
  created_at?: string;
  assignment_title?: string;
  author_name?: string;
  author_type?: string;
}

export default function AdminCommentsScreen() {
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<AdminComment[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const reload = useCallback(async () => {
    setItems((await fetchAllComments()) as AdminComment[]);
  }, []);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("common.error"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      if (filter === "public" && c.is_private) return false;
      if (filter === "private" && !c.is_private) return false;
      if (!q) return true;
      return [c.message, c.assignment_title, c.author_name, c.author_type]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, query, filter]);

  const stats = useMemo(
    () => ({
      total: items.length,
      public: items.filter((c) => !c.is_private).length,
      private: items.filter((c) => !!c.is_private).length,
    }),
    [items],
  );

  const exportCsv = async () => {
    try {
      const headers = ["Message", "Assignment", "Author", "Type", "Private", "Created"];
      const lines = [
        headers.join(","),
        ...visible.map((c) =>
          [
            c.message ?? "",
            c.assignment_title ?? "",
            c.author_name ?? "",
            c.author_type ?? "",
            c.is_private ? "yes" : "no",
            c.created_at ?? "",
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        ),
      ];
      await shareTextFile(`comments_${Date.now()}.csv`, lines.join("\n"));
      showSuccess(t("assignment.action.exportCsv"), t("common.success"));
    } catch (e) {
      showError(t("common.error"), e);
    }
  };

  return (
    <DashboardShell
      title="Comments"
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
          { label: t("assignment.stats.total"), value: stats.total },
          { label: "Public", value: stats.public },
          { label: "Private", value: stats.private },
        ]}
      />

      <OptionGroup<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: t("common.all") },
          { value: "public", label: "Public" },
          { value: "private", label: "Private" },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={24} color={colors.brandDeep} />}
          title={t("common.noData")}
        />
      ) : (
        visible.map((item, idx) => (
          <Card key={item.id ?? idx} accent={colors.brand}>
            <View style={styles.row}>
              <IconTile size={40}>
                <MessageSquare size={19} color={colors.brandDeep} />
              </IconTile>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodySm" weight="semibold" numberOfLines={3}>
                  {item.message ?? "Comment"}
                </Text>
                <Text variant="micro" color={colors.textMuted} numberOfLines={1}>
                  {[item.assignment_title, item.author_name].filter(Boolean).join(" · ")}
                </Text>
              </View>
            </View>
            <View style={styles.badges}>
              <Badge
                label={item.is_private ? "Private" : "Public"}
                tone={item.is_private ? "warning" : "success"}
              />
              {item.author_type ? (
                <Badge label={String(item.author_type)} tone="outline" />
              ) : null}
              {item.created_at ? (
                <Badge
                  label={new Date(item.created_at).toLocaleDateString(locale, {
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
