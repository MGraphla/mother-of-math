import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchAllImages } from "../../../src/services/admin";
import { downloadAndShare } from "../../../src/native/downloads";

export default function MonitorImagesScreen() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    fetchAllImages().then(setItems).finally(() => setLoading(false));
  }, []);
  return (
    <ScreenShell title="Images" loading={loading}>
      {items.map((item, idx) => (
        <CardRow
          key={item.id ?? idx}
          title={item.prompt ?? item.student_name ?? `Image ${idx + 1}`}
          subtitle={item.created_at ? new Date(item.created_at).toLocaleString() : ""}
          onPress={async () => {
            if (item.image_url) await downloadAndShare(item.image_url, `monitor-image-${idx}.jpg`);
          }}
        />
      ))}
    </ScreenShell>
  );
}
