import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import {
  AlertTriangle,
  Bell,
  Camera,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  Save,
  School,
  Shield,
  Trash2,
  UserCircle,
} from "lucide-react-native";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { PasswordStrength } from "./OtpBoxes";
import {
  useAuth,
  type Profile,
  type UserRole,
} from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { resolveAvatarUrl } from "../lib/avatar";
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
} from "../lib/profileOptions";
import { supabase } from "../lib/supabase";
import { DashboardShell } from "../navigation/DashboardShell";
import { clearStudentSession } from "../services/studentPortal";
import { colors, radius, space } from "../theme/tokens";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  IconTile,
  Input,
  Select,
  Text,
  Toggle,
  showError,
  showSuccess,
} from "../ui";

export type SettingsAudience = "teacher" | "student";

type FormState = {
  full_name: string;
  date_of_birth: string;
  gender: string;
  country: string;
  city: string;
  preferred_language: string;
  bio: string;
  school_name: string;
  school_address: string;
  school_type: string;
  number_of_students: string;
  number_of_classes: string;
  subjects_taught: string;
  grade_levels: string;
  years_of_experience: string;
  education_level: string;
  phone_number: string;
  whatsapp_number: string;
};

const emptyForm = (): FormState => ({
  full_name: "",
  date_of_birth: "",
  gender: "",
  country: "",
  city: "",
  preferred_language: "",
  bio: "",
  school_name: "",
  school_address: "",
  school_type: "",
  number_of_students: "",
  number_of_classes: "",
  subjects_taught: "",
  grade_levels: "",
  years_of_experience: "",
  education_level: "",
  phone_number: "",
  whatsapp_number: "",
});

const formFromProfile = (profile: Profile | null): FormState => ({
  full_name: profile?.full_name ?? "",
  date_of_birth: profile?.date_of_birth ?? "",
  gender: profile?.gender ?? "",
  country: profile?.country ?? "",
  city: profile?.city ?? "",
  preferred_language: profile?.preferred_language ?? "",
  bio: profile?.bio ?? "",
  school_name: profile?.school_name ?? "",
  school_address: profile?.school_address ?? "",
  school_type: profile?.school_type ?? "",
  number_of_students: profile?.number_of_students != null ? String(profile.number_of_students) : "",
  number_of_classes: profile?.number_of_classes != null ? String(profile.number_of_classes) : "",
  subjects_taught: profile?.subjects_taught ?? "",
  grade_levels: profile?.grade_levels ?? "",
  years_of_experience:
    profile?.years_of_experience != null ? String(profile.years_of_experience) : "",
  education_level: profile?.education_level ?? "",
  phone_number: profile?.phone_number ?? "",
  whatsapp_number: profile?.whatsapp_number ?? "",
});

type NotifPrefs = {
  emailNotifications: boolean;
  assignmentReminders: boolean;
  gradeUpdates: boolean;
  courseAnnouncements: boolean;
};

const defaultNotifs = (): NotifPrefs => ({
  emailNotifications: true,
  assignmentReminders: true,
  gradeUpdates: true,
  courseAnnouncements: true,
});

const notifKey = (userId: string) => `settings_notif_${userId}`;

export function AccountSettings({ audience }: { audience: SettingsAudience }) {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { t } = useLanguage();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotifPrefs>(defaultNotifs);
  const [savingNotifs, setSavingNotifs] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const email = profile?.email ?? user?.email ?? "";
  const showSchool = audience === "teacher";
  const canEditAccount = !!user;

  useEffect(() => {
    setForm(formFromProfile(profile));
    setAvatarUrl(resolveAvatarUrl(profile, user));
  }, [profile, user, email]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(notifKey(user.id));
        if (raw) setNotifications({ ...defaultNotifs(), ...JSON.parse(raw) });
      } catch {
        /* keep defaults */
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const patch = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveProfile = async () => {
    if (!user) return;
    const phoneErr = optionalPhoneError(form.phone_number, form.country || "Cameroon");
    if (phoneErr) {
      showError(t("settings.profileSaveFailed"), new Error(phoneErr));
      return;
    }
    const waErr = optionalPhoneError(form.whatsapp_number, form.country || "Cameroon", "WhatsApp");
    if (waErr) {
      showError(t("settings.profileSaveFailed"), new Error(waErr));
      return;
    }
    if (!form.full_name.trim()) {
      showError(t("settings.profileSaveFailed"), new Error("Full name is required."));
      return;
    }

    setSavingProfile(true);
    try {
      const payload: Record<string, unknown> = {
        id: user.id,
        email,
        role: (profile?.role as UserRole) || (audience === "student" ? "student" : "teacher"),
        full_name: form.full_name.trim(),
        date_of_birth: form.date_of_birth.trim() || null,
        gender: form.gender || null,
        country: form.country || null,
        city: form.city.trim() || null,
        preferred_language: form.preferred_language || null,
        bio: form.bio.trim() || null,
        school_name: form.school_name.trim() || null,
        school_address: form.school_address.trim() || null,
        phone_number: form.phone_number.trim() || null,
        whatsapp_number: form.whatsapp_number.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (showSchool) {
        payload.school_type = form.school_type || null;
        payload.number_of_students = parseOptionalInt(form.number_of_students);
        payload.number_of_classes = parseOptionalInt(form.number_of_classes);
        payload.subjects_taught = form.subjects_taught.trim() || null;
        payload.grade_levels = form.grade_levels || null;
        payload.years_of_experience = parseOptionalInt(form.years_of_experience);
        payload.education_level = form.education_level || null;
      }
      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      showSuccess(t("settings.profileSaved"), t("settings.profileSavedHint"));
    } catch (e) {
      showError(t("settings.profileSaveFailed"), e);
    } finally {
      setSavingProfile(false);
    }
  };

  const pickAvatar = async () => {
    if (!user) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showError(t("settings.avatarFailed"), new Error("Photo library permission is required."));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      showError(t("settings.avatarFailed"), new Error("Could not read that image."));
      return;
    }
    setUploadingAvatar(true);
    try {
      const dataUrl = `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`;
      const { error } = await supabase
        .from("profiles")
        .update({
          avatar_url: dataUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw error;
      setAvatarUrl(dataUrl);
      await refreshProfile();
      showSuccess(t("settings.avatarUpdated"), t("settings.avatarUpdatedHint"));
    } catch (e) {
      showError(t("settings.avatarFailed"), e);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const savePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setPasswordError(t("settings.passwordMissing"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t("settings.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.passwordMismatch"));
      return;
    }
    setSavingPassword(true);
    setPasswordError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      showSuccess(t("settings.passwordUpdated"), t("settings.passwordUpdatedHint"));
    } catch (e) {
      const message = e instanceof Error ? e.message : t("settings.passwordUpdateFailed");
      setPasswordError(message);
      showError(t("settings.passwordUpdateFailed"), e);
    } finally {
      setSavingPassword(false);
    }
  };

  const saveNotifications = async () => {
    if (!user) return;
    setSavingNotifs(true);
    try {
      await AsyncStorage.setItem(notifKey(user.id), JSON.stringify(notifications));
      showSuccess(t("settings.prefsSaved"), t("settings.prefsSavedHint"));
    } catch (e) {
      showError(t("settings.prefsFailed"), e);
    } finally {
      setSavingNotifs(false);
    }
  };

  const deleteAccount = async () => {
    if (!user) return;
    if (deleteText.trim() !== "DELETE") {
      showError(t("settings.deleteFailed"), new Error(t("settings.deleteTypeHint")));
      return;
    }
    setDeleting(true);
    try {
      await supabase.from("profiles").delete().eq("id", user.id);
      await signOut();
      router.replace("/(public)/welcome");
    } catch (e) {
      showError(t("settings.deleteFailed"), e);
    } finally {
      setDeleting(false);
    }
  };

  const logout = async () => {
    try {
      if (audience === "student") await clearStudentSession();
      await signOut();
    } finally {
      router.replace("/(public)/welcome");
    }
  };

  return (
    <DashboardShell title={t("sidebar.settings")} loading={loading} hideAvatar>
      <View style={styles.hero}>
        <View style={styles.orb} />
        <Pressable onPress={canEditAccount ? pickAvatar : undefined} disabled={uploadingAvatar}>
          <Avatar
            name={form.full_name || profile?.full_name}
            uri={avatarUrl}
            size={72}
            tone="onBrand"
            letters={2}
          />
          {canEditAccount ? (
            <View style={styles.cameraBadge}>
              <Camera size={14} color={colors.brandDeep} />
            </View>
          ) : null}
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h3" weight="extrabold" color={colors.white} numberOfLines={1}>
            {form.full_name || profile?.full_name || t("nav.settings")}
          </Text>
          {email ? (
            <Text variant="micro" color={colors.onBrandMuted} numberOfLines={1}>
              {email}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <Badge
              label={audience === "student" ? t("auth.student") : t("auth.teacher")}
              tone="onBrand"
            />
            {form.country ? <Badge label={form.country} tone="onBrand" /> : null}
          </View>
        </View>
      </View>

      {!canEditAccount ? (
        <Card>
          <Text variant="bodySm" color={colors.textMuted}>
            {t("settings.tokenAccountHint")}
          </Text>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title={t("settings.personal")}
              subtitle={t("settings.personalHint")}
              icon={
                <IconTile size={40}>
                  <UserCircle size={19} color={colors.brandDeep} />
                </IconTile>
              }
            />
            <View style={styles.fields}>
              <Input
                label={t("auth.fullName")}
                value={form.full_name}
                onChangeText={(v) => patch("full_name", v)}
                placeholder="e.g. Ngwa Emilia Tanyi"
                autoCapitalize="words"
                required
              />
              <Input
                label={t("auth.email")}
                value={email}
                editable={false}
                icon={<Mail size={17} color={colors.textMuted} />}
                hint={t("settings.emailLocked")}
              />
              <Input
                label={t("settings.dateOfBirth")}
                value={form.date_of_birth}
                onChangeText={(v) => patch("date_of_birth", v)}
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                hint={t("settings.dateHint")}
              />
              <Select
                label={t("settings.gender")}
                value={form.gender}
                options={toOptions(GENDERS)}
                onChange={(v) => patch("gender", v)}
                placeholder="Select"
              />
              <Select
                label={t("settings.country")}
                value={form.country}
                options={toOptions(COUNTRIES)}
                onChange={(v) => patch("country", v)}
                placeholder="Select"
              />
              <Input
                label={t("settings.city")}
                value={form.city}
                onChangeText={(v) => patch("city", v)}
                placeholder="e.g. Yaoundé"
              />
              <Select
                label={t("settings.language")}
                value={form.preferred_language}
                options={toOptions(LANGUAGES)}
                onChange={(v) => patch("preferred_language", v)}
              />
              <Input
                label={t("settings.bio")}
                value={form.bio}
                onChangeText={(v) => patch("bio", v)}
                placeholder={t("settings.bioPlaceholder")}
                multiline
              />
              <Button
                label={t("settings.savePersonal")}
                onPress={saveProfile}
                loading={savingProfile}
                icon={<Save size={18} color={colors.white} />}
              />
            </View>
          </Card>

          {showSchool ? (
            <Card>
              <CardHeader
                title={t("settings.schoolInfo")}
                subtitle={t("settings.schoolInfoHint")}
                icon={
                  <IconTile size={40}>
                    <School size={19} color={colors.brandDeep} />
                  </IconTile>
                }
              />
              <View style={styles.fields}>
                <Input
                  label={t("settings.school")}
                  value={form.school_name}
                  onChangeText={(v) => patch("school_name", v)}
                  placeholder={t("settings.schoolPlaceholder")}
                />
                <Input
                  label={t("settings.schoolAddress")}
                  value={form.school_address}
                  onChangeText={(v) => patch("school_address", v)}
                  placeholder="e.g. Molyko, Buea"
                />
                <Select
                  label={t("settings.schoolType")}
                  value={form.school_type}
                  options={toOptions(SCHOOL_TYPES)}
                  onChange={(v) => patch("school_type", v)}
                  placeholder="Select"
                />
                <Select
                  label={t("settings.classes")}
                  value={form.number_of_classes}
                  options={CLASS_COUNTS}
                  onChange={(v) => patch("number_of_classes", v)}
                  placeholder="Select..."
                />
                <Select
                  label={t("settings.studentsCount")}
                  value={form.number_of_students}
                  options={STUDENT_COUNTS}
                  onChange={(v) => patch("number_of_students", v)}
                  placeholder="Select..."
                />
                <Input
                  label={t("settings.subjects")}
                  value={form.subjects_taught}
                  onChangeText={(v) => patch("subjects_taught", v)}
                  placeholder="e.g. Math, Science"
                />
                <Select
                  label={t("settings.gradeLevels")}
                  value={form.grade_levels}
                  options={toOptions(GRADE_LEVELS)}
                  onChange={(v) => patch("grade_levels", v)}
                  placeholder="Select"
                />
                <Input
                  label={t("settings.years")}
                  value={form.years_of_experience}
                  onChangeText={(v) => patch("years_of_experience", v)}
                  placeholder="e.g. 5"
                  keyboardType="numeric"
                />
                <Select
                  label={t("settings.education")}
                  value={form.education_level}
                  options={toOptions(EDUCATION_LEVELS)}
                  onChange={(v) => patch("education_level", v)}
                  placeholder="Select"
                />
                <Button
                  label={t("settings.saveSchool")}
                  onPress={saveProfile}
                  loading={savingProfile}
                  icon={<Save size={18} color={colors.white} />}
                />
              </View>
            </Card>
          ) : (
            <Card>
              <CardHeader
                title={t("settings.school")}
                icon={
                  <IconTile size={40}>
                    <School size={19} color={colors.brandDeep} />
                  </IconTile>
                }
              />
              <View style={styles.fields}>
                <Input
                  label={t("settings.school")}
                  value={form.school_name}
                  onChangeText={(v) => patch("school_name", v)}
                  placeholder={t("settings.schoolPlaceholder")}
                />
                <Button
                  label={t("settings.saveProfile")}
                  onPress={saveProfile}
                  loading={savingProfile}
                />
              </View>
            </Card>
          )}

          <Card>
            <CardHeader
              title={t("settings.contact")}
              subtitle={t("settings.contactHint")}
              icon={
                <IconTile size={40}>
                  <Phone size={19} color={colors.brandDeep} />
                </IconTile>
              }
            />
            <View style={styles.fields}>
              <Input
                label={t("settings.phone")}
                value={form.phone_number}
                onChangeText={(v) => patch("phone_number", v)}
                placeholder={PHONE_RULES[form.country]?.example ?? "+237 6XX XXX XXX"}
                keyboardType="phone-pad"
              />
              <Input
                label={t("settings.whatsapp")}
                value={form.whatsapp_number}
                onChangeText={(v) => patch("whatsapp_number", v)}
                placeholder={PHONE_RULES[form.country]?.example ?? "+237 6XX XXX XXX"}
                keyboardType="phone-pad"
                hint={t("settings.whatsappHint")}
              />
              <Button
                label={t("settings.saveContact")}
                onPress={saveProfile}
                loading={savingProfile}
                icon={<Save size={18} color={colors.white} />}
              />
            </View>
          </Card>

          <Card>
            <CardHeader
              title={t("settings.security")}
              subtitle={t("settings.securityHint")}
              icon={
                <IconTile size={40}>
                  <KeyRound size={19} color={colors.brandDeep} />
                </IconTile>
              }
            />
            <View style={styles.fields}>
              <Input
                label={t("settings.newPassword")}
                value={newPassword}
                onChangeText={(v) => {
                  setNewPassword(v);
                  if (passwordError) setPasswordError(null);
                }}
                placeholder="Min. 8 characters"
                password
                icon={<Shield size={17} color={colors.textMuted} />}
              />
              <PasswordStrength password={newPassword} />
              <Input
                label={t("settings.confirmPassword")}
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  if (passwordError) setPasswordError(null);
                }}
                placeholder="Re-enter your new password"
                password
                error={passwordError}
              />
              <Button
                label={t("settings.updatePassword")}
                variant="outline"
                onPress={savePassword}
                loading={savingPassword}
                disabled={!newPassword || !confirmPassword}
              />
            </View>
          </Card>

          <Card>
            <CardHeader
              title={t("settings.notifications")}
              subtitle={t("settings.notificationsHint")}
              icon={
                <IconTile size={40}>
                  <Bell size={19} color={colors.brandDeep} />
                </IconTile>
              }
            />
            <View style={styles.fields}>
              <Toggle
                label={t("settings.notifEmail")}
                hint={t("settings.notifEmailHint")}
                value={notifications.emailNotifications}
                onValueChange={(v) => setNotifications((p) => ({ ...p, emailNotifications: v }))}
              />
              <Toggle
                label={t("settings.notifAssignments")}
                hint={t("settings.notifAssignmentsHint")}
                value={notifications.assignmentReminders}
                onValueChange={(v) => setNotifications((p) => ({ ...p, assignmentReminders: v }))}
              />
              <Toggle
                label={t("settings.notifGrades")}
                hint={t("settings.notifGradesHint")}
                value={notifications.gradeUpdates}
                onValueChange={(v) => setNotifications((p) => ({ ...p, gradeUpdates: v }))}
              />
              <Toggle
                label={t("settings.notifAnnouncements")}
                hint={t("settings.notifAnnouncementsHint")}
                value={notifications.courseAnnouncements}
                onValueChange={(v) => setNotifications((p) => ({ ...p, courseAnnouncements: v }))}
              />
              <Button
                label={t("settings.savePrefs")}
                onPress={saveNotifications}
                loading={savingNotifs}
                icon={<Save size={18} color={colors.white} />}
              />
            </View>
          </Card>
        </>
      )}

      <Card>
        <CardHeader
          title={t("mobile.language")}
          icon={
            <IconTile size={40}>
              <UserCircle size={19} color={colors.brandDeep} />
            </IconTile>
          }
        />
        <View style={{ marginTop: space.md, alignItems: "flex-start" }}>
          <LanguageSwitcher />
        </View>
      </Card>

      {canEditAccount ? (
        <Card>
          <CardHeader
            title={t("settings.danger")}
            subtitle={t("settings.dangerHint")}
            icon={
              <IconTile size={40}>
                <AlertTriangle size={19} color={colors.danger} />
              </IconTile>
            }
          />
          <View style={styles.fields}>
            {!confirmDelete ? (
              <Button
                label={t("settings.deleteAccount")}
                variant="danger"
                onPress={() => setConfirmDelete(true)}
                icon={<Trash2 size={18} color={colors.white} />}
              />
            ) : (
              <>
                <Input
                  label={t("settings.deleteTypeHint")}
                  value={deleteText}
                  onChangeText={setDeleteText}
                  placeholder="DELETE"
                  autoCapitalize="characters"
                />
                <View style={styles.row}>
                  <Button
                    label={t("common.cancel")}
                    variant="outline"
                    onPress={() => {
                      setConfirmDelete(false);
                      setDeleteText("");
                    }}
                    fullWidth={false}
                    style={{ flex: 1 }}
                  />
                  <Button
                    label={t("settings.confirmDelete")}
                    variant="danger"
                    onPress={deleteAccount}
                    loading={deleting}
                    disabled={deleteText.trim() !== "DELETE"}
                    fullWidth={false}
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            )}
          </View>
        </Card>
      ) : null}

      <Button
        label={t("nav.logout")}
        variant="danger"
        icon={<LogOut size={18} color={colors.white} />}
        onPress={logout}
      />
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    top: -45,
    right: -35,
    width: 130,
    height: 130,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  fields: { gap: space.md, marginTop: space.md },
  row: { flexDirection: "row", gap: space.sm },
});
