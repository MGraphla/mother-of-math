import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { needsGoogleExtraProfile, useAuth } from "../../src/context/AuthContext";
import { getDashboardRouteByRole } from "../../src/coreAdapters/auth";
import { supabase } from "../../src/lib/supabase";
import { colors } from "../../src/theme/tokens";

export default function AuthCallbackScreen() {
  const { profile, session, user } = useAuth();
  const params = useLocalSearchParams();

  useEffect(() => {
    (async () => {
      try {
        const url = await Linking.getInitialURL();
        if (url?.includes("code=")) {
          const code = new URL(url.replace("motherofmath://", "https://callback/")).searchParams.get(
            "code",
          );
          if (code) await supabase.auth.exchangeCodeForSession(code);
        } else if (typeof params.code === "string") {
          await supabase.auth.exchangeCodeForSession(params.code);
        }
      } catch (e) {
        console.warn("Auth callback error", e);
      }
    })();
  }, [params.code]);

  if (session && needsGoogleExtraProfile(user, profile)) {
    return <Redirect href="/(auth)/complete-profile" />;
  }

  if (session && profile) {
    return <Redirect href={getDashboardRouteByRole(profile) as never} />;
  }

  if (session && !profile) {
    return <Redirect href="/(auth)/complete-profile" />;
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.bg,
      }}
    >
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}
