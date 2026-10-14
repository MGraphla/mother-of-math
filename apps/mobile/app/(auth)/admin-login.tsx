import { useState } from "react";
import { router } from "expo-router";
import { AuthShell } from "../../src/components/AuthShell";
import { Field, PrimaryButton, showError } from "../../src/components/ScreenKit";
import { supabase } from "../../src/lib/supabase";

export default function AdminLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <AuthShell title="Admin login" subtitle="Restricted access for platform administrators">
      <Field value={email} onChangeText={setEmail} placeholder="Admin email" autoCapitalize="none" keyboardType="email-address" />
      <Field value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" autoCapitalize="none" />
      <PrimaryButton
        label={loading ? "Checking…" : "Continue"}
        disabled={loading}
        onPress={async () => {
          setLoading(true);
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: email.trim().toLowerCase(),
              password,
            });
            if (error) throw error;
            const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
            if (profile?.role !== "admin") {
              await supabase.auth.signOut();
              throw new Error("This account is not an admin.");
            }
            router.replace("/(roles)/admin");
          } catch (e) {
            showError("Admin login failed", e);
          } finally {
            setLoading(false);
          }
        }}
      />
    </AuthShell>
  );
}
