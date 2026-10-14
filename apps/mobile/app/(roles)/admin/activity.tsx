import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { supabase } from "../../../src/lib/supabase";

export default function AdminActivityScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,title,message,created_at,type")
        .order("created_at", { ascending: false })
        .limit(100);
      setItems(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <ScreenShell title="Activity" loading={loading}>
      {items.map((item) => (
        <CardRow
          key={item.id}
          title={item.title ?? item.type ?? "Activity"}
          subtitle={`${item.message ?? ""} · ${new Date(item.created_at).toLocaleString()}`}
        />
      ))}
    </ScreenShell>
  );
}
