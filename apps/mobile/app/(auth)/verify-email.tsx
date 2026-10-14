import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle2, Mail, Send } from "lucide-react-native";
import { AuthShell } from "../../src/components/AuthShell";
import {
  clearVerifySession,
  readVerifySession,
  useAuth,
} from "../../src/context/AuthContext";
import { getDashboardRouteByRole } from "../../src/coreAdapters/auth";
import { maskE164 } from "../../src/lib/phone";
import { colors, layout, radius, space } from "../../src/theme/tokens";
import { Button, Input, Text } from "../../src/ui";

type VerificationChannel = "email" | "sms";

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{
    email?: string;
    channel?: string;
    password?: string;
    masked?: string;
  }>();
  const {
    verifySignupOtp,
    verifySignupPhoneOtp,
    resendSignupOtp,
    resendSignupPhoneOtp,
    profile,
  } = useAuth();

  const [email, setEmail] = useState(params.email ?? "");
  const [channel, setChannel] = useState<VerificationChannel>(
    params.channel === "sms" ? "sms" : "email",
  );
  const [masked, setMasked] = useState(params.masked ?? "");
  const [country, setCountry] = useState("Cameroon");
  const [destE164, setDestE164] = useState("");
  const [token, setToken] = useState("");
  const [loginPassword, setLoginPassword] = useState(params.password ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readVerifySession();
      if (cancelled) return;
      const nextEmail = (params.email || stored.email || "").trim();
      if (!nextEmail) {
        router.replace("/(auth)/sign-up");
        return;
      }
      setEmail(nextEmail);
      setChannel(
        params.channel === "sms" || stored.channel === "sms" ? "sms" : "email",
      );
      setCountry(stored.country || "Cameroon");
      setDestE164(stored.destE164 || "");
      if (!params.masked && stored.destE164) {
        setMasked(maskE164(stored.destE164));
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [params.channel, params.email, params.masked]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const headline = channel === "email" ? "Check your email" : "Check your text messages";
  const subline =
    channel === "email"
      ? "We sent a verification code to"
      : "We sent a verification code via SMS to";
  const destinationLabel = channel === "email" ? email : masked || email;

  const handleVerify = async () => {
    const trimmed = token.trim();
    if (trimmed.length < 6) {
      setError("Please enter your verification code.");
      return;
    }
    if (channel !== "email" && !loginPassword) {
      setError("Enter the password you used when creating your account to finish signing in.");
      return;
    }

    setVerifying(true);
    setError("");
    try {
      const nextProfile =
        channel === "email"
          ? await verifySignupOtp(email, trimmed)
          : await verifySignupPhoneOtp(email, trimmed, loginPassword);

      setSuccess(true);
      await clearVerifySession();

      setTimeout(() => {
        router.replace(
          getDashboardRouteByRole(nextProfile ?? profile ?? { role: "teacher" }) as never,
        );
      }, 1400);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid or expired code. Please try again.",
      );
      setToken("");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    setError("");
    try {
      if (channel === "email") {
        await resendSignupOtp(email);
      } else {
        if (!destE164) {
          throw new Error("Missing phone destination. Go back to sign-up and try again.");
        }
        await resendSignupPhoneOtp(email, "sms", destE164, country);
      }
      setResendCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  if (!ready) {
    return (
      <AuthShell title="Verify account" subtitle="Loading…">
        <Text variant="bodySm" color={colors.textMuted} center>
          Preparing verification…
        </Text>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell title="You're verified" subtitle="Redirecting to your dashboard…">
        <View style={styles.successBox}>
          <CheckCircle2 size={48} color={colors.brand} />
          <Text variant="body" weight="semibold" center>
            Account verified successfully
          </Text>
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={headline}
      subtitle={`${subline} ${destinationLabel}`}
      onBack={() => router.replace("/(auth)/sign-up")}
      footer={
        <>
          <Button
            label={verifying ? "Verifying…" : "Verify account"}
            onPress={handleVerify}
            loading={verifying}
            size="lg"
          />
          <Pressable
            onPress={handleResend}
            disabled={resending || resendCooldown > 0}
            hitSlop={layout.hitSlop}
            style={styles.linkTap}
          >
            <Text variant="caption" weight="semibold" color={colors.brandDark} center>
              {resending
                ? "Sending…"
                : resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : "Resend code"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(auth)/sign-up")}
            hitSlop={layout.hitSlop}
            style={styles.linkTap}
          >
            <Text variant="caption" color={colors.textMuted} center>
              Back to sign-up
            </Text>
          </Pressable>
        </>
      }
    >
      <View style={styles.iconWrap}>
        {channel === "email" ? (
          <Mail size={28} color={colors.white} />
        ) : (
          <Send size={28} color={colors.white} />
        )}
      </View>

      <Input
        label="Verification code"
        value={token}
        onChangeText={(v) => {
          setToken(v.replace(/\D/g, "").slice(0, 8));
          setError("");
        }}
        placeholder="Enter code"
        keyboardType="numeric"
        autoComplete="one-time-code"
        required
        inputStyle={styles.otpInput}
        hint={
          channel === "email"
            ? "Paste the full code from your email"
            : "Enter the code from your SMS"
        }
      />

      {channel === "sms" ? (
        <Input
          label="Password"
          value={loginPassword}
          onChangeText={(v) => {
            setLoginPassword(v);
            setError("");
          }}
          placeholder="Same password as on sign-up"
          password
          required
        />
      ) : null}

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
  otpInput: { letterSpacing: 6, textAlign: "center", fontSize: 22 },
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
