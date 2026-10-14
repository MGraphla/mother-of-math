import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, ChevronDown, X } from "lucide-react-native";
import { colors, layout, radius, space } from "../theme/tokens";
import { Text } from "./Text";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

/** Tap-to-open bottom sheet picker, the native stand-in for the web `<select>`. */
export const Select = <T extends string = string>({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  error,
  required,
  hint,
  compact,
}: {
  label?: string;
  /** Empty string shows the placeholder (e.g. class not chosen yet). */
  value: T | "";
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string | null;
  required?: boolean;
  hint?: string;
  /** Shorter trigger for dense headers (country / class on chatbot). */
  compact?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={compact ? styles.compactWrap : undefined}>
      {label ? (
        <View style={styles.labelRow}>
          <Text variant="caption" weight="semibold" color={colors.textSecondary}>
            {label}
          </Text>
          {required ? (
            <Text variant="caption" weight="semibold" color={colors.danger}>
              {" *"}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        style={({ pressed }) => [
          styles.trigger,
          compact && styles.triggerCompact,
          !!error && styles.triggerError,
          pressed && styles.triggerPressed,
        ]}
      >
        <Text
          variant={compact ? "caption" : "body"}
          weight={compact ? "semibold" : "regular"}
          color={selected ? colors.text : colors.textFaint}
          style={{ flex: 1 }}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={compact ? 14 : 18} color={colors.textMuted} />
      </Pressable>

      {error ? (
        <Text variant="micro" weight="medium" color={colors.dangerText} style={styles.helper}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="micro" color={colors.textMuted} style={styles.helper}>
          {hint}
        </Text>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} />
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text variant="h3" weight="bold" style={{ flex: 1 }}>
              {label ?? placeholder}
            </Text>
            <Pressable
              onPress={() => setOpen(false)}
              hitSlop={layout.hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            style={styles.list}
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.option,
                    (pressed || active) && styles.optionActive,
                  ]}
                >
                  <Text
                    variant="bodySm"
                    weight={active ? "semibold" : "regular"}
                    color={active ? colors.brandDeep : colors.text}
                    style={{ flex: 1 }}
                  >
                    {item.label}
                  </Text>
                  {active ? <Check size={18} color={colors.brand} /> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  compactWrap: { minWidth: 72, maxWidth: 140 },
  labelRow: { flexDirection: "row", marginBottom: 6 },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
  },
  triggerCompact: {
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: radius.lg,
    gap: 4,
  },
  triggerPressed: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  triggerError: { borderColor: colors.danger },
  helper: { marginTop: 5 },
  scrim: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    maxHeight: "70%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.md,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colors.border,
  },
  list: { paddingHorizontal: space.md, paddingVertical: space.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  optionActive: { backgroundColor: colors.brandTint },
});
