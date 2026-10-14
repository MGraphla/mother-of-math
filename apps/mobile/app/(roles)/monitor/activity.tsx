import { useEffect, useState } from "react";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { fetchAllTeachers, fetchAllStudentsAdmin, fetchAllAssignmentsAdmin } from "../../../src/services/admin";

export default function MonitorActivityScreen() {
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<{ title: string; subtitle: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [teachers, students, assignments] = await Promise.all([
        fetchAllTeachers(),
        fetchAllStudentsAdmin(),
        fetchAllAssignmentsAdmin(),
      ]);
      const rows = [
        ...teachers.slice(0, 20).map((t: any) => ({
          title: `Teacher · ${t.full_name ?? t.teacher_name ?? "Unknown"}`,
          subtitle: t.school_name ?? t.country ?? "",
        })),
        ...students.slice(0, 20).map((s: any) => ({
          title: `Learner · ${s.full_name ?? "Unknown"}`,
          subtitle: `${s.grade_level ?? ""} · ${s.account_status ?? ""}`,
        })),
        ...assignments.slice(0, 20).map((a: any) => ({
          title: `Assignment · ${a.title ?? "Untitled"}`,
          subtitle: a.status ?? "",
        })),
      ];
      setFeed(rows);
      setLoading(false);
    })();
  }, []);

  return (
    <ScreenShell title="Monitor Activity" loading={loading}>
      {feed.map((item, idx) => (
        <CardRow key={`${item.title}-${idx}`} title={item.title} subtitle={item.subtitle} />
      ))}
    </ScreenShell>
  );
}
