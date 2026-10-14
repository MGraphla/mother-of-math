import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/context/AuthContext";
import { getDashboardRouteByRole } from "../src/coreAdapters/auth";
import { colors } from "../src/theme/tokens";

export default function Index() {
  const { loading, session, profile } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (session && profile) {
    return <Redirect href={getDashboardRouteByRole(profile) as never} />;
  }

  // Signed in but profile missing/incomplete — finish setup instead of bouncing to welcome.
  if (session && !profile) {
    return <Redirect href="/(auth)/complete-profile" />;
  }

  return <Redirect href="/(public)/welcome" />;
}
