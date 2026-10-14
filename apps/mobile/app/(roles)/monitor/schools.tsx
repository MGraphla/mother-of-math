import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchAllSchools } from "../../../src/services/admin";

export default function MonitorSchoolsScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetchAllSchools()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScreenShell title="Schools" loading={loading}>
      {items.map((item, idx) => (
        <CardRow
          key={`${item.name}-${idx}`}
          title={item.name}
          subtitle={`${item.city ?? ""} · ${item.country ?? ""} · teachers ${item.teacherCount ?? 0}`}
        />
      ))}
    </ScreenShell>
  );
}
