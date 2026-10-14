import { Platform, Pressable, StyleSheet, Switch, View } from "react-native";
import { colors, layout, radius, space } from "../theme/tokens";
import { Text } from "./Text";

/** Labelled switch row, matching the web's toggle-in-a-card pattern. */
export const Toggle = ({
  label,
  hint,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) => (
  <Pressable
    onPress={() => !disabled && onValueChange(!value)}
    accessibilityRole="switch"
    accessibilityState={{ checked: value, disabled }}
    style={styles.row}
  >
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text variant="bodySm" weight="semibold">
        {label}
      </Text>
      {hint ? (
        <Text variant="micro" color={colors.textMuted} style={{ marginTop: 2 }}>
          {hint}
        </Text>
      ) : null}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.gray300, true: colors.brandMute }}
      thumbColor={Platform.OS === "android" ? (value ? colors.brand : colors.gray100) : undefined}
      ios_backgroundColor={colors.gray300}
    />
  </Pressable>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: layout.minTouch,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
});
