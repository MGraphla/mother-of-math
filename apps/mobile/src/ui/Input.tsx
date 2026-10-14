import { type ReactNode, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { colors, fonts, layout, radius, space, typography } from "../theme/tokens";
import { Text } from "./Text";

export interface InputProps extends Omit<TextInputProps, "style"> {
  label?: string;
  /** Optional control rendered opposite the label (e.g. Forgot password?). */
  labelRight?: ReactNode;
  hint?: string;
  error?: string | null;
  icon?: ReactNode;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  /** Adds a show/hide toggle and starts obscured. */
  password?: boolean;
  required?: boolean;
}

export const Input = ({
  label,
  labelRight,
  hint,
  error,
  icon,
  multiline,
  containerStyle,
  inputStyle,
  password,
  required,
  ...rest
}: InputProps) => {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  // Android fires a spurious empty onChangeText when secureTextEntry toggles;
  // ignore that so the password is not wiped mid-login.
  const ignoreNextEmpty = useRef(false);

  const isPassword = !!password;
  const secure = isPassword ? !revealed : !!rest.secureTextEntry;

  return (
    <View style={containerStyle}>
      {label || labelRight ? (
        <View style={styles.labelRow}>
          <View style={styles.labelLeft}>
            {label ? (
              <Text variant="caption" weight="semibold" color={colors.textSecondary}>
                {label}
              </Text>
            ) : null}
            {required ? (
              <Text variant="caption" weight="semibold" color={colors.danger}>
                {" *"}
              </Text>
            ) : null}
          </View>
          {labelRight}
        </View>
      ) : null}

      <View
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
        ]}
      >
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <TextInput
          {...rest}
          multiline={multiline}
          secureTextEntry={secure}
          placeholderTextColor={colors.textFaint}
          autoCorrect={isPassword ? false : rest.autoCorrect}
          spellCheck={isPassword ? false : rest.spellCheck}
          textContentType={isPassword ? "password" : rest.textContentType}
          onChangeText={(text) => {
            if (ignoreNextEmpty.current && text === "") {
              ignoreNextEmpty.current = false;
              return;
            }
            rest.onChangeText?.(text);
          }}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            styles.input,
            // Custom fonts + secureTextEntry on Android can corrupt password input.
            isPassword && Platform.OS === "android" ? styles.inputPasswordAndroid : null,
            multiline && styles.inputMultiline,
            inputStyle,
          ]}
        />
        {isPassword ? (
          <Pressable
            onPress={() => {
              ignoreNextEmpty.current = true;
              setRevealed((v) => !v);
            }}
            hitSlop={layout.hitSlop}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            style={styles.trailing}
          >
            {revealed ? (
              <EyeOff size={18} color={colors.textMuted} />
            ) : (
              <Eye size={18} color={colors.textMuted} />
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text variant="micro" weight="medium" color={colors.dangerText} style={styles.helper}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="micro" color={colors.textMuted} style={styles.helper}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
};

/** Segmented single-choice control; used for role pickers and filters. */
export const OptionGroup = <T extends string>({
  label,
  options,
  value,
  onChange,
  /** `segment` matches web/shadcn TabsList (muted track, white active). */
  variant = "brand",
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  variant?: "brand" | "segment";
}) => (
  <View>
    {label ? (
      <Text
        variant="caption"
        weight="semibold"
        color={colors.textSecondary}
        style={{ marginBottom: 6 }}
      >
        {label}
      </Text>
    ) : null}
    <View style={styles.group}>
      {options.map((opt) => {
        const active = opt.value === value;
        const segment = variant === "segment";
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.groupItem,
              active && (segment ? styles.groupItemActiveSegment : styles.groupItemActive),
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text
              variant="caption"
              weight={active ? "semibold" : "medium"}
              color={
                active
                  ? segment
                    ? colors.text
                    : colors.white
                  : colors.textSecondary
              }
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: space.sm,
  },
  labelLeft: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
  },
  fieldMultiline: { minHeight: 120, alignItems: "flex-start", paddingVertical: space.md },
  fieldFocused: { borderColor: colors.brand, borderWidth: 1.5 },
  fieldError: { borderColor: colors.danger },
  icon: { marginRight: space.sm },
  trailing: { paddingLeft: space.sm },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.body.fontSize,
    paddingVertical: 12,
  },
  inputPasswordAndroid: {
    fontFamily: undefined,
  },
  inputMultiline: { textAlignVertical: "top", paddingTop: 0, minHeight: 96 },
  helper: { marginTop: 5 },
  group: {
    flexDirection: "row",
    backgroundColor: colors.gray100,
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  groupItem: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  groupItemActive: { backgroundColor: colors.brand },
  groupItemActiveSegment: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
