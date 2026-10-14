import { useLanguage } from "../../../src/context/LanguageContext";
import { StudentAccountScreen } from "../../../src/components/StudentAccountScreen";

export default function StudentProfileScreen() {
  const { t } = useLanguage();
  return <StudentAccountScreen title={t("nav.profile")} />;
}
