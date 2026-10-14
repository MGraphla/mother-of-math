import { useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Brain, Lightbulb, TriangleAlert } from "lucide-react-native";
import { useLanguage } from "../../../src/context/LanguageContext";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  listStudentWorksByName,
  resolveActiveStudentSession,
} from "../../../src/services/studentPortal";
import { colors, layout, radius, space } from "../../../src/theme/tokens";
import {
  Badge,
  Card,
  EmptyState,
  IconTile,
  RichText,
  Sheet,
  Text,
  showError,
} from "../../../src/ui";

interface WorkRow {
  id: string;
  subject: string | null;
  feedback: string | null;
  error_type: string | null;
  remediation: string | null;
  image_url: string | null;
  created_at: string;
}

const isImage = (url?: string | null) =>
  !!url && /\.(png|jpe?g|gif|webp|heic)(\?|$)/i.test(url);

export default function StudentAnalysisScreen() {
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [items, setItems] = useState<WorkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<WorkRow | null>(null);

  const reload = useCallback(async () => {
    const session = await resolveActiveStudentSession();
    if (!session) {
      setItems([]);
      return;
    }
    setItems((await listStudentWorksByName(session.full_name)) as WorkRow[]);
  }, []);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("student.analysisLoadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  return (
    <DashboardShell
      title={t("sidebar.myFeedback")}
      subtitle={t("student.analysisTagline")}
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("student.analysisLoadFailed"), e);
        } finally {
          setRefreshing(false);
        }
      }}
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<Brain size={24} color={colors.brandDeep} />}
          title={t("student.noAnalysisYet")}
          subtitle={t("student.noAnalysisHint")}
        />
      ) : (
        items.map((item) => (
          <Card key={item.id} onPress={() => setOpen(item)} accent={colors.brand}>
            <View style={styles.row}>
              {isImage(item.image_url) ? (
                <Image
                  source={{ uri: item.image_url! }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
              ) : (
                <IconTile size={52} rounded={radius.md}>
                  <Brain size={22} color={colors.brandDeep} />
                </IconTile>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodySm" weight="bold" numberOfLines={1}>
                  {item.subject ?? t("student.mathWork")}
                </Text>
                <Text variant="micro" color={colors.textMuted}>
                  {new Date(item.created_at).toLocaleDateString(locale, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
                {item.feedback ? (
                  <Text
                    variant="micro"
                    color={colors.textSecondary}
                    numberOfLines={2}
                    style={{ marginTop: 4 }}
                  >
                    {item.feedback.replace(/[#*`]/g, "")}
                  </Text>
                ) : null}
              </View>
            </View>
            {item.error_type ? (
              <View style={styles.badges}>
                <Badge
                  label={item.error_type.slice(0, 30)}
                  tone="warning"
                  icon={<TriangleAlert size={11} color={colors.amberText} />}
                />
              </View>
            ) : null}
          </Card>
        ))
      )}

      <Sheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open?.subject ?? t("student.mathWork")}
        subtitle={open ? new Date(open.created_at).toLocaleString(locale) : undefined}
      >
        {open ? (
          <>
            {isImage(open.image_url) ? (
              <Image
                source={{ uri: open.image_url! }}
                style={styles.preview}
                resizeMode="contain"
              />
            ) : null}

            {open.error_type ? (
              <View style={[styles.panel, styles.panelWarn]}>
                <View style={styles.panelHead}>
                  <TriangleAlert size={15} color={colors.amberText} />
                  <Text variant="micro" weight="bold" color={colors.amberText} uppercase>
                    {t("student.whatToWatch")}
                  </Text>
                </View>
                <Text variant="caption" color={colors.textSecondary} style={{ marginTop: 6 }}>
                  {open.error_type}
                </Text>
              </View>
            ) : null}

            {open.remediation ? (
              <View style={[styles.panel, styles.panelTip]}>
                <View style={styles.panelHead}>
                  <Lightbulb size={15} color={colors.brandDeep} />
                  <Text variant="micro" weight="bold" color={colors.brandDeep} uppercase>
                    {t("student.howToImprove")}
                  </Text>
                </View>
                <View style={{ marginTop: 6 }}>
                  <RichText source={open.remediation} />
                </View>
              </View>
            ) : null}

            {open.feedback ? (
              <View>
                <Text variant="micro" weight="bold" color={colors.brandDeep} uppercase>
                  {t("student.fullFeedback")}
                </Text>
                <View style={{ marginTop: 6 }}>
                  <RichText source={open.feedback} />
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.gray100 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.md },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    borderWidth: layout.hairline,
    borderColor: colors.border,
  },
  panel: { padding: space.md, borderRadius: radius.md, borderWidth: 1 },
  panelWarn: { backgroundColor: colors.amberSoft, borderColor: colors.amberBorder },
  panelTip: { backgroundColor: colors.brandTint, borderColor: colors.brandMute },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 6 },
});
