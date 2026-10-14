import { Redirect, Stack, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../src/context/AuthContext";
import { getDashboardRouteByRole } from "../../src/coreAdapters/auth";
import { AppDrawer } from "../../src/navigation/AppDrawer";
import { DrawerProvider } from "../../src/navigation/DrawerContext";
import { isDrawerRole } from "../../src/navigation/navConfig";
import { getStudentSession } from "../../src/services/studentPortal";
import { colors } from "../../src/theme/tokens";

export default function RolesLayout() {
  const { loading, session, profile } = useAuth();
  const segments = useSegments();
  const [gateLoading, setGateLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (loading) return;

      const roleSegment = segments.find((s) => isDrawerRole(s));

      // Monitor uses local password session (no Supabase user required).
      if (roleSegment === "monitor") {
        const monitor = await AsyncStorage.getItem("monitor_session");
        setAllowed(monitor === "1");
        setRedirectTo(monitor === "1" ? null : "/(auth)/monitor-login");
        setGateLoading(false);
        return;
      }

      // Student portal: auth session with student role OR token session.
      if (roleSegment === "student") {
        if (session && profile?.role === "student") {
          setAllowed(true);
          setRedirectTo(null);
          setGateLoading(false);
          return;
        }
        const student = await getStudentSession();
        if (student) {
          setAllowed(true);
          setRedirectTo(null);
        } else if (session && profile) {
          // Wrong role trying to open student area
          setAllowed(false);
          setRedirectTo(getDashboardRouteByRole(profile));
        } else {
          setAllowed(false);
          setRedirectTo("/(auth)/student-login");
        }
        setGateLoading(false);
        return;
      }

      if (!session) {
        setAllowed(false);
        if (roleSegment === "admin") setRedirectTo("/(auth)/admin-login");
        else setRedirectTo("/(auth)/sign-in");
        setGateLoading(false);
        return;
      }

      if (!profile) {
        setAllowed(false);
        setRedirectTo("/(auth)/complete-profile");
        setGateLoading(false);
        return;
      }

      if (roleSegment && profile.role !== roleSegment) {
        setAllowed(false);
        setRedirectTo(getDashboardRouteByRole(profile));
        setGateLoading(false);
        return;
      }

      setAllowed(true);
      setRedirectTo(null);
      setGateLoading(false);
    })();
  }, [loading, session, profile, segments]);

  if (loading || gateLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!allowed) {
    return <Redirect href={(redirectTo ?? "/(auth)/sign-in") as never} />;
  }

  const stack = <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />;

  // Each role area shares one drawer instance so it slides over the whole stack,
  // the way the web sidebar sits above the routed page.
  const roleSegment = segments.find((s) => isDrawerRole(s));
  if (!isDrawerRole(roleSegment)) return stack;

  return (
    <DrawerProvider>
      <View style={{ flex: 1 }}>
        {stack}
        <AppDrawer />
      </View>
    </DrawerProvider>
  );
}
