import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchAdminCounts } from "../../../src/services/admin";

export default function AdminAnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchAdminCounts()
      .then((c) => setCounts(c as Record<string, number>))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ScreenShell title="Analytics" loading={loading}>
      {Object.entries(counts).map(([k, v]) => (
        <CardRow key={k} title={k.replace(/_/g, " ")} subtitle={String(v)} />
      ))}
    </ScreenShell>
  );
}
