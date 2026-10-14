import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { colors, layout, radius, shadow, space } from "../theme/tokens";
import { Text } from "./Text";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "onBrand"
  | "onBrandOutline";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const HEIGHTS: Record<ButtonSize, number> = { sm: 38, md: 48, lg: 56 };

const FILL: Record<ButtonVariant, string> = {
  primary: colors.brand,
  secondary: colors.secondary,
  outline: colors.surface,
  ghost: "transparent",
  danger: colors.danger,
  onBrand: colors.white,
  onBrandOutline: "transparent",
};

const LABEL: Record<ButtonVariant, string> = {
  primary: colors.white,
  secondary: colors.white,
  outline: colors.brandDark,
  ghost: colors.brandDark,
  danger: colors.white,
  onBrand: colors.brandDeep,
  onBrandOutline: colors.white,
};

export const Button = ({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  icon,
  iconRight,
  fullWidth = true,
  style,
}: ButtonProps) => {
  const isBusy = !!(disabled || loading);
  const labelColor = LABEL[variant];

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isBusy}
      hitSlop={layout.hitSlop}
      accessibilityRole="button"
      accessibilityState={{ disabled: isBusy, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHTS[size], backgroundColor: FILL[variant] },
        variant === "outline" && styles.outline,
        variant === "onBrandOutline" && styles.onBrandOutline,
        (variant === "primary" || variant === "secondary" || variant === "danger" || variant === "onBrand") &&
          shadow.xs,
        fullWidth ? styles.full : styles.auto,
        pressed && !isBusy && styles.pressed,
        isBusy && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.iconLeft}>{icon}</View> : null}
          <Text
            variant={size === "sm" ? "caption" : "subtitle"}
            weight={size === "lg" ? "bold" : "semibold"}
            color={labelColor}
            numberOfLines={1}
          >
            {label}
          </Text>
          {iconRight ? <View style={styles.iconRight}>{iconRight}</View> : null}
        </View>
      )}
    </Pressable>
  );
};

/** Square icon-only button used in headers and card actions. */
export const IconButton = ({
  children,
  onPress,
  accessibilityLabel,
  tone = "neutral",
  size = 40,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: "neutral" | "brand" | "onBrand" | "danger";
  size?: number;
  style?: ViewStyle;
}) => {
  const bg =
    tone === "brand"
      ? colors.brandSoft
      : tone === "onBrand"
        ? colors.onBrandHover
        : tone === "danger"
          ? colors.dangerSoft
          : "transparent";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={layout.hitSlop}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
        },
        pressed && { opacity: 0.6 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  full: { alignSelf: "stretch" },
  auto: { alignSelf: "flex-start" },
  outline: { borderWidth: 1.5, borderColor: colors.brand },
  onBrandOutline: { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.45)" },
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.5 },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  iconLeft: { marginRight: space.sm },
  iconRight: { marginLeft: space.sm },
});
