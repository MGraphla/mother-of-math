import { router, useSegments } from "expo-router";
import { StyleSheet, View } from "react-native";
import { LayoutGrid } from "lucide-react-native";
import { useLanguage } from "../context/LanguageContext";
import { useDisplayIdentity } from "../hooks/useDisplayIdentity";
import { DashboardShell } from "../navigation/DashboardShell";
import { isDrawerRole, roleNav, type DrawerRole, type NavItem } from "../navigation/navConfig";
import { colors, radius, space } from "../theme/tokens";
import { Avatar, Card, IconTile, SectionHeader, Text } from "../ui";

/**
 * Landing page for the console roles (admin, monitor, parent). It mirrors the
 * drawer's own grouping as a tappable card grid, so every module is one tap from
 * here as well as from the sidebar.
 */
export const RoleHomeScreen = ({ roleTitle }: { roleTitle: string }) => {
  const { t } = useLanguage();
  const identity = useDisplayIdentity();
  const segments = useSegments();

  const roleSegment = segments.find((s) => isDrawerRole(s));
  const role: DrawerRole = isDrawerRole(roleSegment) ? roleSegment : "admin";
  const nav = roleNav[role];

  const label = (item: NavItem) => {
    const translated = t(item.labelKey);
    return translated === item.labelKey ? item.fallback : translated;
  };

  const groups = nav.groups
    .map((g) => ({
      title:
        g.labelKey && t(g.labelKey) !== g.labelKey ? t(g.labelKey) : (g.fallback ?? t("common.more")),
      items: g.items.filter((i) => i.href.replace("/(roles)", "") !== `/${role}`),
    }))
    .filter((g) => g.items.length > 0);

  const firstName = identity.name?.split(" ")[0];

  return (
    <DashboardShell title={roleTitle} subtitle={identity.email ?? undefined}>
      <View style={styles.banner}>
        <View style={styles.orb} />
        <Avatar name={identity.name} uri={identity.avatarUrl} size={52} tone="onBrand" letters={2} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h3" weight="extrabold" color={colors.white} numberOfLines={1}>
            {firstName ? `${t("dashboard.welcomeBack")}, ${firstName}` : t("dashboard.welcomeBack")}
          </Text>
          <Text variant="micro" color={colors.onBrandMuted} numberOfLines={1}>
            {roleTitle}
          </Text>
        </View>
      </View>

      {groups.map((group, gi) => (
        <View key={`${group.title}-${gi}`} style={gi > 0 ? { marginTop: space.md } : undefined}>
          <SectionHeader
            title={group.title}
            icon={<LayoutGrid size={16} color={colors.brand} />}
          />
          <View style={styles.grid}>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.href}
                  onPress={() => router.push(item.href as never)}
                  style={styles.tile}
                  elevation="xs"
                >
                  <IconTile size={40}>
                    <Icon size={19} color={colors.brandDeep} />
                  </IconTile>
                  <Text
                    variant="micro"
                    weight="semibold"
                    center
                    numberOfLines={2}
                    style={{ marginTop: space.sm }}
                  >
                    {label(item)}
                  </Text>
                </Card>
              );
            })}
          </View>
        </View>
      ))}
    </DashboardShell>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  tile: {
    flexGrow: 1,
    flexBasis: "29%",
    alignItems: "center",
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
  },
});
