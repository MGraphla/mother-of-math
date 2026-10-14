import { useRef } from "react";
import { StyleSheet, TextInput, View, type TextInput as TextInputType } from "react-native";
import { colors, fonts, radius } from "../theme/tokens";
import { Text } from "../ui";

export function OtpBoxes({
  value,
  onChange,
  length = 6,
  error,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  error?: boolean;
}) {
  const refs = useRef<Array<TextInputType | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const apply = (next: string) => {
    const cleaned = next.replace(/\D/g, "").slice(0, length);
    onChange(cleaned);
    const focusAt = Math.min(cleaned.length, length - 1);
    refs.current[focusAt]?.focus();
  };

  return (
    <View style={styles.row}>
      {digits.map((digit, i) => (
        <TextInput
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={digit}
          onChangeText={(raw) => {
            const incoming = raw.replace(/\D/g, "");
            if (incoming.length > 1) {
              apply((value.slice(0, i) + incoming).slice(0, length));
              return;
            }
            const next = value.split("");
            next[i] = incoming.slice(-1);
            apply(next.join(""));
          }}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key !== "Backspace" || digits[i]) return;
            const next = value.slice(0, Math.max(0, i - 1));
            onChange(next);
            refs.current[Math.max(0, i - 1)]?.focus();
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          caretHidden={!digit}
          style={[styles.box, error && styles.boxError, digit ? styles.boxFilled : null]}
        />
      ))}
    </View>
  );
}

export function PasswordStrength({ password }: { password: string }) {
  const score =
    password.length === 0
      ? 0
      : password.length < 8
        ? 1
        : /[A-Z]/.test(password) && /[0-9]/.test(password) && password.length >= 10
          ? 4
          : password.length >= 10
            ? 3
            : 2;
  const labels = ["", "Too short", "Fair", "Good", "Strong"];
  const tones = ["#E4E4E7", "#EF4444", "#F59E0B", "#84CC16", "#009E3F"];
  if (!password) return null;
  return (
    <View style={styles.strengthWrap}>
      <View style={styles.strengthRow}>
        {[1, 2, 3, 4].map((n) => (
          <View
            key={n}
            style={[
              styles.strengthBar,
              { backgroundColor: n <= score ? tones[score] : colors.gray200 },
            ]}
          />
        ))}
      </View>
      <Text variant="micro" weight="semibold" color={tones[score] ?? colors.textMuted}>
        {labels[score]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  box: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    textAlign: "center",
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  boxFilled: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  boxError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  strengthWrap: { gap: 6 },
  strengthRow: { flexDirection: "row", gap: 6 },
  strengthBar: { flex: 1, height: 6, borderRadius: 99 },
});
