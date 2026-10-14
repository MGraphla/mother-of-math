import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { colors, layout, radius, shadow, space } from "../theme/tokens";
import { Text } from "./Text";

/**
 * The general-purpose record row used across list screens: optional leading icon
 * tile, title/subtitle/meta stack, trailing slot, and an optional chevron.
 */
export const ListRow = ({
  title,
  subtitle,
  meta,
  leading,
  trailing,
  badges,
  onPress,
  onLongPress,
  chevron,
  accent,
  style,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  badges?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  chevron?: boolean;
  accent?: string;
  style?: ViewStyle;
}) => {
  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>
        <Text variant="bodySm" weight="semibold" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="caption"
            color={colors.textMuted}
            numberOfLines={3}
            style={{ marginTop: 3 }}
          >
            {subtitle}
          </Text>
        ) : null}
        {badges ? <View style={styles.badges}>{badges}</View> : null}
        {meta ? (
          <Text variant="micro" weight="semibold" color={colors.brandDark} style={{ marginTop: 6 }}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {chevron && onPress ? <ChevronRight size={18} color={colors.textFaint} /> : null}
    </>
  );

  const base: (ViewStyle | false | undefined | object)[] = [
    styles.row,
    shadow.xs,
    accent ? { borderLeftWidth: 4, borderLeftColor: accent } : undefined,
    style,
  ];

  if (!onPress && !onLongPress) return <View style={base}>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={layout.hitSlop}
      android_ripple={{ color: colors.brandSoft }}
      style={({ pressed }) => [...base, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
};

/** Two-column key/value line for detail panels and tables. */
export const DataRow = ({
  label,
  value,
  trailing,
}: {
  label: string;
  value?: string;
  trailing?: ReactNode;
}) => (
  <View style={styles.dataRow}>
    <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }} numberOfLines={1}>
      {label}
    </Text>
    {value ? (
      <Text variant="caption" weight="semibold" numberOfLines={1} style={{ marginLeft: space.sm }}>
        {value}
      </Text>
    ) : null}
    {trailing}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: layout.hairline,
    borderColor: colors.border,
    padding: space.md + 2,
    gap: space.sm,
  },
  pressed: { backgroundColor: colors.brandTint, borderColor: colors.brandMute },
  leading: { marginRight: 2 },
  body: { flex: 1, minWidth: 0 },
  trailing: { marginLeft: space.sm },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.sm },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colors.border,
  },
});
