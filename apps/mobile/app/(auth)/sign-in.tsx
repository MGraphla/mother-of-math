import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useNetworkState } from "expo-network";
import { Lock, Mail, Sparkles, WifiOff } from "lucide-react-native";
import { AuthDivider, AuthShell } from "../../src/components/AuthShell";
import { GoogleIcon } from "../../src/components/icons/GoogleIcon";
import { needsGoogleExtraProfile, useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { getDashboardRouteByRole } from "../../src/coreAdapters/auth";
import { supabase } from "../../src/lib/supabase";
import { colors, layout, radius, space } from "../../src/theme/tokens";
import { Button, Input, Text } from "../../src/ui";

export default function SignInScreen() {
  const { signIn, signInWithGoogle } = useAuth();
  const { t } = useLanguage();
  const network = useNetworkState();
  const offline =
    network.isInternetReachable === false ||
    (network.isConnected === false && network.type === "NONE");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const navigateAfterAuth = async (
    nextProfile: NonNullable<Awaited<ReturnType<typeof signIn>>>,
  ) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (needsGoogleExtraProfile(session?.user ?? null, nextProfile)) {
      router.replace("/(auth)/complete-profile");
      return;
    }
    router.replace(getDashboardRouteByRole(nextProfile) as never);
  };

  const handleSignIn = async () => {
    setErrorMessage("");
    if (!email.trim() || !password) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const nextProfile = await signIn(email.trim().toLowerCase(), password);
      if (!nextProfile) {
        router.replace("/(auth)/complete-profile");
        return;
      }
      await navigateAfterAuth(nextProfile);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Invalid email or password. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setErrorMessage("");
    setGoogleBusy(true);
    try {
      const nextProfile = await signInWithGoogle();
      // null = user cancelled the Google sheet — stay on this screen.
      if (!nextProfile) return;
      await navigateAfterAuth(nextProfile);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to sign in with Google.",
      );
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <AuthShell
      title={t("auth.welcomeBack")}
      subtitle={t("auth.signInContinue")}
      footer={
        <>
          <AuthDivider label={t("auth.orContinueWith")} />
          <Button
            label={t("auth.continueWithGoogle")}
            variant="outline"
            onPress={handleGoogle}
            loading={googleBusy}
            disabled={submitting}
            icon={<GoogleIcon size={18} />}
          />
          <Pressable
            onPress={() => router.push("/(auth)/student-login")}
            hitSlop={layout.hitSlop}
            style={styles.studentLink}
          >
            <Sparkles size={12} color={colors.textMuted} />
            <Text variant="caption" weight="medium" color={colors.textMuted} center>
              {t("mobile.studentEmailLogin")}
            </Text>
          </Pressable>
          <View style={styles.signUpRow}>
            <Text variant="caption" color={colors.textMuted}>
              {t("auth.dontHaveAccount")}{" "}
            </Text>
            <Pressable onPress={() => router.replace("/(auth)/sign-up")} hitSlop={layout.hitSlop}>
              <Text variant="caption" weight="bold" color={colors.brandDark}>
                {t("auth.signUpFree")}
              </Text>
            </Pressable>
          </View>
        </>
      }
    >
      {offline ? (
        <View style={styles.offlineBanner}>
          <WifiOff size={18} color={colors.amberText} />
          <Text variant="micro" color={colors.amberText} style={{ flex: 1 }}>
            No internet on this phone. Login needs mobile data or Wi‑Fi with internet.
          </Text>
        </View>
      ) : null}

      <Input
        label={t("auth.email")}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (errorMessage) setErrorMessage("");
        }}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        required
        icon={<Mail size={18} color={colors.brandDark} />}
      />
      <Input
        label={t("auth.password")}
        labelRight={
          <Pressable
            onPress={() => router.push("/(auth)/forgot-password")}
            hitSlop={layout.hitSlop}
          >
            <Text variant="micro" weight="semibold" color={colors.brandDark}>
              {t("auth.forgotPassword")}
            </Text>
          </Pressable>
        }
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (errorMessage) setErrorMessage("");
        }}
        placeholder="Enter your password"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
        textContentType="password"
        password
        required
        icon={<Lock size={18} color={colors.brandDark} />}
        returnKeyType="go"
        onSubmitEditing={handleSignIn}
      />

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text variant="caption" color={colors.dangerText}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      <Button
        label={submitting ? t("auth.signingIn") : t("auth.signIn")}
        onPress={handleSignIn}
        loading={submitting}
        disabled={googleBusy}
        size="lg"
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.amberSoft,
    borderWidth: 1,
    borderColor: colors.amberBorder,
    marginBottom: space.sm,
  },
  errorBanner: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  studentLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 38,
  },
  signUpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: layout.minTouch,
  },
});
