import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, router } from "expo-router";
import { AuthShell } from "../../src/components/AuthShell";
import { needsProfileCompletion, useAuth } from "../../src/context/AuthContext";
import { getDashboardRouteByRole } from "../../src/coreAdapters/auth";
import { colors } from "../../src/theme/tokens";
import { Button, Text } from "../../src/ui";

/**
 * Landing route for motherofmath://auth/callback. AuthProvider exchanges the
 * code exactly once (deep-link listener / Google flow); this screen only waits
 * for the session and routes.
 */
export default function AuthCallbackScreen() {
  const { loading, profile, session, user } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 15_000);
    return () => clearTimeout(t);
  }, []);

  if (!loading && session) {
    if (needsProfileCompletion(user, profile)) return <Redirect href="/(auth)/complete-profile" />;
    return <Redirect href={getDashboardRouteByRole(profile) as never} />;
  }

  if (timedOut) {
    return (
      <AuthShell title="Sign-in didn't finish" subtitle="Please try again.">
        <Button label="Back to sign in" onPress={() => router.replace("/(auth)/sign-in")} size="lg" />
      </AuthShell>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, gap: 12 }}>
      <ActivityIndicator color={colors.brand} />
      <Text variant="caption" color={colors.textMuted}>
        Signing you in…
      </Text>
    </View>
  );
}
