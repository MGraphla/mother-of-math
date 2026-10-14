import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchAllLessonPlansAdmin } from "../../../src/services/admin";

export default function MonitorLessonPlansScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    fetchAllLessonPlansAdmin().then(setItems).finally(() => setLoading(false));
  }, []);
  return (
    <ScreenShell title="Lesson Plans" loading={loading}>
      {items.map((item, idx) => (
        <CardRow key={item.id ?? idx} title={item.title ?? `Plan ${idx + 1}`} subtitle={item.level ?? ""} />
      ))}
    </ScreenShell>
  );
}
