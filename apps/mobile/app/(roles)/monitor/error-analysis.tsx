import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { supabase } from "../../../src/lib/supabase";

export default function MonitorErrorAnalysisScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("student_works")
        .select("id,student_name,error_type,feedback,remediation,created_at")
        .not("error_type", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      setItems(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <ScreenShell title="Error Analysis" loading={loading}>
      {items.map((item) => (
        <CardRow
          key={item.id}
          title={`${item.student_name ?? "Learner"} · ${item.error_type}`}
          subtitle={`${item.feedback ?? ""} · ${item.remediation ?? ""}`}
        />
      ))}
    </ScreenShell>
  );
}
