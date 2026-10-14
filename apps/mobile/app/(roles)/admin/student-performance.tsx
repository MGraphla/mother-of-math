import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchStudentPerformance } from "../../../src/services/admin";

export default function AdminStudentPerformanceScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    fetchStudentPerformance().then(setItems).finally(() => setLoading(false));
  }, []);
  return (
    <ScreenShell title="Student Performance" loading={loading}>
      {items.map((item) => (
        <CardRow
          key={item.id}
          title={item.name}
          subtitle={`Grade ${item.grade} · ${item.className} · ${item.status}`}
        />
      ))}
    </ScreenShell>
  );
}
