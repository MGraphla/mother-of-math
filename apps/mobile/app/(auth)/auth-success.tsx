import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { getDashboardRouteByRole } from "../../src/coreAdapters/auth";

/** Mirrors web /auth-success after OAuth/signup confirmation. */
export default function AuthSuccessScreen() {
  const { loading, session, profile } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (session && profile) return <Redirect href={getDashboardRouteByRole(profile) as never} />;
  if (session) return <Redirect href="/(auth)/complete-profile" />;
  return <Redirect href="/(auth)/sign-in" />;
}
