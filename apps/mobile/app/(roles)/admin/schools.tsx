import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchAllSchools } from "../../../src/services/admin";

export default function AdminSchoolsScreen() {
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
          key={item.id ?? item.name ?? idx}
          title={String(item.title ?? item.name ?? item.full_name ?? item.subject ?? `Item ${idx + 1}`)}
          subtitle={String(item.status ?? item.level ?? item.file_type ?? item.category ?? item.country ?? item.city ?? item.score ?? "")}
        />
      ))}
    </ScreenShell>
  );
}

