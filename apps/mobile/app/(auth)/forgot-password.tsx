import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react-native";
import { AuthShell } from "../../src/components/AuthShell";
import { OtpBoxes, PasswordStrength } from "../../src/components/OtpBoxes";
import { needsProfileCompletion, useAuth } from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { getDashboardRouteByRole } from "../../src/coreAdapters/auth";
import { supabase } from "../../src/lib/supabase";
import { COUNTRIES, PHONE_RULES, toOptions, validatePhone } from "../../src/lib/profileOptions";
import {
  maskEmail,
  resendPasswordReset,
  setPasswordAfterReset,
  startPasswordResetByEmail,
  startPasswordResetByPhone,
  verifyPasswordResetCode,
  SignupVerificationError,
  type ResetTicket,
} from "../../src/services/passwordReset";
import { colors, layout, radius, space } from "../../src/theme/tokens";
import { Button, Input, OptionGroup, Select, Text } from "../../src/ui";

type Step = "start" | "missing" | "code" | "password" | "done";
type Method = "email" | "sms";

export default function ForgotPasswordScreen() {
  const { t } = useLanguage();
  const { signIn, refreshProfile } = useAuth();

  const [step, setStep] = useState<Step>("start");
  const [method, setMethod] = useState<Method>("email");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("Cameroon");
  const [phone, setPhone] = useState("");
  const [ticket, setTicket] = useState<ResetTicket | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (method === "email") {
      if (!trimmed) return setError(t("auth.error.fillAllRequired"));
      if (!/^\S+@\S+\.\S+$/.test(trimmed)) return setError(t("auth.error.invalidEmail"));
    } else {
      const phoneErr = validatePhone(phone, country);
      if (phoneErr) return setError(phoneErr);
    }

    setBusy(true);
    try {
      const next =
        method === "email"
          ? await startPasswordResetByEmail(trimmed)
          : await startPasswordResetByPhone(phone, country);
      if (method === "email") setEmail(trimmed);
      setTicket(next);
      setCode("");
      setStep("code");
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

  const handleVerifyCode = async (nextCode = code) => {
    const trimmed = nextCode.replace(/\D/g, "");
    if (!ticket || trimmed.length < 6 || verifying.current || busy) return;
    verifying.current = true;
    setError("");
    setBusy(true);
    try {
      await verifyPasswordResetCode(ticket, trimmed);
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
    if (!ticket || resendCooldown > 0) return;
    setBusy(true);
    setError("");
    try {
      await resendPasswordReset(ticket);
      setCode("");
      setResendCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.resetSendFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleSetPassword = async () => {
    setError("");
    if (!ticket) return;
    if (password.length < 8) return setError(t("auth.error.passwordLength"));
    if (password !== confirm) return setError(t("auth.error.passwordMismatch"));
    const trimmed = code.replace(/\D/g, "");
    if (trimmed.length < 6) {
      setStep("code");
      setError(t("auth.enterFullCode"));
      return;
    }

    setBusy(true);
    try {
      const accountEmail = await setPasswordAfterReset(ticket, trimmed, password);
      let profile = null;
      try {
        // Email resets already hold a session; SMS resets sign in with the new password.
        profile = ticket.channel === "sms" && accountEmail ? await signIn(accountEmail, password) : await refreshProfile();
      } catch {
        profile = await refreshProfile();
      }
      setStep("done");
      setTimeout(() => {
        void (async () => {
          const {
            data: { session: current },
          } = await supabase.auth.getSession();
          if (!current) {
            router.replace("/(auth)/sign-in");
            return;
          }
          if (needsProfileCompletion(current.user, profile)) {
            router.replace("/(auth)/complete-profile");
            return;
          }
          router.replace(getDashboardRouteByRole(profile) as never);
        })();
      }, 900);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("auth.resetUpdateFailed");
      if (/code|attempt|expired/i.test(msg)) {
        setStep("code");
        setCode("");
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (step === "missing") {
    return (
      <AuthShell
        title={t("auth.noAccountFound")}
        subtitle={method === "email" ? t("auth.noAccountFoundBody") : "No account uses this phone number."}
        onBack={() => {
          setError("");
          setStep("start");
        }}
        footer={
          <>
            <Button label={t("auth.createAccount")} onPress={goSignUp} size="lg" />
            <Pressable onPress={() => setStep("start")} hitSlop={layout.hitSlop} style={styles.linkTap}>
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
            {method === "email" ? email : phone}
          </Text>
        </View>
      </AuthShell>
    );
  }

  if (step === "code" && ticket) {
    return (
      <AuthShell
        title={t("auth.enterResetCode")}
        subtitle={ticket.channel === "email" ? t("auth.checkInbox") : "Check your text messages for a 6-digit code."}
        progress={{ step: 2, total: 3, label: t("auth.resetPassword") }}
        onBack={() => {
          setError("");
          setStep("start");
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
            {ticket.channel === "email" ? maskEmail(ticket.email) : ticket.maskedPhone}
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
      subtitle="We’ll send you a 6-digit code."
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
      <OptionGroup
        label="Send the code by"
        value={method}
        onChange={(m) => {
          setMethod(m);
          setError("");
        }}
        options={[
          { value: "email", label: "Email" },
          { value: "sms", label: "Text message" },
        ]}
      />
      {method === "email" ? (
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
      ) : (
        <>
          <Select label="Country" value={country} options={toOptions(COUNTRIES)} onChange={setCountry} required />
          <Input
            label="Phone number"
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              setError("");
            }}
            placeholder={PHONE_RULES[country]?.example ?? "+237 6XX XXX XXX"}
            keyboardType="phone-pad"
            autoComplete="tel"
            required
            returnKeyType="go"
            onSubmitEditing={handleSendCode}
          />
        </>
      )}
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
