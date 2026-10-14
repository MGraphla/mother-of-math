import { useLanguage } from "../../../src/context/LanguageContext";
import { StudentAccountScreen } from "../../../src/components/StudentAccountScreen";

export default function StudentSettingsScreen() {
  const { t } = useLanguage();
  return <StudentAccountScreen title={t("sidebar.settings")} />;
}
