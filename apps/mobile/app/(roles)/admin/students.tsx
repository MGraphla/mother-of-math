import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchAllStudentsAdmin } from "../../../src/services/admin";

export default function AdminStudentsScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetchAllStudentsAdmin()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScreenShell title="Students" loading={loading}>
      {items.map((s) => (
        <CardRow
          key={s.id}
          title={s.full_name ?? "Student"}
          subtitle={`${s.grade_level ?? ""} · ${s.class_name ?? ""} · ${s.account_status ?? ""}`}
        />
      ))}
    </ScreenShell>
  );
}
