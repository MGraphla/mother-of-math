import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchModerationFlags } from "../../../src/services/admin";

export default function AdminModerationScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    fetchModerationFlags().then(setItems).finally(() => setLoading(false));
  }, []);
  return (
    <ScreenShell title="Moderation" loading={loading}>
      {items.length === 0 ? <CardRow title="No flags" subtitle="No moderation items found" /> : null}
      {items.map((item, idx) => (
        <CardRow
          key={item.id ?? idx}
          title={item.reason ?? item.content_type ?? `Flag ${idx + 1}`}
          subtitle={`${item.status ?? ""} · ${item.created_at ? new Date(item.created_at).toLocaleString() : ""}`}
        />
      ))}
    </ScreenShell>
  );
}
