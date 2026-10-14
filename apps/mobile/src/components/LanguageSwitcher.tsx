import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { Languages } from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";
import { colors, layout, radius, space } from "../theme/tokens";
import { Text } from "../ui";

/**
 * EN/FR toggle. `onBrand` renders the variant that sits on the green sidebar,
 * matching the web's LanguageToggle inside DashboardSidebar.
 */
export const LanguageSwitcher = ({
  tone = "surface",
  showLabel = true,
  compact = false,
  style,
}: {
  tone?: "surface" | "onBrand";
  showLabel?: boolean;
  /** Short EN / FR chips for tight headers. */
  compact?: boolean;
  style?: ViewStyle;
}) => {
  const { language, setLanguage, t } = useLanguage();
  const onBrand = tone === "onBrand";

  return (
    <View style={[styles.wrap, style]}>
      {showLabel ? (
        <View style={styles.labelRow}>
          <Languages size={14} color={onBrand ? colors.onBrandFaint : colors.textMuted} />
          <Text
            variant="micro"
            weight="semibold"
            color={onBrand ? colors.onBrandFaint : colors.textMuted}
            uppercase
            style={styles.label}
          >
            {t("mobile.language")}
          </Text>
        </View>
      ) : null}

      <View style={[styles.row, onBrand ? styles.rowOnBrand : styles.rowSurface]}>
        {(["en", "fr"] as const).map((code) => {
          const active = language === code;
          return (
            <Pressable
              key={code}
              onPress={() => setLanguage(code)}
              hitSlop={layout.hitSlop}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                compact && styles.chipCompact,
                active && (onBrand ? styles.chipActiveOnBrand : styles.chipActiveSurface),
              ]}
            >
              <Text
                variant={compact ? "micro" : "caption"}
                weight={active ? "semibold" : "medium"}
                color={
                  onBrand
                    ? active
                      ? colors.brandDeep
                      : colors.onBrandMuted
                    : active
                      ? colors.brandDark
                      : colors.textSecondary
                }
              >
                {compact ? code.toUpperCase() : code === "en" ? "English" : "Français"}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  label: { letterSpacing: 1 },
  row: { flexDirection: "row", borderRadius: radius.md, padding: 3, gap: 3 },
  rowSurface: { backgroundColor: colors.gray100 },
  rowOnBrand: { backgroundColor: "rgba(0,0,0,0.14)" },
  chip: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  chipCompact: { minHeight: 30, paddingHorizontal: 8 },
  chipActiveSurface: { backgroundColor: colors.surface },
  chipActiveOnBrand: { backgroundColor: colors.white },
});
