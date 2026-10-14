import { useState } from "react";
import { router } from "expo-router";
import { AuthShell } from "../../src/components/AuthShell";
import { Field, PrimaryButton, showError, showSuccess } from "../../src/components/ScreenKit";
import { supabase } from "../../src/lib/supabase";
import { needsProfileCompletion, useAuth } from "../../src/context/AuthContext";
import { getDashboardRouteByRole } from "../../src/coreAdapters/auth";

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user, refreshProfile } = useAuth();

  return (
    <AuthShell title="Set new password" subtitle="Choose a strong password for your account">
      <Field value={password} onChangeText={setPassword} secureTextEntry placeholder="New password" autoCapitalize="none" />
      <Field value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Confirm password" autoCapitalize="none" />
      <PrimaryButton
        label={submitting ? "Updating…" : "Update password"}
        disabled={submitting}
        onPress={async () => {
          if (password.length < 8 || password !== confirm) {
            showError("Invalid", new Error("Passwords must match and be at least 8 characters."));
            return;
          }
          if (!user) {
            showError("Link expired", new Error("Request a new code from Forgot password."));
            router.replace("/(auth)/forgot-password");
            return;
          }
          setSubmitting(true);
          try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            showSuccess("Updated", "Password changed successfully.");
            const next = await refreshProfile();
            router.replace(
              needsProfileCompletion(user, next)
                ? "/(auth)/complete-profile"
                : (getDashboardRouteByRole(next) as never),
            );
          } catch (e) {
            showError("Error", e);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </AuthShell>
  );
}
