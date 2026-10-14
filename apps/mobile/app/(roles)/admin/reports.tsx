import { useState } from "react";
import { Alert } from "react-native";
import { CardRow, PrimaryButton, ScreenShell } from "../../../src/components/ScreenKit";
import {
  fetchAdminCounts,
  fetchAllAssignmentsAdmin,
  fetchAllStudentsAdmin,
  fetchAllTeachers,
} from "../../../src/services/admin";
import { shareTextFile } from "../../../src/native/exportText";

export default function AdminReportsScreen() {
  const [busy, setBusy] = useState(false);

  const exportReport = async (kind: string) => {
    setBusy(true);
    try {
      let body = "";
      if (kind === "counts") body = JSON.stringify(await fetchAdminCounts(), null, 2);
      if (kind === "teachers") body = JSON.stringify(await fetchAllTeachers(), null, 2);
      if (kind === "students") body = JSON.stringify(await fetchAllStudentsAdmin(), null, 2);
      if (kind === "assignments") body = JSON.stringify(await fetchAllAssignmentsAdmin(), null, 2);
      await shareTextFile(`mama-${kind}-report.json`, body);
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenShell title="Reports">
      <CardRow title="Platform reports" subtitle="Export JSON reports and share/save on device" />
      <PrimaryButton label={busy ? "Exporting..." : "Export counts"} onPress={() => exportReport("counts")} disabled={busy} />
      <PrimaryButton label="Export teachers" onPress={() => exportReport("teachers")} disabled={busy} />
      <PrimaryButton label="Export students" onPress={() => exportReport("students")} disabled={busy} />
      <PrimaryButton label="Export assignments" onPress={() => exportReport("assignments")} disabled={busy} />
    </ScreenShell>
  );
}
