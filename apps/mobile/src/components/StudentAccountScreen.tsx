import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  Camera,
  GraduationCap,
  Heart,
  Phone,
  School,
  Shield,
  Upload,
  UserCircle,
} from "lucide-react-native";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { pickImageForUpload } from "../native/uploads";
import { DashboardShell } from "../navigation/DashboardShell";
import {
  fetchActiveLearner,
  updateLearnerProfilePhoto,
} from "../services/studentPortal";
import type { StudentRow } from "../services/students";
import { colors, layout, radius, space } from "../theme/tokens";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardSection,
  EmptyState,
  Text,
  showError,
  showSuccess,
} from "../ui";

const display = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(locale);
};

function FactRow({
  label,
  value,
  emptyLabel,
}: {
  label: string;
  value?: string | null;
  emptyLabel: string;
}) {
  const shown = value?.trim();
  return (
    <View style={styles.fact}>
      <Text variant="caption" color={colors.textMuted}>
        {label}
      </Text>
      <Text
        variant="caption"
        weight={shown ? "semibold" : "regular"}
        color={shown ? colors.text : colors.textFaint}
        style={{ marginTop: 4 }}
      >
        {shown || emptyLabel}
      </Text>
    </View>
  );
}

export function StudentAccountScreen({ title }: { title: string }) {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [learner, setLearner] = useState<StudentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLearner(await fetchActiveLearner());
  }, []);

  useEffect(() => {
    load()
      .catch((e) => showError(t("student.profileLoadFailed"), e))
      .finally(() => setLoading(false));
  }, [load, t]);

  const uploadPhoto = async () => {
    const file = await pickImageForUpload();
    if (!file?.uri) return;
    setUploading(true);
    try {
      const url = await updateLearnerProfilePhoto({
        uri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType,
      });
      setLearner((current) => (current ? { ...current, profile_photo_url: url } : current));
      showSuccess(t("student.photoUpdated"), t("student.photoUpdatedHint"));
    } catch (e) {
      showError(t("student.photoFailed"), e);
    } finally {
      setUploading(false);
    }
  };

  const name = learner?.full_name ?? profile?.full_name ?? t("common.student");
  const status = (learner?.account_status || "active").toLowerCase();
  const statusLabel =
    status === "active" ? t("student.activeAccount") : `${status} ${t("student.accountWord")}`;

  const sections = learner
    ? [
        {
          title: t("student.basicInfo"),
          icon: <UserCircle size={18} color={colors.brandDeep} />,
          items: [
            { label: t("students.fullName"), value: display(learner.full_name) },
            { label: t("settings.dateOfBirth"), value: formatDate(learner.date_of_birth, locale) },
            { label: t("settings.gender"), value: display(learner.gender) },
            { label: t("student.nationality"), value: display(learner.nationality) },
            { label: t("student.placeOfBirth"), value: display(learner.place_of_birth) },
            { label: t("student.homeLanguage"), value: display(learner.home_language) },
          ],
        },
        {
          title: t("student.guardianContact"),
          icon: <Phone size={18} color={colors.brandDeep} />,
          items: [
            { label: t("student.parentGuardian"), value: display(learner.parent_name) },
            { label: t("settings.phone"), value: display(learner.parent_phone) },
            { label: t("auth.email"), value: display(learner.parent_email) },
            { label: t("student.relationship"), value: display(learner.parent_relationship) },
            { label: t("student.homeAddress"), value: display(learner.home_address) },
          ],
        },
        {
          title: t("student.schoolDetails"),
          icon: <School size={18} color={colors.brandDeep} />,
          items: [
            { label: t("settings.school"), value: display(learner.school_name) },
            { label: t("students.gradeLevel"), value: display(learner.grade_level) },
            { label: t("students.className"), value: display(learner.class_name) },
            {
              label: t("student.learnerId"),
              value: display(learner.student_code || learner.admission_number),
            },
            { label: t("student.academicYear"), value: display(learner.academic_year) },
          ],
        },
        {
          title: t("student.healthNeeds"),
          icon: <Heart size={18} color={colors.brandDeep} />,
          items: [
            { label: t("student.bloodGroup"), value: display(learner.blood_group) },
            { label: t("student.medicalConditions"), value: display(learner.medical_conditions) },
            { label: t("student.allergies"), value: display(learner.allergies) },
            { label: t("student.specialNeeds"), value: display(learner.special_needs) },
            { label: t("student.disabilityStatus"), value: display(learner.disability_status) },
          ],
        },
      ]
    : [];

  return (
    <DashboardShell
      title={title}
      loading={loading}
      hideAvatar
      onRefresh={async () => {
        try {
          await load();
        } catch (e) {
          showError(t("student.profileLoadFailed"), e);
        }
      }}
    >
      {!learner ? (
        <EmptyState
          icon={<UserCircle size={24} color={colors.brandDeep} />}
          title={t("student.noSession")}
          subtitle={t("student.needTokenHint")}
          actionLabel={t("mobile.studentAccess")}
          onAction={() => router.replace("/(auth)/student-login")}
        />
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.orb} />
            <Pressable onPress={uploadPhoto} disabled={uploading} style={styles.avatarWrap}>
              <Avatar name={name} uri={learner.profile_photo_url} size={88} tone="onBrand" letters={2} />
              <View style={styles.cameraBadge}>
                <Camera size={14} color={colors.brandDeep} />
              </View>
            </Pressable>
            <Text
              variant="h2"
              weight="extrabold"
              color={colors.white}
              center
              style={{ marginTop: space.md }}
              numberOfLines={2}
            >
              {name}
            </Text>
            <View style={styles.badges}>
              {learner.grade_level ? (
                <Badge
                  label={learner.grade_level}
                  tone="onBrand"
                  icon={<GraduationCap size={12} color={colors.white} />}
                />
              ) : null}
              {learner.class_name ? <Badge label={learner.class_name} tone="onBrand" /> : null}
              {learner.school_name ? <Badge label={learner.school_name} tone="onBrand" /> : null}
              <Badge
                label={statusLabel}
                tone="onBrand"
                icon={<Shield size={12} color={colors.white} />}
              />
            </View>
            <View style={{ marginTop: space.md, alignSelf: "stretch" }}>
              <Button
                label={t("student.uploadPhoto")}
                variant="onBrandOutline"
                size="sm"
                loading={uploading}
                icon={<Upload size={16} color={colors.white} />}
                onPress={uploadPhoto}
              />
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Text variant="micro" weight="semibold" color={colors.textSecondary}>
                {t("student.joined")} {new Date(learner.created_at || Date.now()).getFullYear()}
              </Text>
            </View>
            <View style={styles.metaChip}>
              <Text variant="micro" weight="semibold" color={colors.textSecondary}>
                {t("student.portalActive")}
              </Text>
            </View>
            {learner.student_code ? (
              <View style={styles.metaChip}>
                <Text variant="micro" weight="semibold" color={colors.brandDeep}>
                  {t("student.codeLabel")}: {learner.student_code}
                </Text>
              </View>
            ) : null}
          </View>

          {sections.map((section) => (
            <CardSection key={section.title} title={section.title} icon={section.icon}>
              {section.items.map((item) => (
                <FactRow
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  emptyLabel={t("student.notProvided")}
                />
              ))}
            </CardSection>
          ))}

          <Card>
            <Text variant="caption" weight="semibold" color={colors.textSecondary}>
              {t("mobile.language")}
            </Text>
            <View style={{ marginTop: space.sm, alignItems: "flex-start" }}>
              <LanguageSwitcher />
            </View>
          </Card>
        </>
      )}
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.brand,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    top: -50,
    right: -40,
    width: 150,
    height: 150,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  avatarWrap: { position: "relative" },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: layout.hairline,
    borderColor: colors.brandMute,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: space.md,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaChip: {
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: layout.hairline,
    borderColor: colors.border,
  },
  fact: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colors.border,
  },
});
