import type { ReactNode } from "react";
import { router } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { WaveGridBackground } from "./WaveGridBackground";
import { colors, layout, radius, space } from "../theme/tokens";
import { IconButton, Text } from "../ui";

/** Solid-color auth chrome with a white form card (no brand wordmark). */
export const AuthShell = ({
  title,
  subtitle,
  children,
  footer,
  progress,
  onBack,
  onStepPress,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** `{ step, total, label }` renders the wizard progress bar above the title. */
  progress?: { step: number; total: number; label?: string };
  onBack?: () => void;
  /** Jump back to a completed wizard step (matches web step indicator). */
  onStepPress?: (step: number) => void;
}) => {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, layout.contentMaxWidth);

  const goBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace("/(public)/welcome");
  };

  return (
    <View style={styles.root}>
      <WaveGridBackground />
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={[styles.topBar, { width: contentWidth }]}>
          <IconButton accessibilityLabel="Go back" onPress={goBack} tone="brand">
            <ArrowLeft size={20} color={colors.brandDeep} />
          </IconButton>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={layout.keyboardOffset}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.card, { width: contentWidth - space.xl * 2 }]}>
              {progress ? (
                <View style={styles.progress}>
                  <View style={styles.progressDots}>
                    {Array.from({ length: progress.total }, (_, i) => {
                      const n = i + 1;
                      const active = n === progress.step;
                      const done = n < progress.step;
                      return (
                        <Pressable
                          key={n}
                          disabled={!done || !onStepPress}
                          onPress={() => onStepPress?.(n)}
                          style={[
                            styles.progressDot,
                            done && styles.progressDotDone,
                            active && styles.progressDotActive,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Step ${n}`}
                        >
                          <Text
                            variant="micro"
                            weight="bold"
                            color={done || active ? colors.white : colors.textMuted}
                          >
                            {n}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.progressLabels}>
                    <Text variant="micro" weight="semibold" color={colors.brandDark} uppercase>
                      {progress.label ?? ""}
                    </Text>
                    <Text variant="micro" weight="semibold" color={colors.textMuted} tabular>
                      {`${progress.step}/${progress.total}`}
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${(progress.step / progress.total) * 100}%` },
                      ]}
                    />
                  </View>
                </View>
              ) : null}

              <Text variant="h1" weight="extrabold">
                {title}
              </Text>
              {subtitle ? (
                <Text variant="bodySm" color={colors.textMuted} style={styles.subtitle}>
                  {subtitle}
                </Text>
              ) : null}

              <View style={styles.body}>{children}</View>
              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

/** Centred "or continue with" rule used between password and OAuth buttons. */
export const AuthDivider = ({ label }: { label: string }) => (
  <View style={styles.dividerRow}>
    <View style={styles.dividerLine} />
    <Text variant="micro" weight="medium" color={colors.textMuted} uppercase>
      {label}
    </Text>
    <View style={styles.dividerLine} />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1, zIndex: 1 },
  flex: { flex: 1 },
  topBar: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
  },
  card: {
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: space.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.12)",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOpacity: 0.48,
        shadowRadius: 36,
        shadowOffset: { width: 0, height: 18 },
      },
      android: {
        elevation: 28,
        shadowColor: "#000000",
      },
      default: {},
    }),
  },
  progress: { marginBottom: space.lg, gap: 8 },
  progressDots: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.gray200,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  progressDotDone: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  progressLabels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.gray200,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: radius.full, backgroundColor: colors.brand },
  subtitle: { marginTop: 6 },
  body: { gap: space.md, marginTop: space.lg },
  footer: { gap: space.sm, marginTop: space.lg },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  dividerLine: { flex: 1, height: layout.hairline, backgroundColor: colors.border },
});
