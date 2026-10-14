import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchAllResourcesAdmin } from "../../../src/services/admin";

export default function AdminResourcesScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetchAllResourcesAdmin()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScreenShell title="Resources" loading={loading}>
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

