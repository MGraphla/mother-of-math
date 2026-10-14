import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors, layout, radius, shadow, space } from "../theme/tokens";
import { Text } from "./Text";

export interface StatTone {
  dot: string;
  iconBg: string;
  iconFg: string;
}

export const statTones: Record<"brand" | "amber" | "emerald" | "blue" | "violet", StatTone> = {
  brand: { dot: colors.brand, iconBg: colors.brandSoft, iconFg: colors.brandDeep },
  amber: { dot: colors.amber, iconBg: colors.amberSoft, iconFg: colors.amberText },
  emerald: { dot: colors.emerald, iconBg: colors.emeraldSoft, iconFg: colors.emeraldText },
  blue: { dot: colors.blue, iconBg: colors.blueSoft, iconFg: colors.blueText },
  violet: { dot: colors.violet, iconBg: colors.violetSoft, iconFg: colors.violetText },
};

/**
 * Mirrors the web dashboard KPI card: label + big value on the left, tinted icon
 * tile on the right, and a coloured dot with a caption underneath.
 */
export const StatCard = ({
  label,
  value,
  caption,
  icon,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  caption?: string;
  icon?: ReactNode;
  tone?: keyof typeof statTones;
}) => {
  const t = statTones[tone];
  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.top}>
        <View style={styles.textCol}>
          <Text variant="micro" weight="medium" color={colors.textMuted} numberOfLines={2}>
            {label}
          </Text>
          <Text variant="stat" weight="bold" tabular style={{ marginTop: 2 }}>
            {value}
          </Text>
        </View>
        {icon ? <View style={[styles.iconTile, { backgroundColor: t.iconBg }]}>{icon}</View> : null}
      </View>
      {caption ? (
        <View style={styles.captionRow}>
          <View style={[styles.dot, { backgroundColor: t.dot }]} />
          <Text variant="micro" weight="medium" color={colors.textMuted} numberOfLines={1}>
            {caption}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

/** Dense four-across strip the web uses on narrow screens (`md:hidden` KPI row). */
export const StatStrip = ({ items }: { items: { label: string; value: string | number }[] }) => (
  <View style={styles.strip}>
    {items.map((item, i) => (
      <View key={item.label} style={[styles.stripCell, i > 0 && styles.stripDivider]}>
        <Text variant="micro" weight="medium" color={colors.textMuted} center numberOfLines={1}>
          {item.label}
        </Text>
        <Text variant="caption" weight="bold" center tabular style={{ marginTop: 3 }}>
          {item.value}
        </Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: "46%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: layout.hairline,
    borderColor: colors.border,
    padding: space.md + 2,
  },
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  textCol: { flex: 1, paddingRight: space.sm },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  captionRow: { flexDirection: "row", alignItems: "center", marginTop: space.sm },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  strip: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: layout.hairline,
    borderColor: colors.border,
    overflow: "hidden",
  },
  stripCell: { flex: 1, paddingVertical: space.sm + 2, paddingHorizontal: 4 },
  stripDivider: { borderLeftWidth: layout.hairline, borderLeftColor: colors.border },
});
