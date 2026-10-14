import { useState } from "react";
import { Alert } from "react-native";
import { CardRow, PrimaryButton, ScreenShell } from "../../../src/components/ScreenKit";
import {
  fetchAllAnnouncementsAdmin,
  fetchAllAssignmentsAdmin,
  fetchAllLessonPlansAdmin,
  fetchAllResourcesAdmin,
  fetchAllStudentsAdmin,
  fetchAllTeachers,
} from "../../../src/services/admin";
import { shareTextFile } from "../../../src/native/exportText";

export default function AdminDataScreen() {
  const [busy, setBusy] = useState(false);

  const exportAll = async () => {
    setBusy(true);
    try {
      const payload = {
        teachers: await fetchAllTeachers(),
        students: await fetchAllStudentsAdmin(),
        assignments: await fetchAllAssignmentsAdmin(),
        lessonPlans: await fetchAllLessonPlansAdmin(),
        resources: await fetchAllResourcesAdmin(),
        announcements: await fetchAllAnnouncementsAdmin(),
        exportedAt: new Date().toISOString(),
      };
      await shareTextFile("mama-full-export.json", JSON.stringify(payload, null, 2));
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenShell title="Data Management">
      <CardRow title="Export platform data" subtitle="Creates a JSON dump you can share/save natively" />
      <PrimaryButton label={busy ? "Exporting..." : "Export all data"} onPress={exportAll} disabled={busy} />
    </ScreenShell>
  );
}
