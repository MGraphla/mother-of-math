import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { supabase } from "../../../src/lib/supabase";

export default function AdminChatbotScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id,title,grade,updated_at,user_id")
        .order("updated_at", { ascending: false })
        .limit(100);
      setItems(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <ScreenShell title="Chatbot" loading={loading}>
      {items.map((item) => (
        <CardRow key={item.id} title={item.title} subtitle={`${item.grade ?? ""} · ${new Date(item.updated_at).toLocaleString()}`} />
      ))}
    </ScreenShell>
  );
}
