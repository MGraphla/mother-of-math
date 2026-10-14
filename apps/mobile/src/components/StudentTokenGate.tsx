import { useState } from "react";
import { router } from "expo-router";
import { KeyRound } from "lucide-react-native";
import { AuthShell } from "./AuthShell";
import { useLanguage } from "../context/LanguageContext";
import { loginStudentByToken } from "../services/studentPortal";
import { colors } from "../theme/tokens";
import { Button, Input, Text } from "../ui";

/** Child token box — the only Student Login UI. */
export const StudentTokenGate = () => {
  const { t } = useLanguage();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const openPortal = async () => {
    const value = token.trim();
    if (!value) {
      setErrorMessage(t("student.enterTokenHint"));
      return;
    }
    setErrorMessage("");
    setLoading(true);
    try {
      await loginStudentByToken(value);
      router.replace("/(roles)/student");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : t("student.invalidToken"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title={t("mobile.studentEmailLogin")} subtitle={t("student.enterTokenHint")}>
      <Input
        label={t("students.accessToken")}
        value={token}
        onChangeText={(v) => {
          setToken(v);
          if (errorMessage) setErrorMessage("");
        }}
        placeholder={t("student.tokenPlaceholder")}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        textContentType="none"
        returnKeyType="go"
        onSubmitEditing={openPortal}
        required
        error={errorMessage || null}
        icon={<KeyRound size={18} color={colors.brandDark} />}
      />
      <Button
        label={loading ? t("student.opening") : t("student.open")}
        onPress={openPortal}
        loading={loading}
        size="lg"
      />
      <Text variant="caption" color={colors.textMuted} center>
        {t("student.tokenOnlyHint")}
      </Text>
    </AuthShell>
  );
};
