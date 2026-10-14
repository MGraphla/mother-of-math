import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Bell, Megaphone, Pin } from "lucide-react-native";
import { useLanguage } from "../../../src/context/LanguageContext";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  getStudentSession,
  listStudentAnnouncements,
  markStudentAnnouncementRead,
  resolveActiveStudentSession,
} from "../../../src/services/studentPortal";
import { colors, space } from "../../../src/theme/tokens";
import {
  Badge,
  Card,
  EmptyState,
  IconTile,
  OptionGroup,
  RichText,
  Sheet,
  Text,
  showError,
} from "../../../src/ui";

interface AnnouncementRow {
  id: string;
  title: string;
  message: string;
  category: string | null;
  is_pinned: boolean | null;
  created_at: string;
  is_read?: boolean;
  priority?: string | null;
}

type Filter = "all" | "unread" | "important";

const toneFor = (category?: string | null) => {
  const c = (category ?? "").toLowerCase();
  if (c.includes("urgent") || c.includes("important")) return "danger" as const;
  if (c.includes("exam") || c.includes("test") || c.includes("assignment")) return "warning" as const;
  if (c.includes("event")) return "info" as const;
  return "brand" as const;
};

export default function StudentAnnouncementsScreen() {
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<AnnouncementRow | null>(null);

  const reload = useCallback(async () => {
    const session = await resolveActiveStudentSession();
    if (!session) {
      setItems([]);
      return;
    }
    setItems(
      (await listStudentAnnouncements(
        session.teacher_id,
        session.grade_level,
        session.id,
        session.class_name,
      )) as AnnouncementRow[],
    );
  }, []);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("student.announcementsLoadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((a) => {
      if (filter === "unread" && a.is_read) return false;
      if (
        filter === "important" &&
        !(a.is_pinned || (a.category ?? "").toLowerCase().includes("urgent") || a.priority === "high")
      ) {
        return false;
      }
      if (!q) return true;
      return [a.title, a.message, a.category]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, query, filter]);

  const unreadCount = items.filter((a) => !a.is_read).length;

  const openDetail = async (item: AnnouncementRow) => {
    setOpen(item);
    if (item.is_read) return;
    try {
      const session = await resolveActiveStudentSession();
      const tokenSession = await getStudentSession();
      if (!session) return;
      await markStudentAnnouncementRead(
        session.id,
        tokenSession?.access_token || session.access_token || "",
        item.id,
      );
      setItems((prev) => prev.map((a) => (a.id === item.id ? { ...a, is_read: true } : a)));
    } catch {
      // non-fatal
    }
  };

  return (
    <DashboardShell
      title={t("sidebar.announcements")}
      subtitle={
        unreadCount
          ? `${unreadCount} unread`
          : t("student.announcementsTagline")
      }
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("student.announcementsLoadFailed"), e);
        } finally {
          setRefreshing(false);
        }
      }}
      search={{
        value: query,
        onChangeText: setQuery,
        placeholder: t("assignment.searchPlaceholder"),
      }}
    >
      <OptionGroup<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: t("common.all") },
          { value: "unread", label: `Unread (${unreadCount})` },
          { value: "important", label: "Important" },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<Bell size={24} color={colors.brandDeep} />}
          title={t("common.noData")}
          subtitle={t("announcements.noneHint")}
        />
      ) : (
        visible.map((item) => (
          <Card
            key={item.id}
            onPress={() => void openDetail(item)}
            accent={item.is_pinned ? colors.amber : item.is_read ? colors.border : colors.brand}
          >
            <View style={styles.row}>
              <IconTile
                size={40}
                bg={item.is_pinned ? colors.amberSoft : colors.brandSoft}
              >
                {item.is_pinned ? (
                  <Pin size={18} color={colors.amberText} />
                ) : (
                  <Megaphone size={18} color={colors.brandDeep} />
                )}
              </IconTile>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  variant="bodySm"
                  weight={item.is_read ? "semibold" : "bold"}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>
                <Text
                  variant="micro"
                  color={colors.textSecondary}
                  numberOfLines={2}
                  style={{ marginTop: 3 }}
                >
                  {item.message}
                </Text>
              </View>
            </View>
            <View style={styles.badges}>
              {!item.is_read ? <Badge label="New" tone="brand" /> : null}
              {item.is_pinned ? <Badge label={t("student.pinned")} tone="warning" /> : null}
              {item.category ? (
                <Badge label={item.category} tone={toneFor(item.category)} />
              ) : null}
              <Text variant="micro" color={colors.textFaint}>
                {new Date(item.created_at).toLocaleDateString(locale, {
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            </View>
          </Card>
        ))
      )}

      <Sheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open?.title}
        subtitle={
          open
            ? new Date(open.created_at).toLocaleString(locale)
            : undefined
        }
      >
        {open?.category ? (
          <Badge label={open.category} tone={toneFor(open.category)} />
        ) : null}
        {open ? (
          <View style={{ marginTop: space.md }}>
            <RichText source={open.message} />
          </View>
        ) : null}
      </Sheet>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: space.md,
  },
});
