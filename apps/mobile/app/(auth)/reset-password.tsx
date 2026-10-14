import { useState } from "react";
import { router } from "expo-router";
import { AuthShell } from "../../src/components/AuthShell";
import { Field, PrimaryButton, showError, showSuccess } from "../../src/components/ScreenKit";
import { supabase } from "../../src/lib/supabase";

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <AuthShell title="Set new password" subtitle="Choose a strong password for your account">
      <Field value={password} onChangeText={setPassword} secureTextEntry placeholder="New password" autoCapitalize="none" />
      <Field value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Confirm password" autoCapitalize="none" />
      <PrimaryButton
        label={submitting ? "Updating…" : "Update password"}
        disabled={submitting}
        onPress={async () => {
          if (password.length < 6 || password !== confirm) {
            showError("Invalid", new Error("Passwords must match and be at least 6 characters."));
            return;
          }
          setSubmitting(true);
          try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            showSuccess("Updated", "Password changed successfully.");
            router.replace("/(auth)/sign-in");
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
