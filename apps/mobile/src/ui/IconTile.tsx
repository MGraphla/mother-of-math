import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { colors, radius } from "../theme/tokens";

/** Rounded tinted square that holds a Lucide icon, used in list rows and headers. */
export const IconTile = ({
  children,
  bg = colors.brandSoft,
  size = 40,
  rounded = radius.md,
  style,
}: {
  children: ReactNode;
  bg?: string;
  size?: number;
  rounded?: number;
  style?: ViewStyle;
}) => (
  <View
    style={[
      styles.tile,
      { width: size, height: size, borderRadius: rounded, backgroundColor: bg },
      style,
    ]}
  >
    {children}
  </View>
);

const styles = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center" },
});
