import { type ReactNode, useEffect, useRef } from "react";
import { Alert, Animated, Easing, StyleSheet, View, type ViewStyle } from "react-native";
import { colors, layout, radius, space } from "../theme/tokens";
import { Button } from "./Button";
import { Text } from "./Text";

export const EmptyState = ({
  title,
  subtitle,
  icon,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <View style={styles.empty}>
    {icon ? <View style={styles.emptyIcon}>{icon}</View> : null}
    <Text variant="h3" weight="bold" center>
      {title}
    </Text>
    {subtitle ? (
      <Text variant="caption" color={colors.textMuted} center style={{ marginTop: 6 }}>
        {subtitle}
      </Text>
    ) : null}
    {actionLabel && onAction ? (
      <Button
        label={actionLabel}
        onPress={onAction}
        size="sm"
        fullWidth={false}
        style={{ marginTop: space.lg }}
      />
    ) : null}
  </View>
);

export const SectionHeader = ({
  title,
  action,
  icon,
}: {
  title: string;
  action?: ReactNode;
  icon?: ReactNode;
}) => (
  <View style={styles.sectionHeader}>
    {icon ? <View style={{ marginRight: space.sm }}>{icon}</View> : null}
    <Text variant="h3" weight="bold" style={{ flex: 1 }} numberOfLines={1}>
      {title}
    </Text>
    {action}
  </View>
);

export const SectionLabel = ({ children }: { children: string }) => (
  <Text
    variant="label"
    weight="semibold"
    color={colors.textMuted}
    uppercase
    style={{ marginTop: space.sm }}
  >
    {children}
  </Text>
);

/** Pulsing placeholder block shown while a screen's data loads. */
export const Skeleton = ({
  height = 16,
  width = "100%",
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  style?: ViewStyle;
}) => {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        { height, width, borderRadius: radius.sm, backgroundColor: colors.gray200, opacity: pulse },
        style,
      ]}
    />
  );
};

export const SkeletonCard = () => (
  <View style={styles.skeletonCard}>
    <Skeleton height={12} width="45%" />
    <Skeleton height={26} width="30%" style={{ marginTop: space.sm }} />
    <Skeleton height={10} width="70%" style={{ marginTop: space.md }} />
  </View>
);

export const SkeletonList = ({ count = 4 }: { count?: number }) => (
  <View style={{ gap: space.md }}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </View>
);

export const errorMessage = (error: unknown): string => {
  if (!error) return "Something went wrong.";
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message && error.message !== "[object Object]") {
    return error.message;
  }
  if (typeof error === "object") {
    const record = error as {
      message?: unknown;
      error?: unknown;
      error_description?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    if (typeof record.message === "string" && record.message.trim() && record.message !== "[object Object]") {
      return record.message;
    }
    if (record.message && typeof record.message === "object") return errorMessage(record.message);
    if (typeof record.error === "string" && record.error.trim()) return record.error;
    if (record.error && typeof record.error === "object") return errorMessage(record.error);
    if (typeof record.error_description === "string" && record.error_description.trim()) {
      return record.error_description;
    }
    if (typeof record.details === "string" && record.details.trim()) return record.details;
    if (typeof record.hint === "string" && record.hint.trim()) return record.hint;
  }
  return "Something went wrong. Please try again.";
};

export const confirmDelete = (label: string, onConfirm: () => void) =>
  Alert.alert("Delete", `Delete ${label}? This cannot be undone.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: onConfirm },
  ]);

export const showError = (title: string, error: unknown) =>
  Alert.alert(title, errorMessage(error));

export const showSuccess = (title: string, message: string) => Alert.alert(title, message);

const styles = StyleSheet.create({
  empty: {
    paddingVertical: space.xxxl,
    paddingHorizontal: space.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    alignItems: "center",
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.md,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: space.sm },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: layout.hairline,
    borderColor: colors.border,
    padding: space.lg,
  },
});
