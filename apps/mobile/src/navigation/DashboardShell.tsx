import type { ReactNode } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Menu, Search } from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";
import { useDisplayIdentity } from "../hooks/useDisplayIdentity";
import { colors, fonts, layout, radius, space, typography } from "../theme/tokens";
import { Avatar, IconButton, SkeletonList, Text } from "../ui";
import { useDrawer } from "./DrawerContext";

export interface DashboardShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Replaces the hamburger with a back arrow, for pushed detail screens. */
  showBack?: boolean;
  scroll?: boolean;
  padded?: boolean;
  headerRight?: ReactNode;
  /** Renders the rounded search field the web header shows from `sm` up. */
  search?: {
    value: string;
    onChangeText: (v: string) => void;
    placeholder?: string;
  };
  /** Pinned action bar above the bottom safe area, for form screens. */
  footer?: ReactNode;
  /** Hides the avatar chip when a screen has its own header actions. */
  hideAvatar?: boolean;
  /**
   * Hides the sticky header title/subtitle when the screen renders its own
   * in-page hero (web parity — avoid a double title stack).
   */
  hideTitle?: boolean;
  /** Drops the trailing scroll gutter, for screens that fill the viewport. */
  fill?: boolean;
}

/**
 * The native equivalent of the web's DashboardLayout: a sticky white header with
 * the menu trigger on the left and identity on the right, over a tinted page body.
 */
export const DashboardShell = ({
  title,
  subtitle,
  children,
  loading,
  refreshing,
  onRefresh,
  showBack,
  scroll = true,
  padded = true,
  headerRight,
  search,
  footer,
  hideAvatar,
  hideTitle,
  fill,
}: DashboardShellProps) => {
  const { openDrawer, hasDrawer } = useDrawer();
  const identity = useDisplayIdentity();
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, layout.contentMaxWidth);
  // Routes outside a drawer (auth, admin, monitor, parent) need a way back instead.
  const useBack = showBack || !hasDrawer;
  const showAvatar = !hideAvatar && hasDrawer;

  const body = (
    <View style={[styles.body, { width: contentWidth }, padded && styles.bodyPadded]}>
      {loading ? <SkeletonList count={4} /> : children}
      {fill ? null : <View style={{ height: space.xxxl }} />}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          {useBack ? (
            <IconButton
              accessibilityLabel={t("common.back")}
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/(public)/welcome");
              }}
              tone="brand"
            >
              <ArrowLeft size={20} color={colors.brandDeep} />
            </IconButton>
          ) : (
            <IconButton accessibilityLabel={t("mobile.openMenu")} onPress={openDrawer} tone="brand">
              <Menu size={20} color={colors.brandDeep} />
            </IconButton>
          )}

          {hideTitle ? (
            <View style={styles.headerText} />
          ) : (
            <View style={styles.headerText}>
              <Text variant="h3" weight="bold" numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text variant="micro" color={colors.textMuted} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          )}

          {headerRight}
          {showAvatar ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("mobile.openMenu")}
              hitSlop={layout.hitSlop}
              onPress={openDrawer}
            >
              <Avatar name={identity.name} uri={identity.avatarUrl} size={36} />
            </Pressable>
          ) : null}
        </View>

        {search ? (
          <View style={styles.searchWrap}>
            <Search size={16} color={colors.gray400} />
            <TextInput
              value={search.value}
              onChangeText={search.onChangeText}
              placeholder={search.placeholder ?? t("mobile.searchPlaceholder")}
              placeholderTextColor={colors.gray400}
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
            />
          </View>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={layout.keyboardOffset}
      >
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.brand}
                  colors={[colors.brand]}
                />
              ) : undefined
            }
          >
            {body}
          </ScrollView>
        ) : (
          <View style={styles.flex}>{body}</View>
        )}

        {footer ? (
          <SafeAreaView edges={["bottom"]} style={styles.footer}>
            <View style={[styles.footerInner, { width: contentWidth }]}>{footer}</View>
          </SafeAreaView>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/** Centred spinner for gating states that shouldn't show a skeleton. */
export const ShellLoader = () => (
  <SafeAreaView style={[styles.safe, styles.center]}>
    <ActivityIndicator size="large" color={colors.brand} />
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colors.border,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: layout.headerHeight,
  },
  headerText: { flex: 1, minWidth: 0 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.gray100,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    height: 42,
    marginTop: space.xs,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: typography.bodySm.fontSize,
    paddingVertical: 0,
  },
  scrollContent: { flexGrow: 1 },
  body: { flexGrow: 1, alignSelf: "center" },
  bodyPadded: { padding: space.lg, gap: space.md },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: layout.hairline,
    borderTopColor: colors.border,
  },
  footerInner: { alignSelf: "center", padding: space.md, gap: space.sm },
});
