import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchAllStudentsAdmin } from "../../../src/services/admin";

export default function MonitorLearnersScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    fetchAllStudentsAdmin().then(setItems).finally(() => setLoading(false));
  }, []);
  return (
    <ScreenShell title="Learners" loading={loading}>
      {items.map((s) => (
        <CardRow key={s.id} title={s.full_name ?? "Learner"} subtitle={`${s.grade_level ?? ""} · ${s.account_status ?? ""}`} />
      ))}
    </ScreenShell>
  );
}
