import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { loginStudentByToken } from "../../../src/services/studentPortal";
import { colors } from "../../../src/theme/tokens";

export default function StudentAccessTokenScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!token) throw new Error("Missing token");
        await loginStudentByToken(token);
        setOk(true);
      } catch {
        setOk(false);
      } finally {
        setReady(true);
      }
    })();
  }, [token]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return <Redirect href={ok ? "/(roles)/student" : "/(auth)/student-login"} />;
}
