import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors, radius, space } from "../theme/tokens";
import { Text } from "./Text";

export type BadgeTone =
  | "brand"
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "onBrand"
  | "outline";

const TONES: Record<BadgeTone, { bg: string; fg: string; border?: string }> = {
  brand: { bg: colors.brandSoft, fg: colors.brandDeep },
  neutral: { bg: colors.gray100, fg: colors.gray700 },
  success: { bg: colors.emeraldSoft, fg: colors.emeraldText },
  warning: { bg: colors.amberSoft, fg: colors.amberText },
  danger: { bg: colors.dangerSoft, fg: colors.dangerText },
  info: { bg: colors.blueSoft, fg: colors.blueText },
  onBrand: { bg: colors.onBrandActive, fg: colors.white },
  outline: { bg: "transparent", fg: colors.textSecondary, border: colors.borderStrong },
};

export const Badge = ({
  label,
  tone = "neutral",
  icon,
  style,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: ReactNode;
  style?: ViewStyle;
}) => {
  const { bg, fg, border } = TONES[tone];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg },
        border ? { borderWidth: 1, borderColor: border } : null,
        style,
      ]}
    >
      {icon ? <View style={{ marginRight: 4 }}>{icon}</View> : null}
      <Text variant="micro" weight="semibold" color={fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
});
