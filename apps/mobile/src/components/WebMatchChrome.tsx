import type { ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Search } from "lucide-react-native";
import { colors, fonts, radius, space } from "../theme/tokens";
import { Text } from "../ui/Text";

/** Soft brand icon tile + title + subtitle — matches web page headers. */
export const PageHero = ({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) => (
  <View style={styles.hero}>
    <View style={styles.heroIcon}>{icon}</View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.heroTitle} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.heroSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {actions}
  </View>
);

/** Slim divided KPI strip used on web announcements (mobile breakpoint). */
export const SlimStatBar = ({
  items,
}: {
  items: { label: string; value: string | number }[];
}) => (
  <View style={styles.slimBar}>
    {items.map((item, i) => (
      <View
        key={item.label}
        style={[styles.slimCell, i > 0 && styles.slimCellBorder]}
      >
        <Text style={styles.slimLabel} numberOfLines={1}>
          {item.label}
        </Text>
        <Text style={styles.slimValue} numberOfLines={1}>
          {item.value}
        </Text>
      </View>
    ))}
  </View>
);

/** White bordered panel that wraps tabs/search + list body like web Card shell. */
export const Panel = ({
  toolbar,
  children,
}: {
  toolbar?: ReactNode;
  children: ReactNode;
}) => (
  <View style={styles.panel}>
    {toolbar ? <View style={styles.panelToolbar}>{toolbar}</View> : null}
    <View style={styles.panelBody}>{children}</View>
  </View>
);

/** Compact icon+value stat card used on web Resource Manager. */
export const MiniStatCard = ({
  icon,
  value,
  label,
  iconBg = colors.brandSoft,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
  iconBg?: string;
}) => (
  <View style={styles.miniStat}>
    <View style={[styles.miniStatIcon, { backgroundColor: iconBg }]}>{icon}</View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.miniStatValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.miniStatLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  </View>
);

/** Banner matching Generate Images daily limit. */
export const AmberBanner = ({
  children,
  variant = "amber",
}: {
  children: ReactNode;
  variant?: "amber" | "brand";
}) => (
  <View style={[styles.amberBanner, variant === "brand" && styles.brandBanner]}>
    {children}
  </View>
);

/** Soft primary tip card (Pro Tips / Sketch Ideas on web). */
export const TipCard = ({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
}) => (
  <View style={styles.tipCard}>
    <View style={styles.tipHeader}>
      {icon}
      <Text style={styles.tipTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

/** Search field used inside panel toolbars (web card toolbar). */
export const ToolbarSearch = ({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) => (
  <View style={styles.toolbarSearch}>
    <Search size={16} color={colors.gray400} />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.gray400}
      style={styles.toolbarSearchInput}
      returnKeyType="search"
      autoCorrect={false}
    />
  </View>
);

/** Dashed dropzone / sketch board chrome matching web upload & canvas frames. */
export const DashedZone = ({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: object;
}) => {
  const body = <View style={[styles.dashedZone, style]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  );
};

/** Selectable tile for aspect ratio / settings grids. */
export const SelectTile = ({
  selected,
  onPress,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
}) => (
  <Pressable
    onPress={onPress}
    style={[styles.selectTile, selected && styles.selectTileOn]}
    accessibilityRole="button"
  >
    {children}
  </Pressable>
);

/** Thin engagement / read-rate bar. */
export const MiniProgress = ({
  value,
  color = colors.brand,
}: {
  value: number;
  color?: string;
}) => (
  <View style={styles.progressTrack}>
    <View
      style={[
        styles.progressFill,
        {
          width: `${Math.max(0, Math.min(100, value))}%`,
          backgroundColor: color,
        },
      ]}
    />
  </View>
);

/**
 * Icon+label tab strip matching web Generate Images TabsList
 * (2×2 on narrow). Active = surface, not solid brand.
 */
export const SegmentIconTabs = <T extends string>({
  items,
  value,
  onChange,
  columns = 2,
}: {
  items: {
    value: T;
    label: string;
    icon?: (active: boolean) => ReactNode;
    badge?: number;
  }[];
  value: T;
  onChange: (v: T) => void;
  columns?: 2 | 4;
}) => (
  <View style={[styles.segTabs, columns === 4 && styles.segTabsRow]}>
    {items.map((item) => {
      const active = item.value === value;
      return (
        <Pressable
          key={item.value}
          onPress={() => onChange(item.value)}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          style={[
            styles.segTab,
            columns === 2 && styles.segTabHalf,
            active && styles.segTabOn,
          ]}
        >
          {item.icon?.(active)}
          <Text
            style={[styles.segTabLabel, active && styles.segTabLabelOn]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
          {typeof item.badge === "number" && item.badge > 0 ? (
            <View style={styles.segBadge}>
              <Text style={styles.segBadgeText}>{item.badge}</Text>
            </View>
          ) : null}
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginBottom: space.md,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 22,
    color: colors.text,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    marginTop: 2,
  },
  slimBar: {
    flexDirection: "row",
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bgSunken,
    marginBottom: space.md,
    overflow: "hidden",
  },
  slimCell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: "center",
  },
  slimCellBorder: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  slimLabel: {
    fontFamily: fonts.medium,
    fontSize: 9,
    lineHeight: 12,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  slimValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.text,
    marginTop: 1,
    fontVariant: ["tabular-nums"],
  },
  panel: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
    marginBottom: space.md,
  },
  panelToolbar: {
    padding: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgSunken,
    gap: space.sm,
  },
  panelBody: {
    backgroundColor: colors.surface,
  },
  miniStat: {
    flex: 1,
    minWidth: "46%",
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  miniStatIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  miniStatValue: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 24,
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  miniStatLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textMuted,
    marginTop: 1,
  },
  amberBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.amberSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.amberBorder,
    marginBottom: space.md,
  },
  brandBanner: {
    backgroundColor: colors.brandSoft,
    borderColor: "rgba(0,158,63,0.28)",
  },
  tipCard: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,158,63,0.2)",
    backgroundColor: colors.brandTint,
    gap: space.sm,
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  tipTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },
  toolbarSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    height: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  toolbarSearchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14,
    paddingVertical: 0,
  },
  dashedZone: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.sm,
    overflow: "hidden",
  },
  selectTile: {
    flex: 1,
    minWidth: "46%",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selectTileOn: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.gray200,
    overflow: "hidden",
    width: 64,
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.full,
  },
  segTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    marginBottom: space.md,
  },
  segTabsRow: {
    flexWrap: "nowrap",
  },
  segTab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  segTabHalf: {
    width: "48%",
    flexGrow: 1,
  },
  segTabOn: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segTabLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  segTabLabelOn: {
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  segBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  segBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 12,
    color: colors.white,
  },
});
