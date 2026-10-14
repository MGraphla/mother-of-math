import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from "react-native";
import { colors, fonts, typography, type FontWeightName } from "../theme/tokens";

type Variant = keyof typeof typography;

export interface TextProps extends RNTextProps {
  variant?: Variant;
  weight?: FontWeightName;
  color?: string;
  center?: boolean;
  uppercase?: boolean;
  /** Renders digits at a fixed width so numbers in tables/stats don't jitter. */
  tabular?: boolean;
}

export const Text = ({
  variant = "body",
  weight = "regular",
  color = colors.text,
  center,
  uppercase,
  tabular,
  style,
  ...rest
}: TextProps) => (
  <RNText
    {...rest}
    style={[
      typography[variant],
      { fontFamily: fonts[weight], color },
      center && styles.center,
      uppercase && styles.uppercase,
      tabular && styles.tabular,
      style,
    ]}
  />
);

const styles = StyleSheet.create({
  center: { textAlign: "center" },
  uppercase: { textTransform: "uppercase" },
  tabular: { fontVariant: ["tabular-nums"] },
});
