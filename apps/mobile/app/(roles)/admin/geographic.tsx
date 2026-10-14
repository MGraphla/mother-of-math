import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchTeachersByCountry } from "../../../src/services/admin";

export default function AdminGeographicScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<{ country: string; count: number }[]>([]);
  useEffect(() => {
    fetchTeachersByCountry().then(setItems).finally(() => setLoading(false));
  }, []);
  return (
    <ScreenShell title="Geographic" loading={loading}>
      {items.map((item) => (
        <CardRow key={item.country} title={item.country} subtitle={`${item.count} teachers`} />
      ))}
    </ScreenShell>
  );
}
