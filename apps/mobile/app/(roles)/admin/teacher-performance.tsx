import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchTeacherPerformance } from "../../../src/services/admin";

export default function AdminTeacherPerformanceScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    fetchTeacherPerformance().then(setItems).finally(() => setLoading(false));
  }, []);
  return (
    <ScreenShell title="Teacher Performance" loading={loading}>
      {items.map((item) => (
        <CardRow
          key={item.id}
          title={item.name}
          subtitle={`${item.school} · students ${item.students} · assignments ${item.assignments} · plans ${item.lessonPlans}`}
        />
      ))}
    </ScreenShell>
  );
}
