import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { AuthShell } from "../../src/components/AuthShell";
import { Field, PrimaryButton, showError } from "../../src/components/ScreenKit";

const MONITOR_SESSION_KEY = "monitor_session";

export default function MonitorLoginScreen() {
  const [password, setPassword] = useState("");
  const expected = process.env.EXPO_PUBLIC_MONITOR_PASSWORD ?? "monitor";

  return (
    <AuthShell title="Partner monitor" subtitle="Read-only dashboard for implementing partners">
      <Field value={password} onChangeText={setPassword} secureTextEntry placeholder="Monitor password" autoCapitalize="none" />
      <PrimaryButton
        label="Enter monitor"
        onPress={async () => {
          if (password !== expected) {
            showError("Denied", new Error("Incorrect monitor password."));
            return;
          }
          await AsyncStorage.setItem(MONITOR_SESSION_KEY, "1");
          router.replace("/(roles)/monitor");
        }}
      />
    </AuthShell>
  );
}
