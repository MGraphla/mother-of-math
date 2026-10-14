import { useEffect, useState } from "react";
import { CardRow, EmptyState, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchAllTeachers } from "../../../src/services/admin";

export default function AdminTeachersScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  const reload = async () => {
    setItems(await fetchAllTeachers());
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  return (
    <ScreenShell
      title="Teachers"
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } finally {
          setRefreshing(false);
        }
      }}
    >
      {items.length === 0 ? (
        <EmptyState title="No teachers found" />
      ) : (
        items.map((t) => (
          <CardRow
            key={t.id ?? t.teacher_id ?? t.email}
            title={t.full_name ?? t.teacher_name ?? "Teacher"}
            subtitle={`${t.email ?? ""} · ${t.school_name ?? t.schoolName ?? ""} · ${t.country ?? ""}`}
          />
        ))
      )}
    </ScreenShell>
  );
}
