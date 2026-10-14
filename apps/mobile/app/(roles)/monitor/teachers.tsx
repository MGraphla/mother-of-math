import { useEffect, useState } from "react";
import { router } from "expo-router";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchAllTeachers } from "../../../src/services/admin";

export default function MonitorTeachersScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    fetchAllTeachers().then(setItems).finally(() => setLoading(false));
  }, []);
  return (
    <ScreenShell title="Teachers" loading={loading}>
      {items.map((t) => (
        <CardRow
          key={t.id ?? t.email}
          title={t.full_name ?? t.teacher_name ?? "Teacher"}
          subtitle={`${t.school_name ?? ""} · ${t.country ?? ""}`}
          onPress={() => router.push(`/(roles)/monitor/teacher-detail?id=${t.id ?? t.teacher_id}` as never)}
        />
      ))}
    </ScreenShell>
  );
}
