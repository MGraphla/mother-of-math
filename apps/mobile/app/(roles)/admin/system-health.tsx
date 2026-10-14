import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchSystemHealth } from "../../../src/services/admin";

export default function AdminSystemHealthScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<{ name: string; ok: boolean }[]>([]);
  useEffect(() => {
    fetchSystemHealth().then(setItems).finally(() => setLoading(false));
  }, []);
  return (
    <ScreenShell title="System Health" loading={loading}>
      {items.map((item) => (
        <CardRow key={item.name} title={item.name} subtitle={item.ok ? "Healthy" : "Issue detected"} />
      ))}
    </ScreenShell>
  );
}
