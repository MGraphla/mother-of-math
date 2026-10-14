import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, usePathname, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  Easing,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, LogOut } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useDisplayIdentity } from "../hooks/useDisplayIdentity";
import { clearStudentSession } from "../services/studentPortal";
import { colors, layout, radius, shadow, space } from "../theme/tokens";
import { Avatar, Text } from "../ui";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useDrawer } from "./DrawerContext";
import { isDrawerRole, roleLandingRoutes, roleNav, type NavItem } from "./navConfig";

const mamaMathLogo = require("../../assets/mama-math.png");
const OPEN_MS = 260;
const CLOSE_MS = 200;

/**
 * Slide-over port of the web dashboard sidebar. The web keeps it pinned on
 * desktop and behind a hamburger below `lg`; a phone only ever has the second
 * mode, so this renders that state with the same green surface and nav styling.
 */
export const AppDrawer = () => {
  const { open, closeDrawer } = useDrawer();
  const { t } = useLanguage();
  const { signOut } = useAuth();
  const identity = useDisplayIdentity();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const segments = useSegments();

  const width = layout.drawerWidth;
  const translateX = useRef(new Animated.Value(-width)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const roleSegment = segments.find((s) => isDrawerRole(s));
  const role = isDrawerRole(roleSegment) ? roleSegment : "teacher";
  const nav = roleNav[role];
  const pill = nav.activeStyle === "pill";

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: open ? 0 : -width,
        duration: open ? OPEN_MS : CLOSE_MS,
        easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: open ? 1 : 0,
        duration: open ? OPEN_MS : CLOSE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open, width, translateX, fade]);

  // Hardware back should dismiss the drawer before leaving the screen.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeDrawer();
      return true;
    });
    return () => sub.remove();
  }, [open, closeDrawer]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dx < -8 && Math.abs(g.dy) < 16,
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -50 || g.vx < -0.4) closeDrawer();
      },
    }),
  ).current;

  const label = (item: NavItem) => {
    const translated = t(item.labelKey);
    return translated === item.labelKey ? item.fallback : translated;
  };

  const isActive = (href: string) => {
    const target = href.replace("/(roles)", "");
    if (roleLandingRoutes.includes(target)) return pathname === target;
    return pathname === target || pathname.startsWith(`${target}/`);
  };

  const go = (href: string) => {
    closeDrawer();
    if (!isActive(href)) router.push(href as never);
  };

  const handleSignOut = () => {
    Alert.alert(t("mobile.signOutConfirm"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("nav.logout"),
        style: "destructive",
        onPress: async () => {
          closeDrawer();
          try {
            await clearStudentSession();
            await AsyncStorage.removeItem("monitor_session");
            await signOut();
          } catch {
            // Token-only learners have no Supabase session to end.
          }
          router.replace("/(public)/welcome");
        },
      },
    ]);
  };

  const displayName = identity.name ?? (role === "student" ? t("common.student") : t("nav.teacher"));
  const subtitle =
    nav.brandSubtitleKey && t(nav.brandSubtitleKey) !== nav.brandSubtitleKey
      ? t(nav.brandSubtitleKey)
      : (nav.brandSubtitleFallback ?? "");

  return (
    <View style={styles.root} pointerEvents={open ? "auto" : "none"}>
      <Animated.View style={[styles.scrim, { opacity: fade }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeDrawer}
          accessibilityRole="button"
          accessibilityLabel={t("mobile.closeMenu")}
        />
      </Animated.View>

      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.panel,
          shadow.drawer,
          { width, paddingTop: insets.top, transform: [{ translateX }] },
        ]}
      >
        <View style={[styles.brandRow, pill && styles.brandRowTall]}>
          <View style={styles.brandMark}>
            <Image
              source={mamaMathLogo}
              style={styles.brandLogo}
              resizeMode="cover"
              accessibilityLabel="Mama Math"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              variant={pill ? "h3" : "title"}
              weight="extrabold"
              color={colors.white}
              style={pill ? undefined : styles.wordmark}
              numberOfLines={1}
            >
              {nav.brandTitle}
            </Text>
            {subtitle ? (
              <Text
                variant="micro"
                weight="semibold"
                color={colors.onBrandFaint}
                uppercase
                style={styles.brandSubtitle}
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {nav.showProfileCard ? (
          <View style={styles.profileCard}>
            <Avatar name={displayName} uri={identity.avatarUrl} size={40} tone="onBrand" letters={2} />
            <View style={styles.profileText}>
              <Text variant="caption" weight="semibold" color={colors.white} numberOfLines={1}>
                {displayName}
              </Text>
              <Text variant="micro" color={colors.onBrandFaint} numberOfLines={1}>
                {identity.email ?? t("student.portal")}
              </Text>
            </View>
          </View>
        ) : null}

        <ScrollView
          style={styles.navScroll}
          contentContainerStyle={styles.navContent}
          showsVerticalScrollIndicator={false}
        >
          {nav.groups.map((group, gi) => {
            const groupLabel =
              group.labelKey && t(group.labelKey) !== group.labelKey
                ? t(group.labelKey)
                : group.fallback;
            return (
              <View key={`group-${gi}`} style={gi > 0 ? styles.groupSpaced : undefined}>
                {groupLabel ? (
                  <Text
                    variant="micro"
                    weight="semibold"
                    color={colors.onBrandFaint}
                    uppercase
                    style={styles.groupLabel}
                  >
                    {groupLabel}
                  </Text>
                ) : null}
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  const activePill = active && pill;
                  const fg = activePill ? colors.brandDeep : colors.white;
                  return (
                    <Pressable
                      key={item.href}
                      onPress={() => go(item.href)}
                      accessibilityRole="link"
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => [
                        styles.navItem,
                        pill ? styles.navItemPillShape : styles.navItemOverlayShape,
                        activePill && styles.navItemActivePill,
                        active && !pill && styles.navItemActiveOverlay,
                        pressed && !active && styles.navItemPressed,
                      ]}
                    >
                      <Icon size={20} color={fg} strokeWidth={active ? 2.4 : 2} />
                      <Text
                        variant="bodySm"
                        weight={active ? "semibold" : "medium"}
                        color={activePill ? colors.brandDeep : active ? colors.white : colors.onBrandMuted}
                        style={styles.navLabel}
                        numberOfLines={1}
                      >
                        {label(item)}
                      </Text>
                      {active ? (
                        <ChevronRight
                          size={14}
                          color={activePill ? colors.brandDeep : colors.white}
                          opacity={0.6}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(space.md, insets.bottom) }]}>
          <LanguageSwitcher tone="onBrand" />

          {!nav.showProfileCard ? (
            <View style={styles.footerProfile}>
              <Avatar name={displayName} uri={identity.avatarUrl} size={38} tone="onBrand" />
              <View style={styles.profileText}>
                <Text variant="caption" weight="semibold" color={colors.white} numberOfLines={1}>
                  {displayName.split(" ")[0]}
                </Text>
                <Text variant="micro" color={colors.onBrandFaint} numberOfLines={1}>
                  {identity.email ?? ""}
                </Text>
              </View>
            </View>
          ) : null}

          <Pressable
            onPress={handleSignOut}
            accessibilityRole="button"
            style={({ pressed }) => [styles.logout, pressed && styles.navItemPressed]}
          >
            <LogOut size={20} color={colors.white} />
            <Text variant="bodySm" weight="medium" color={colors.white} style={styles.navLabel}>
              {t("nav.logout")}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

const FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;

const styles = StyleSheet.create({
  root: { ...FILL, zIndex: 50 },
  scrim: { ...FILL, backgroundColor: colors.overlay },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.brand,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    height: 64,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.onBrandBorder,
  },
  brandRowTall: { height: 80 },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  brandLogo: {
    width: "100%",
    height: "100%",
  },
  wordmark: { letterSpacing: 2 },
  brandSubtitle: { marginTop: 2, letterSpacing: 1.4 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginHorizontal: space.md,
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.onBrandBorder,
    backgroundColor: colors.onBrandHover,
  },
  profileText: { flex: 1, minWidth: 0 },
  navScroll: { flex: 1 },
  navContent: { paddingHorizontal: space.md, paddingVertical: space.md },
  groupSpaced: { marginTop: space.lg },
  groupLabel: { marginBottom: space.sm, marginLeft: space.sm, letterSpacing: 1.2 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: layout.minTouch,
    height: 48,
    paddingHorizontal: space.md,
    gap: space.md,
    marginBottom: 4,
  },
  navItemOverlayShape: { borderRadius: radius.sm },
  navItemPillShape: { borderRadius: radius.md },
  navItemActiveOverlay: { backgroundColor: colors.onBrandActive },
  navItemActivePill: { backgroundColor: colors.white, ...shadow.xs },
  navItemPressed: { backgroundColor: colors.onBrandHover },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.onBrandBorder,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    gap: space.sm,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  footerProfile: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: layout.minTouch,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  navLabel: { flex: 1 },
});
