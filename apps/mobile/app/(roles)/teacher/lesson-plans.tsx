import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { BookOpen, Copy, FileDown, Plus, Presentation, Trash2 } from "lucide-react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { supabase } from "../../../src/lib/supabase";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  fetchTeacherLessonPlans,
  lessonPlanContentToText,
  type LessonPlanRow,
} from "../../../src/services/teacherDashboard";
import {
  exportLessonPlanPdf,
  exportLessonPlanPptx,
} from "../../../src/services/lessonPlanExport";
import { savedFileHint } from "../../../src/native/saveFile";
import { colors, space } from "../../../src/theme/tokens";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  IconTile,
  RichText,
  Sheet,
  Text,
  showError,
  showSuccess,
} from "../../../src/ui";

export default function TeacherLessonPlansScreen() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [plans, setPlans] = useState<LessonPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<LessonPlanRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    setPlans(await fetchTeacherLessonPlans(supabase, user.id));
  }, [user]);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("lessonPlans.loadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter((p) =>
      [p.title, p.level].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [plans, query]);

  const bodyOf = (plan: LessonPlanRow) => lessonPlanContentToText(plan.content);

  const runExport = async (kind: "pdf" | "pptx") => {
    if (!open) return;
    setExporting(true);
    try {
      const markdown = bodyOf(open);
      if (kind === "pdf") {
        const fileName = await exportLessonPlanPdf(open.content as object, open.title, open.level ?? "", markdown);
        showSuccess("PDF saved to your phone", savedFileHint(fileName));
      } else {
        const fileName = await exportLessonPlanPptx(open.content as object, open.title, open.level ?? "", markdown);
        showSuccess("PowerPoint saved to your phone", savedFileHint(fileName));
      }
    } catch (e) {
      showError(kind === "pdf" ? "PDF export failed" : "PowerPoint export failed", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardShell
      title={t("sidebar.viewLessonPlans")}
      subtitle={`${plans.length} ${t("lessonPlans.inLibrary")}`}
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("lessonPlans.loadFailed"), e);
        } finally {
          setRefreshing(false);
        }
      }}
      search={{ value: query, onChangeText: setQuery, placeholder: t("lessonPlans.search") }}
      headerRight={
        <IconButton
          accessibilityLabel={t("lessonPlans.generate")}
          onPress={() => router.push("/(roles)/teacher/lesson-plan-generator")}
          tone="brand"
        >
          <Plus size={20} color={colors.brandDeep} />
        </IconButton>
      }
    >
      {visible.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={24} color={colors.brandDeep} />}
          title={plans.length === 0 ? t("lessonPlans.noneYet") : t("common.noResults")}
          subtitle={plans.length === 0 ? t("lessonPlans.noneHint") : t("students.adjustSearch")}
          actionLabel={plans.length === 0 ? t("lessonPlans.generate") : undefined}
          onAction={
            plans.length === 0
              ? () => router.push("/(roles)/teacher/lesson-plan-generator")
              : undefined
          }
        />
      ) : (
        visible.map((plan) => (
          <Card key={plan.id} onPress={() => setOpen(plan)} accent={colors.brand}>
            <View style={styles.row}>
              <IconTile size={40}>
                <BookOpen size={19} color={colors.brandDeep} />
              </IconTile>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodySm" weight="bold" numberOfLines={2}>
                  {plan.title}
                </Text>
                <Text
                  variant="micro"
                  color={colors.textMuted}
                  numberOfLines={2}
                  style={{ marginTop: 2 }}
                >
                  {lessonPlanContentToText(plan.content).slice(0, 120)}
                </Text>
                <View style={styles.badges}>
                  {plan.level ? <Badge label={plan.level} tone="brand" /> : null}
                  {plan.created_at ? (
                    <Badge
                      label={new Date(plan.created_at).toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                      })}
                      tone="outline"
                    />
                  ) : null}
                </View>
              </View>
            </View>
          </Card>
        ))
      )}

      <Sheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open?.title}
        subtitle={open?.level ?? undefined}
        footer={
          open ? (
            <View style={styles.actionsWrap}>
              <View style={styles.actions}>
                <Button
                  label="PDF"
                  variant="outline"
                  size="sm"
                  loading={exporting}
                  icon={<FileDown size={16} color={colors.brandDark} />}
                  onPress={() => runExport("pdf")}
                />
                <Button
                  label="PPT"
                  variant="outline"
                  size="sm"
                  loading={exporting}
                  icon={<Presentation size={16} color={colors.brandDark} />}
                  onPress={() => runExport("pptx")}
                />
              </View>
              <View style={styles.actions}>
                <Button
                  label={t("common.copy")}
                  variant="ghost"
                  size="sm"
                  icon={<Copy size={16} color={colors.brandDark} />}
                  onPress={async () => {
                    await Clipboard.setStringAsync(bodyOf(open));
                    showSuccess(t("students.copied"), t("lessonPlans.copiedHint"));
                  }}
                />
                <Button
                  label={t("common.delete")}
                  variant="danger"
                  size="sm"
                  loading={deleting}
                  icon={<Trash2 size={16} color={colors.white} />}
                  onPress={async () => {
                    if (!user || !open) return;
                    setDeleting(true);
                    try {
                      const { error } = await supabase
                        .from("lesson_plans")
                        .delete()
                        .eq("id", open.id)
                        .eq("user_id", user.id);
                      if (error) throw error;
                      setOpen(null);
                      await reload();
                      showSuccess("Deleted", open.title);
                    } catch (e) {
                      showError("Delete failed", e);
                    } finally {
                      setDeleting(false);
                    }
                  }}
                />
              </View>
            </View>
          ) : null
        }
      >
        {open ? <RichText source={lessonPlanContentToText(open.content)} /> : null}
      </Sheet>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.sm },
  actionsWrap: { gap: space.sm },
  actions: { flexDirection: "row", gap: space.sm },
});
