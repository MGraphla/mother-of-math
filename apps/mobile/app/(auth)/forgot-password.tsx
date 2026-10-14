import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react-native";
import { AuthShell } from "../../src/components/AuthShell";
import { OtpBoxes, PasswordStrength } from "../../src/components/OtpBoxes";
import { isProfileComplete, needsGoogleExtraProfile, useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { getDashboardRouteByRole } from "../../src/coreAdapters/auth";
import { supabase } from "../../src/lib/supabase";
import {
  maskEmail,
  resendPasswordResetByEmail,
  setPasswordAfterReset,
  startPasswordResetByEmail,
  verifyPasswordResetCode,
  SignupVerificationError,
  type PasswordResetDelivery,
} from "../../src/services/passwordReset";
import { colors, layout, radius, space } from "../../src/theme/tokens";
import { Button, Input, Text } from "../../src/ui";

type Step = "email" | "missing" | "code" | "password" | "done";

export default function ForgotPasswordScreen() {
  const { t } = useLanguage();
  const { signIn, refreshProfile } = useAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [delivery, setDelivery] = useState<PasswordResetDelivery>("challenge");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const verifying = useRef(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const goSignUp = () => router.replace("/(auth)/sign-up");

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    setError("");
    if (!trimmed) {
      setError(t("auth.error.fillAllRequired"));
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError(t("auth.error.invalidEmail"));
      return;
    }

    setBusy(true);
    try {
      const result = await startPasswordResetByEmail(trimmed);
      setEmail(trimmed);
      setDelivery(result.delivery);
      setCode("");
      setStep("code");
      setResendCooldown(60);
    } catch (err) {
      if (err instanceof SignupVerificationError && err.notRegistered) {
        setEmail(trimmed);
        setStep("missing");
        return;
      }
      setError(err instanceof Error ? err.message : t("auth.resetSendFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async (nextCode = code) => {
    const trimmed = nextCode.replace(/\D/g, "");
    if (trimmed.length < 6 || verifying.current || busy) return;
    verifying.current = true;
    setError("");
    setBusy(true);
    try {
      await verifyPasswordResetCode(email, trimmed, delivery);
      setCode(trimmed);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.invalidCode"));
      setCode("");
    } finally {
      verifying.current = false;
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setBusy(true);
    setError("");
    try {
      const nextDelivery = await resendPasswordResetByEmail(email);
      setDelivery(nextDelivery);
      setCode("");
      setResendCooldown(60);
    } catch (err) {
      if (err instanceof SignupVerificationError && err.notRegistered) {
        setStep("missing");
        return;
      }
      setError(err instanceof Error ? err.message : t("auth.resetSendFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleSetPassword = async () => {
    setError("");
    if (password.length < 8) {
      setError(t("auth.error.passwordLength"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.error.passwordMismatch"));
      return;
    }
    const trimmed = code.replace(/\D/g, "");
    if (trimmed.length < 6) {
      setStep("code");
      setError(t("auth.enterFullCode"));
      return;
    }

    setBusy(true);
    try {
      await setPasswordAfterReset(email, trimmed, password, delivery);
      let profile = null;
      try {
        profile = await signIn(email, password);
      } catch {
        profile = await refreshProfile();
      }
      setStep("done");
      setTimeout(() => {
        void (async () => {
          if (!profile) {
            router.replace("/(auth)/complete-profile");
            return;
          }
          const {
            data: { session: current },
          } = await supabase.auth.getSession();
          if (needsGoogleExtraProfile(current?.user ?? null, profile) || !isProfileComplete(profile)) {
            router.replace("/(auth)/complete-profile");
            return;
          }
          router.replace(getDashboardRouteByRole(profile) as never);
        })();
      }, 1100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("auth.resetUpdateFailed");
      if (/code|attempt|expired/i.test(msg)) {
        setStep("code");
        setCode("");
        setError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  if (step === "missing") {
    return (
      <AuthShell
        title={t("auth.noAccountFound")}
        subtitle={t("auth.noAccountFoundBody")}
        onBack={() => {
          setError("");
          setStep("email");
        }}
        footer={
          <>
            <Button label={t("auth.createAccount")} onPress={goSignUp} size="lg" />
            <Pressable onPress={() => setStep("email")} hitSlop={layout.hitSlop} style={styles.linkTap}>
              <Text variant="caption" color={colors.textMuted} center>
                {t("auth.tryAnotherEmail")}
              </Text>
            </Pressable>
          </>
        }
      >
        <View style={styles.iconWrap}>
          <Mail size={28} color={colors.white} />
        </View>
        <View style={styles.emailChip}>
          <Text variant="bodySm" weight="semibold" color={colors.brandDeep} center>
            {email}
          </Text>
        </View>
      </AuthShell>
    );
  }

  if (step === "code") {
    return (
      <AuthShell
        title={t("auth.enterResetCode")}
        subtitle={t("auth.checkInbox")}
        progress={{ step: 2, total: 3, label: t("auth.resetPassword") }}
        onBack={() => {
          setError("");
          setStep("email");
        }}
        footer={
          <>
            <Button
              label={busy ? t("auth.verifyingCode") : t("auth.verifyCode")}
              onPress={() => void handleVerifyCode()}
              loading={busy}
              disabled={code.length < 6}
              size="lg"
            />
            <Pressable
              onPress={handleResend}
              disabled={busy || resendCooldown > 0}
              hitSlop={layout.hitSlop}
              style={styles.linkTap}
            >
              <Text variant="caption" weight="semibold" color={colors.brandDark} center>
                {resendCooldown > 0
                  ? t("auth.resendCodeIn").replace("{seconds}", String(resendCooldown))
                  : t("auth.resendCode")}
              </Text>
            </Pressable>
          </>
        }
      >
        <View style={styles.iconWrap}>
          <ShieldCheck size={28} color={colors.white} />
        </View>
        <Text variant="bodySm" color={colors.textMuted} center>
          {t("auth.enterResetCodeHint")}{" "}
          <Text variant="bodySm" weight="bold" color={colors.text}>
            {maskEmail(email)}
          </Text>
        </Text>
        <OtpBoxes
          value={code}
          error={!!error}
          onChange={(next) => {
            setCode(next);
            setError("");
            if (next.length === 6) void handleVerifyCode(next);
          }}
        />
        <Text variant="micro" color={colors.textMuted} center>
          {t("auth.pasteCodeHint")}
        </Text>
        {error ? (
          <View style={styles.errorBanner}>
            <Text variant="caption" color={colors.dangerText}>
              {error}
            </Text>
          </View>
        ) : null}
      </AuthShell>
    );
  }

  if (step === "password") {
    return (
      <AuthShell
        title={t("auth.newPasswordTitle")}
        subtitle={t("auth.newPasswordSubtitle")}
        progress={{ step: 3, total: 3, label: t("auth.resetPassword") }}
        onBack={() => {
          setError("");
          setStep("code");
        }}
        footer={
          <Button
            label={busy ? t("auth.updatingPassword") : t("auth.updatePassword")}
            onPress={handleSetPassword}
            loading={busy}
            size="lg"
          />
        }
      >
        <View style={styles.iconWrap}>
          <KeyRound size={28} color={colors.white} />
        </View>
        <Input
          label={t("auth.newPasswordPlaceholder")}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError("");
          }}
          placeholder={t("auth.newPasswordPlaceholder")}
          password
          required
        />
        <PasswordStrength password={password} />
        <Input
          label={t("auth.confirmPassword")}
          value={confirm}
          onChangeText={(v) => {
            setConfirm(v);
            setError("");
          }}
          placeholder={t("auth.confirmPassword")}
          password
          required
          returnKeyType="go"
          onSubmitEditing={handleSetPassword}
        />
        {error ? (
          <View style={styles.errorBanner}>
            <Text variant="caption" color={colors.dangerText}>
              {error}
            </Text>
          </View>
        ) : null}
      </AuthShell>
    );
  }

  if (step === "done") {
    return (
      <AuthShell title={t("auth.passwordUpdated")} subtitle={t("auth.redirectingDashboard")}>
        <View style={styles.successBox}>
          <CheckCircle2 size={48} color={colors.brand} />
          <Text variant="body" weight="semibold" center>
            {t("auth.passwordUpdatedBody")}
          </Text>
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("auth.resetPassword")}
      subtitle={t("auth.forgotSubtitle")}
      progress={{ step: 1, total: 3, label: t("auth.resetPassword") }}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(auth)/sign-in");
      }}
      footer={
        <Button
          label={busy ? t("auth.sendingCode") : t("auth.sendCode")}
          onPress={handleSendCode}
          loading={busy}
          size="lg"
        />
      }
    >
      <View style={styles.iconWrap}>
        <Mail size={28} color={colors.white} />
      </View>
      <Input
        label={t("auth.email")}
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setError("");
        }}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        required
        icon={<Mail size={18} color={colors.brandDark} />}
        returnKeyType="go"
        onSubmitEditing={handleSendCode}
      />
      <Text variant="micro" color={colors.textMuted}>
        {t("auth.forgotSecurityNote")}
      </Text>
      {error ? (
        <View style={styles.errorBanner}>
          <Text variant="caption" color={colors.dangerText}>
            {error}
          </Text>
        </View>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  emailChip: {
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.brandTint,
  },
  linkTap: { minHeight: layout.minTouch, justifyContent: "center" },
  errorBanner: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  successBox: {
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.xl,
  },
});
