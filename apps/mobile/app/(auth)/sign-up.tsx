import { useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  Briefcase,
  Calendar,
  Check,
  Globe,
  Lock,
  Mail,
  MapPin,
  Phone,
  School,
  Send,
  Sparkles,
  User,
  Users,
} from "lucide-react-native";
import { AuthDivider, AuthShell } from "../../src/components/AuthShell";
import { GoogleIcon } from "../../src/components/icons/GoogleIcon";
import {
  storeVerifySession,
  needsProfileCompletion,
  useAuth,
  type SignUpProfileInput,
} from "../../src/context/AuthContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { getDashboardRouteByRole } from "../../src/coreAdapters/auth";
import { maskE164, normalizePhoneToE164 } from "../../src/lib/phone";
import {
  CLASS_COUNTS,
  COUNTRIES,
  EDUCATION_LEVELS,
  GENDERS,
  GRADE_LEVELS,
  LANGUAGES,
  PHONE_RULES,
  SCHOOL_TYPES,
  STUDENT_COUNTS,
  toOptions,
  validatePhone,
} from "../../src/lib/profileOptions";
import { supabase } from "../../src/lib/supabase";
import { colors, layout, radius, space } from "../../src/theme/tokens";
import { Button, Input, OptionGroup, Select, Text } from "../../src/ui";

type VerificationDelivery = "email" | "sms";

export default function SignUpScreen() {
  const { signUp, signUpWithPhoneVerification, signInWithGoogle } = useAuth();
  const { t } = useLanguage();

  const [step, setStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Step 1 — account
  const [role, setRole] = useState<"teacher" | "parent">("teacher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 2 — personal
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [country, setCountry] = useState("Cameroon");
  const [city, setCity] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [bio, setBio] = useState("");

  // Step 3 — school
  const [schoolName, setSchoolName] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [schoolType, setSchoolType] = useState("");
  const [numberOfStudents, setNumberOfStudents] = useState("");
  const [numberOfClasses, setNumberOfClasses] = useState("");
  const [subjectsTaught, setSubjectsTaught] = useState("");
  const [gradeLevels, setGradeLevels] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [educationLevel, setEducationLevel] = useState("");

  // Step 4 — contact
  const [phoneNumber, setPhoneNumber] = useState("");

  // Step 5 — verification channel
  const [verificationChannel, setVerificationChannel] =
    useState<VerificationDelivery>("email");

  const STEP_LABELS = useMemo(
    () => ["Account", "Personal", "School", "Contact", "Verify"],
    [],
  );

  const passwordStrengthColor =
    password.length >= 12
      ? colors.brand
      : password.length >= 8
        ? "#EAB308"
        : password.length > 0
          ? "#F87171"
          : colors.gray200;

  const validateStep = (): boolean => {
    setErrorMessage("");
    if (step === 1) {
      if (!email || !password || !confirmPassword) {
        setErrorMessage("Please fill in all required fields.");
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setErrorMessage("Please enter a valid email address.");
        return false;
      }
      if (password.length < 8) {
        setErrorMessage("Password must be at least 8 characters.");
        return false;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match.");
        return false;
      }
    }
    if (step === 2) {
      if (!fullName.trim()) {
        setErrorMessage("Full name is required.");
        return false;
      }
      if (!country) {
        setErrorMessage("Country is required.");
        return false;
      }
    }
    if (step === 3 && role === "teacher") {
      if (!schoolName.trim()) {
        setErrorMessage("School name is required.");
        return false;
      }
    }
    if (step === 4) {
      if (!phoneNumber.trim()) {
        setErrorMessage("Phone number is required.");
        return false;
      }
      const phoneErr = validatePhone(phoneNumber, country);
      if (phoneErr) {
        setErrorMessage(phoneErr);
        return false;
      }
    }
    return true;
  };

  const buildProfile = (): SignUpProfileInput => ({
    full_name: fullName.trim(),
    role,
    date_of_birth: dateOfBirth || null,
    gender: gender || null,
    country: country || null,
    city: city.trim() || null,
    school_name: schoolName.trim() || null,
    school_address: schoolAddress.trim() || null,
    school_type: schoolType || null,
    number_of_students: numberOfStudents ? parseInt(numberOfStudents, 10) : null,
    number_of_classes: numberOfClasses ? parseInt(numberOfClasses, 10) : null,
    subjects_taught: subjectsTaught.trim() || null,
    grade_levels: gradeLevels || null,
    years_of_experience: yearsOfExperience ? parseInt(yearsOfExperience, 10) : null,
    education_level: educationLevel || null,
    phone_number: phoneNumber.trim() || null,
    whatsapp_number: null,
    bio: bio.trim() || null,
    preferred_language: preferredLanguage || null,
  });

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    setErrorMessage("");
    const profilePayload = buildProfile();
    const cleanEmail = email.trim().toLowerCase();

    try {
      if (verificationChannel === "email") {
        const { needsVerification } = await signUp(cleanEmail, password, profilePayload);
        await storeVerifySession({ email: cleanEmail, channel: "email" });
        if (!needsVerification) {
          router.replace(getDashboardRouteByRole({ role }) as never);
          return;
        }
        router.replace({
          pathname: "/(auth)/verify-email",
          params: { email: cleanEmail, channel: "email" },
        });
        return;
      }

      const destinationRaw = phoneNumber.trim();
      const destE164 = normalizePhoneToE164(destinationRaw, country);
      await storeVerifySession({
        email: cleanEmail,
        channel: "sms",
        country,
        destE164,
      });
      await signUpWithPhoneVerification(
        cleanEmail,
        password,
        profilePayload,
        "sms",
        destinationRaw,
        country,
      );
      router.replace({
        pathname: "/(auth)/verify-email",
        params: {
          email: cleanEmail,
          channel: "sms",
          masked: maskE164(destE164),
        },
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create account.",
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (needsProfileCompletion(session?.user ?? null, nextProfile)) {
        router.replace("/(auth)/complete-profile");
        return;
      }
      router.replace(getDashboardRouteByRole(nextProfile) as never);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to sign in with Google.",
      );
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step === 5) return void handleSubmit();
    setStep((s) => Math.min(s + 1, 5));
  };

  const handleBack = () => {
    setErrorMessage("");
    if (step === 1) {
      if (router.canGoBack()) router.back();
      else router.replace("/(public)/welcome");
      return;
    }
    setStep((s) => s - 1);
  };

  const channelCard = (
    ch: VerificationDelivery,
    title: string,
    desc: string,
    icon: ReactNode,
  ) => {
    const active = verificationChannel === ch;
    return (
      <Pressable
        key={ch}
        onPress={() => setVerificationChannel(ch)}
        style={[styles.channelCard, active && styles.channelCardActive]}
      >
        <View style={[styles.channelIcon, active && styles.channelIconActive]}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Text variant="bodySm" weight="semibold">
            {title}
          </Text>
          <Text variant="micro" color={colors.textMuted} style={{ marginTop: 2 }}>
            {desc}
          </Text>
        </View>
        {active ? <Check size={16} color={colors.brand} /> : null}
      </Pressable>
    );
  };

  return (
    <AuthShell
      title={t("auth.createYourAccount")}
      subtitle={t("auth.joinEducators")}
      onBack={handleBack}
      progress={{ step, total: 5, label: STEP_LABELS[step - 1] }}
      onStepPress={(s) => {
        setErrorMessage("");
        setStep(s);
      }}
      footer={
        <>
          <View style={styles.navRow}>
            {step > 1 ? (
              <Button
                label="Back"
                variant="outline"
                onPress={handleBack}
                fullWidth={false}
                style={styles.navSide}
              />
            ) : (
              <View style={styles.navSide} />
            )}
            <Button
              label={
                step < 5
                  ? "Next"
                  : submitting
                    ? t("auth.signingUp")
                    : t("auth.createAccount")
              }
              onPress={handleNext}
              loading={submitting}
              disabled={googleBusy}
              fullWidth={false}
              style={styles.navPrimary}
            />
          </View>

          {step === 1 ? (
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
            </>
          ) : null}

          <View style={styles.signInRow}>
            <Text variant="caption" color={colors.textMuted}>
              {t("auth.alreadyHaveAccount")}{" "}
            </Text>
            <Pressable onPress={() => router.replace("/(auth)/sign-in")} hitSlop={layout.hitSlop}>
              <Text variant="caption" weight="bold" color={colors.brandDark}>
                {t("auth.signIn")}
              </Text>
            </Pressable>
          </View>
        </>
      }
    >
      {step === 1 ? (
        <>
          <OptionGroup
            label="I am a"
            value={role}
            onChange={setRole}
            options={[
              { value: "teacher", label: "Teacher" },
              { value: "parent", label: "Parent" },
            ]}
          />
          <Input
            label="Email address"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setErrorMessage("");
            }}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            required
            icon={<Mail size={18} color={colors.brandDark} />}
          />
          <View>
            <Input
              label="Password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setErrorMessage("");
              }}
              placeholder="Min. 8 characters"
              autoCapitalize="none"
              password
              required
              icon={<Lock size={18} color={colors.brandDark} />}
            />
            {password ? (
              <View style={styles.strengthRow}>
                {[1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor:
                          password.length >= i * 3 ? passwordStrengthColor : colors.gray200,
                      },
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </View>
          <Input
            label="Confirm password"
            value={confirmPassword}
            onChangeText={(v) => {
              setConfirmPassword(v);
              setErrorMessage("");
            }}
            placeholder="Re-enter your password"
            autoCapitalize="none"
            password
            required
            icon={<Lock size={18} color={colors.brandDark} />}
          />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Input
            label="Full name"
            value={fullName}
            onChangeText={(v) => {
              setFullName(v);
              setErrorMessage("");
            }}
            placeholder="e.g. Ngwa Emilia Tanyi"
            autoCapitalize="words"
            required
            icon={<User size={18} color={colors.brandDark} />}
          />
          <Input
            label="Date of birth"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            icon={<Calendar size={18} color={colors.brandDark} />}
            hint="Optional — use YYYY-MM-DD"
          />
          <Select
            label="Gender"
            value={gender}
            options={toOptions(GENDERS)}
            onChange={setGender}
            placeholder="Select"
          />
          <Select
            label="Language"
            value={preferredLanguage}
            options={toOptions(LANGUAGES)}
            onChange={setPreferredLanguage}
          />
          <Select
            label="Country"
            value={country}
            options={toOptions(COUNTRIES)}
            onChange={setCountry}
            required
          />
          <Input
            label="City / Town"
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Yaoundé"
            autoCapitalize="words"
            icon={<MapPin size={18} color={colors.brandDark} />}
          />
          <Input
            label="Short bio"
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us a little about yourself and your teaching journey... (optional)"
            multiline
            icon={<Globe size={18} color={colors.brandDark} />}
          />
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Input
            label="School name"
            value={schoolName}
            onChangeText={(v) => {
              setSchoolName(v);
              setErrorMessage("");
            }}
            placeholder="e.g. Government Bilingual High School"
            autoCapitalize="words"
            required={role === "teacher"}
            icon={<School size={18} color={colors.brandDark} />}
          />
          <Input
            label="School address / location"
            value={schoolAddress}
            onChangeText={setSchoolAddress}
            placeholder="e.g. Molyko, Buea"
            autoCapitalize="words"
            icon={<MapPin size={18} color={colors.brandDark} />}
          />
          <Select
            label="School type"
            value={schoolType}
            options={toOptions(SCHOOL_TYPES)}
            onChange={setSchoolType}
            placeholder="Select"
          />
          <Select
            label="No. of classes"
            value={numberOfClasses}
            options={CLASS_COUNTS}
            onChange={setNumberOfClasses}
            placeholder="Select..."
          />
          <Select
            label="No. of students"
            value={numberOfStudents}
            options={STUDENT_COUNTS}
            onChange={setNumberOfStudents}
            placeholder="Select..."
          />
          <Input
            label="Subjects taught"
            value={subjectsTaught}
            onChangeText={setSubjectsTaught}
            placeholder="e.g. Math, Science"
          />
          <Select
            label="Grade levels"
            value={gradeLevels}
            options={toOptions(GRADE_LEVELS)}
            onChange={setGradeLevels}
            placeholder="Select"
          />
          <Input
            label="Years of experience"
            value={yearsOfExperience}
            onChangeText={setYearsOfExperience}
            placeholder="e.g. 5"
            keyboardType="numeric"
            icon={<Briefcase size={18} color={colors.brandDark} />}
          />
          <Select
            label="Education level"
            value={educationLevel}
            options={toOptions(EDUCATION_LEVELS)}
            onChange={setEducationLevel}
            placeholder="Select"
          />
        </>
      ) : null}

      {step === 4 ? (
        <>
          <Input
            label="Mobile phone number"
            value={phoneNumber}
            onChangeText={(v) => {
              setPhoneNumber(v);
              setErrorMessage("");
            }}
            placeholder={PHONE_RULES[country]?.example ?? "+237 6XX XXX XXX"}
            keyboardType="phone-pad"
            required
            icon={<Phone size={18} color={colors.brandDark} />}
          />

          <View style={styles.summary}>
            <View style={styles.summaryTitle}>
              <Sparkles size={16} color={colors.brandDark} />
              <Text variant="caption" weight="semibold" color={colors.brandDark}>
                Account Summary
              </Text>
            </View>
            {(
              [
                ["Name", fullName || "—"],
                ["Email", email || "—"],
                ["Role", role],
                ["Country", country || "—"],
                ["School", schoolName || "—"],
                ["Phone", phoneNumber || "—"],
              ] as const
            ).map(([k, v]) => (
              <View key={k} style={styles.summaryRow}>
                <Text variant="micro" weight="semibold" color={colors.textSecondary}>
                  {k}
                </Text>
                <Text variant="micro" color={colors.textMuted} style={{ flex: 1, textAlign: "right" }}>
                  {v}
                </Text>
              </View>
            ))}
          </View>

          <Text variant="micro" color={colors.textMuted} center>
            By creating an account you agree to our Terms of Service and Privacy Policy.
          </Text>
        </>
      ) : null}

      {step === 5 ? (
        <>
          <Text variant="bodySm" color={colors.textSecondary}>
            Choose how you want to receive your one-time verification code to activate your
            account.
          </Text>
          {channelCard(
            "email",
            "Email",
            `We will send the code to ${email || "your email address"}.`,
            <Mail size={18} color={verificationChannel === "email" ? colors.white : colors.textSecondary} />,
          )}
          {channelCard(
            "sms",
            "Text message (SMS)",
            `Uses your mobile number: ${phoneNumber || "—"}.`,
            <Send size={18} color={verificationChannel === "sms" ? colors.white : colors.textSecondary} />,
          )}
          {verificationChannel === "sms" ? (
            <View style={styles.smsNote}>
              <Users size={14} color={colors.textMuted} />
              <Text variant="micro" color={colors.textMuted} style={{ flex: 1 }}>
                Standard message rates may apply. Your code will arrive within a few seconds.
              </Text>
            </View>
          ) : null}
        </>
      ) : null}

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text variant="caption" color={colors.dangerText}>
            {errorMessage}
          </Text>
        </View>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  navSide: { minWidth: 96 },
  navPrimary: { flex: 1 },
  signInRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: layout.minTouch,
  },
  strengthRow: { flexDirection: "row", gap: 4, marginTop: 8 },
  strengthBar: { flex: 1, height: 4, borderRadius: radius.full },
  summary: {
    borderRadius: radius.lg,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#D1FAE5",
    padding: space.md,
    gap: 6,
  },
  summaryTitle: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  channelCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  channelCardActive: {
    borderColor: colors.brand,
    backgroundColor: "#ECFDF5",
  },
  channelIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  channelIconActive: { backgroundColor: colors.brand },
  smsNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorBanner: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
});
