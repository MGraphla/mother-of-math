import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  Briefcase,
  Calendar,
  Globe,
  MapPin,
  Phone,
  School,
  User,
} from "lucide-react-native";
import { AuthShell } from "../../src/components/AuthShell";
import {
  needsProfileCompletion,
  useAuth,
  userHasGoogleIdentity,
} from "../../src/context/AuthContext";
import { getDashboardRouteByRole } from "../../src/coreAdapters/auth";
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
  optionalPhoneError,
  parseOptionalInt,
  toOptions,
  validatePhone,
} from "../../src/lib/profileOptions";
import { supabase } from "../../src/lib/supabase";
import { colors, radius, space } from "../../src/theme/tokens";
import { Button, Input, OptionGroup, Select, Text } from "../../src/ui";

const STEP_LABELS = ["Role & Personal", "School", "Contact"];

export default function CompleteProfileScreen() {
  const { user, profile, refreshProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [role, setRole] = useState<"teacher" | "parent">(
    profile?.role === "parent" ? "parent" : "teacher",
  );
  const [fullName, setFullName] = useState(
    profile?.full_name ?? (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : ""),
  );
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth ?? "");
  const [gender, setGender] = useState(profile?.gender ?? "");
  const [country, setCountry] = useState(profile?.country || "Cameroon");
  const [city, setCity] = useState(profile?.city ?? "");
  const [preferredLanguage, setPreferredLanguage] = useState(profile?.preferred_language || "English");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [schoolName, setSchoolName] = useState(profile?.school_name ?? "");
  const [schoolAddress, setSchoolAddress] = useState(profile?.school_address ?? "");
  const [schoolType, setSchoolType] = useState(profile?.school_type ?? "");
  const [numberOfStudents, setNumberOfStudents] = useState(
    profile?.number_of_students != null ? String(profile.number_of_students) : "",
  );
  const [numberOfClasses, setNumberOfClasses] = useState(
    profile?.number_of_classes != null ? String(profile.number_of_classes) : "",
  );
  const [subjectsTaught, setSubjectsTaught] = useState(profile?.subjects_taught ?? "");
  const [gradeLevels, setGradeLevels] = useState(profile?.grade_levels ?? "");
  const [yearsOfExperience, setYearsOfExperience] = useState(
    profile?.years_of_experience != null ? String(profile.years_of_experience) : "",
  );
  const [educationLevel, setEducationLevel] = useState(profile?.education_level ?? "");
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number ?? "");
  const [whatsappNumber, setWhatsappNumber] = useState(profile?.whatsapp_number ?? "");

  useEffect(() => {
    if (!user) {
      router.replace("/(auth)/sign-in");
      return;
    }
    if (profile?.role === "student") {
      router.replace(getDashboardRouteByRole(profile) as never);
      return;
    }
    if (profile && !submitting && !needsProfileCompletion(user, profile)) {
      router.replace(getDashboardRouteByRole(profile) as never);
    }
  }, [user, profile, submitting]);

  const googleNeedsWizard = useMemo(() => userHasGoogleIdentity(user), [user]);

  const validateStep = (): boolean => {
    setErrorMessage("");
    if (step === 1) {
      if (!fullName.trim()) {
        setErrorMessage("Full name is required.");
        return false;
      }
      if (!country) {
        setErrorMessage("Please select your country.");
        return false;
      }
    }
    if (step === 2 && role === "teacher" && !schoolName.trim()) {
      setErrorMessage("School name is required.");
      return false;
    }
    if (step === 3) {
      const phoneErr = validatePhone(phoneNumber, country);
      if (phoneErr) {
        setErrorMessage(phoneErr);
        return false;
      }
      const waErr = optionalPhoneError(whatsappNumber, country, "WhatsApp");
      if (waErr) {
        setErrorMessage(waErr);
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < 3) {
      setStep((s) => s + 1);
      return;
    }
    void handleSubmit();
  };

  const handleBack = () => {
    setErrorMessage("");
    if (step === 1) {
      if (router.canGoBack()) router.back();
      else router.replace("/(auth)/sign-in");
      return;
    }
    setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep() || !user) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email ?? "",
        full_name: fullName.trim(),
        role,
        date_of_birth: dateOfBirth.trim() || null,
        gender: gender || null,
        country: country || null,
        city: city.trim() || null,
        school_name: schoolName.trim() || null,
        school_address: schoolAddress.trim() || null,
        school_type: schoolType || null,
        number_of_students: parseOptionalInt(numberOfStudents),
        number_of_classes: parseOptionalInt(numberOfClasses),
        subjects_taught: subjectsTaught.trim() || null,
        grade_levels: gradeLevels || null,
        years_of_experience: parseOptionalInt(yearsOfExperience),
        education_level: educationLevel || null,
        phone_number: phoneNumber.trim() || null,
        whatsapp_number: whatsappNumber.trim() || null,
        bio: bio.trim() || null,
        preferred_language: preferredLanguage || null,
        google_extra_profile_completed: true,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      const next = await refreshProfile();
      router.replace(getDashboardRouteByRole(next ?? { role }) as never);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to save profile.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title={googleNeedsWizard ? "Complete your profile" : "Finish setup"}
      subtitle="A few details to set up your dashboard."
      progress={{ step, total: 3, label: STEP_LABELS[step - 1] }}
      onBack={handleBack}
      onStepPress={(s) => {
        setErrorMessage("");
        setStep(s);
      }}
      footer={
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
            label={step < 3 ? "Next" : submitting ? "Saving…" : "Save & continue"}
            onPress={handleNext}
            loading={submitting}
            fullWidth={false}
            style={styles.navPrimary}
          />
        </View>
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
            placeholder="Tell us about yourself and your teaching journey... (optional)"
            multiline
            icon={<Globe size={18} color={colors.brandDark} />}
          />
        </>
      ) : null}

      {step === 2 ? (
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

      {step === 3 ? (
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
          <Input
            label="WhatsApp number"
            value={whatsappNumber}
            onChangeText={setWhatsappNumber}
            placeholder={PHONE_RULES[country]?.example ?? "+237 6XX XXX XXX"}
            keyboardType="phone-pad"
            hint="Optional — used for important notifications."
          />
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
  errorBanner: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
});
