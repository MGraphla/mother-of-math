import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { supabase } from "../../../src/lib/supabase";

export default function AdminUploadsScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("student_works")
        .select("id,student_name,subject,status,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      setItems(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <ScreenShell title="Uploads" loading={loading}>
      {items.map((item) => (
        <CardRow
          key={item.id}
          title={item.student_name ?? "Upload"}
          subtitle={`${item.subject ?? ""} · ${item.status ?? ""} · ${new Date(item.created_at).toLocaleString()}`}
        />
      ))}
    </ScreenShell>
  );
}
