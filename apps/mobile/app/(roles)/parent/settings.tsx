import { useEffect, useState } from "react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Globe, KeyRound, LogOut, Mail, Phone, Save, UserCircle } from "lucide-react-native";
import { LanguageSwitcher } from "../../../src/components/LanguageSwitcher";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { resolveAvatarUrl } from "../../../src/lib/avatar";
import { supabase } from "../../../src/lib/supabase";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import { colors, radius, space } from "../../../src/theme/tokens";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  IconTile,
  Input,
  Text,
  showError,
  showSuccess,
} from "../../../src/ui";

export default function ParentSettingsScreen() {
  const { user, profile, signOut } = useAuth();
  const { t } = useLanguage();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("full_name,phone_number")
          .eq("id", user.id)
          .maybeSingle();
        if (data) {
          setFullName(data.full_name ?? "");
          setPhone(data.phone_number ?? "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        email: profile?.email ?? user.email,
        full_name: fullName.trim(),
        phone_number: phone.trim(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      showSuccess(t("settings.profileSaved"), t("settings.profileSavedHint"));
    } catch (e) {
      showError(t("settings.profileSaveFailed"), e);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (password.length < 6) {
      setPasswordError(t("settings.passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      setPasswordError(t("settings.passwordMismatch"));
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirm("");
      setPasswordError(null);
      showSuccess(t("settings.passwordUpdated"), t("settings.passwordUpdatedHint"));
    } catch (e) {
      showError(t("settings.passwordUpdateFailed"), e);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <DashboardShell title={t("sidebar.settings")} loading={loading} hideAvatar>
      <View style={styles.hero}>
        <View style={styles.orb} />
        <Avatar
          name={fullName || profile?.full_name}
          uri={resolveAvatarUrl(profile, user)}
          size={64}
          tone="onBrand"
          letters={2}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h3" weight="extrabold" color={colors.white} numberOfLines={1}>
            {fullName || profile?.full_name || t("nav.parent")}
          </Text>
          <Text variant="micro" color={colors.onBrandMuted} numberOfLines={1}>
            {profile?.email ?? user?.email ?? ""}
          </Text>
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            <Badge label={t("mobile.parentPortal")} tone="onBrand" />
          </View>
        </View>
      </View>

      <Card>
        <CardHeader
          title={t("settings.profile")}
          subtitle={t("parent.profileHint")}
          icon={
            <IconTile size={40}>
              <UserCircle size={19} color={colors.brandDeep} />
            </IconTile>
          }
        />
        <View style={styles.fields}>
          <Input
            label={t("students.fullName")}
            value={fullName}
            onChangeText={setFullName}
            placeholder={t("students.fullNamePlaceholder")}
            autoCapitalize="words"
          />
          <Input
            label={t("settings.phone")}
            value={phone}
            onChangeText={setPhone}
            placeholder={t("settings.phonePlaceholder")}
            keyboardType="phone-pad"
            icon={<Phone size={17} color={colors.textMuted} />}
          />
          {profile?.email || user?.email ? (
            <Input
              label={t("auth.email")}
              value={profile?.email ?? user?.email ?? ""}
              editable={false}
              icon={<Mail size={17} color={colors.textMuted} />}
              hint={t("settings.emailLocked")}
            />
          ) : null}
          <Button
            label={t("settings.saveProfile")}
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
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (passwordError) setPasswordError(null);
            }}
            placeholder="••••••••"
            password
          />
          <Input
            label={t("settings.confirmPassword")}
            value={confirm}
            onChangeText={(v) => {
              setConfirm(v);
              if (passwordError) setPasswordError(null);
            }}
            placeholder="••••••••"
            password
            error={passwordError}
          />
          <Button
            label={t("settings.updatePassword")}
            variant="outline"
            onPress={savePassword}
            loading={savingPassword}
          />
        </View>
      </Card>

      <Card>
        <CardHeader
          title={t("mobile.language")}
          icon={
            <IconTile size={40}>
              <Globe size={19} color={colors.brandDeep} />
            </IconTile>
          }
        />
        <View style={{ marginTop: space.md, alignItems: "flex-start" }}>
          <LanguageSwitcher />
        </View>
      </Card>

      <Button
        label={t("nav.logout")}
        variant="danger"
        icon={<LogOut size={18} color={colors.white} />}
        onPress={async () => {
          try {
            await signOut();
          } finally {
            router.replace("/(public)/welcome");
          }
        }}
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
  fields: { gap: space.md, marginTop: space.md },
});
