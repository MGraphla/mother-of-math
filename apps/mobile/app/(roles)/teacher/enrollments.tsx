import { useCallback, useEffect, useMemo, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  Check,
  Copy,
  RefreshCw,
  Share2,
  UserPlus,
  Users,
  X,
} from "lucide-react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { supabase } from "../../../src/lib/supabase";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import { createStudent } from "../../../src/services/students";
import { colors, radius, space } from "../../../src/theme/tokens";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconTile,
  OptionGroup,
  Sheet,
  SheetAction,
  Text,
  showError,
  showSuccess,
} from "../../../src/ui";

interface RequestRow {
  id: string;
  full_name: string;
  grade_level: string | null;
  status: string;
  created_at: string;
}

type Filter = "pending" | "approved" | "rejected";

export default function TeacherEnrollmentsScreen() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [items, setItems] = useState<RequestRow[]>([]);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [filter, setFilter] = useState<Filter>("pending");
  const [selected, setSelected] = useState<RequestRow | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    const [{ data: profile }, { data: requests }] = await Promise.all([
      supabase.from("profiles").select("class_join_code").eq("id", user.id).maybeSingle(),
      supabase
        .from("enrollment_requests")
        .select("id,full_name,grade_level,status,created_at")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    setJoinCode(profile?.class_join_code ?? null);
    setItems((requests ?? []) as RequestRow[]);
  }, [user]);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("enrollments.loadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const counts = useMemo(
    () => ({
      pending: items.filter((i) => i.status === "pending").length,
      approved: items.filter((i) => i.status === "approved").length,
      rejected: items.filter((i) => i.status === "rejected").length,
    }),
    [items],
  );

  const visible = items.filter((i) => i.status === filter);

  const regenerate = async () => {
    if (!user) return;
    setRegenerating(true);
    try {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const { error } = await supabase
        .from("profiles")
        .update({ class_join_code: code })
        .eq("id", user.id);
      if (error) throw error;
      setJoinCode(code);
      showSuccess(t("enrollments.codeUpdated"), `${t("enrollments.newCode")} ${code}`);
    } catch (e) {
      showError(t("enrollments.codeFailed"), e);
    } finally {
      setRegenerating(false);
    }
  };

  const decide = async (request: RequestRow, approve: boolean) => {
    if (!user) return;
    setSelected(null);
    try {
      if (approve) {
        await createStudent({
          teacher_id: user.id,
          full_name: request.full_name,
          grade_level: request.grade_level || "Primary 1",
        });
      }
      const { error } = await supabase
        .from("enrollment_requests")
        .update({ status: approve ? "approved" : "rejected" })
        .eq("id", request.id);
      if (error) throw error;
      await reload();
      if (approve) showSuccess(t("enrollments.approved"), t("enrollments.approvedHint"));
    } catch (e) {
      showError(t("enrollments.decisionFailed"), e);
    }
  };

  return (
    <DashboardShell
      title={t("sidebar.enrollments")}
      subtitle={`${counts.pending} ${t("enrollments.awaiting")}`}
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("enrollments.loadFailed"), e);
        } finally {
          setRefreshing(false);
        }
      }}
    >
      <Card accent={colors.brand}>
        <CardHeader
          title={t("enrollments.joinCode")}
          subtitle={t("enrollments.joinCodeHint")}
          icon={
            <IconTile size={40}>
              <UserPlus size={19} color={colors.brandDeep} />
            </IconTile>
          }
        />
        <View style={styles.codeBox}>
          <Text variant="h1" weight="extrabold" center tabular style={styles.code}>
            {joinCode ?? "—"}
          </Text>
        </View>
        <View style={styles.codeActions}>
          <Button
            label={t("common.copy")}
            variant="outline"
            size="sm"
            disabled={!joinCode}
            icon={<Copy size={16} color={colors.brandDark} />}
            onPress={async () => {
              if (!joinCode) return;
              await Clipboard.setStringAsync(joinCode);
              showSuccess(t("students.copied"), t("enrollments.codeCopied"));
            }}
          />
          <Button
            label={t("common.share")}
            variant="outline"
            size="sm"
            disabled={!joinCode}
            icon={<Share2 size={16} color={colors.brandDark} />}
            onPress={async () => {
              if (!joinCode) return;
              try {
                await Share.share({ message: `${t("enrollments.shareMessage")} ${joinCode}` });
              } catch (e) {
                showError(t("students.shareFailed"), e);
              }
            }}
          />
          <Button
            label={t("enrollments.regenerate")}
            variant="ghost"
            size="sm"
            loading={regenerating}
            icon={<RefreshCw size={16} color={colors.brandDark} />}
            onPress={regenerate}
          />
        </View>
      </Card>

      <OptionGroup<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "pending", label: `${t("student.pending")} (${counts.pending})` },
          { value: "approved", label: `${t("enrollments.approvedTab")} (${counts.approved})` },
          { value: "rejected", label: `${t("enrollments.rejectedTab")} (${counts.rejected})` },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<Users size={24} color={colors.brandDeep} />}
          title={t("enrollments.noneInTab")}
          subtitle={filter === "pending" ? t("enrollments.pendingHint") : undefined}
        />
      ) : (
        visible.map((item) => (
          <Card
            key={item.id}
            onPress={item.status === "pending" ? () => setSelected(item) : undefined}
            padded={false}
          >
            <View style={styles.row}>
              <Avatar name={item.full_name} size={42} letters={2} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodySm" weight="bold" numberOfLines={1}>
                  {item.full_name}
                </Text>
                <Text variant="micro" color={colors.textMuted} numberOfLines={1}>
                  {[item.grade_level, new Date(item.created_at).toLocaleDateString(locale)]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                <View style={styles.badges}>
                  <Badge
                    label={
                      item.status === "pending"
                        ? t("student.pending")
                        : item.status === "approved"
                          ? t("enrollments.approvedTab")
                          : t("enrollments.rejectedTab")
                    }
                    tone={
                      item.status === "pending"
                        ? "warning"
                        : item.status === "approved"
                          ? "success"
                          : "danger"
                    }
                  />
                </View>
              </View>
            </View>
          </Card>
        ))
      )}

      <Sheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.full_name}
        subtitle={selected?.grade_level ?? t("students.noGrade")}
      >
        {selected ? (
          <>
            <SheetAction
              label={t("enrollments.approve")}
              hint={t("enrollments.approveHint")}
              icon={<Check size={18} color={colors.emeraldText} />}
              onPress={() => void decide(selected, true)}
            />
            <SheetAction
              label={t("enrollments.reject")}
              destructive
              icon={<X size={18} color={colors.dangerText} />}
              onPress={() => void decide(selected, false)}
            />
          </>
        ) : null}
      </Sheet>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  codeBox: {
    marginTop: space.md,
    paddingVertical: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.brandMute,
  },
  code: { letterSpacing: 6 },
  codeActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
});
