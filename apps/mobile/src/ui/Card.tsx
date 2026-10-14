import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { colors, layout, radius, shadow, space } from "../theme/tokens";
import { Text } from "./Text";

export interface CardProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  onLongPress?: () => void;
  padded?: boolean;
  /** Coloured left rail, matching the web's `border-l-4 border-primary` cards. */
  accent?: string;
  elevation?: "none" | "xs" | "card" | "md";
}

export const Card = ({
  children,
  style,
  onPress,
  onLongPress,
  padded = true,
  accent,
  elevation = "card",
}: CardProps) => {
  const base = [
    styles.card,
    shadow[elevation],
    padded && styles.padded,
    accent ? { borderLeftWidth: 4, borderLeftColor: accent } : null,
    style,
  ];

  if (!onPress && !onLongPress) return <View style={base}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      android_ripple={{ color: colors.brandSoft }}
      hitSlop={layout.hitSlop}
      style={({ pressed }) => [...base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
};

export const CardHeader = ({
  title,
  subtitle,
  right,
  icon,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  icon?: ReactNode;
}) => (
  <View style={styles.header}>
    {icon ? <View style={styles.headerIcon}>{icon}</View> : null}
    <View style={styles.headerText}>
      <Text variant="h3" weight="bold">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {right}
  </View>
);

/** A grey header strip + divider, like the web's `bg-gray-50/50 border-b` card headers. */
export const CardSection = ({
  title,
  right,
  children,
  icon,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
}) => (
  <View style={[styles.card, shadow.card, styles.sectionCard]}>
    <View style={styles.sectionHeader}>
      {icon ? <View style={{ marginRight: space.sm }}>{icon}</View> : null}
      <Text variant="h3" weight="bold" style={{ flex: 1 }}>
        {title}
      </Text>
      {right}
    </View>
    <View>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: layout.hairline,
    borderColor: colors.border,
    overflow: "hidden",
  },
  padded: { padding: space.lg },
  pressed: { backgroundColor: colors.brandTint, borderColor: colors.brandMute },
  sectionCard: { padding: 0 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.gray50,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colors.border,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: space.md },
  headerIcon: { marginRight: space.md },
  headerText: { flex: 1 },
});
