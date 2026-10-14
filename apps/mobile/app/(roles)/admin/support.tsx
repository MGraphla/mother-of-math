import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { supabase } from "../../../src/lib/supabase";

export default function AdminSupportScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("id,subject,status,created_at,requester_email")
        .order("created_at", { ascending: false })
        .limit(100);
      setItems(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <ScreenShell title="Support Tickets" loading={loading}>
      {items.map((item) => (
        <CardRow
          key={item.id}
          title={item.subject}
          subtitle={`${item.status} · ${item.requester_email ?? ""} · ${new Date(item.created_at).toLocaleString()}`}
        />
      ))}
    </ScreenShell>
  );
}
