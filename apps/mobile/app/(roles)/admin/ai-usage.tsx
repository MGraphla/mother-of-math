import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchAiUsageStats } from "../../../src/services/admin";

export default function AdminAiUsageScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});
  useEffect(() => {
    fetchAiUsageStats()
      .then((s) => setStats(s))
      .finally(() => setLoading(false));
  }, []);
  return (
    <ScreenShell title="AI Usage" loading={loading}>
      {Object.entries(stats).map(([k, v]) => (
        <CardRow key={k} title={k.replace(/_/g, " ")} subtitle={String(v)} />
      ))}
    </ScreenShell>
  );
}
