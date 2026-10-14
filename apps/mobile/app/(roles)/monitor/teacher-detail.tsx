import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { CardRow, ScreenShell } from "../../../src/components/ScreenKit";
import { supabase } from "../../../src/lib/supabase";

export default function MonitorTeacherDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<any>(null);
  const [stats, setStats] = useState({ students: 0, assignments: 0, plans: 0 });

  useEffect(() => {
    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,email,school_name,country,city")
        .eq("id", id)
        .maybeSingle();
      setTeacher(data);
      const [students, assignments, plans] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }).eq("teacher_id", id),
        supabase.from("assignments").select("*", { count: "exact", head: true }).eq("teacher_id", id),
        supabase.from("lesson_plans").select("*", { count: "exact", head: true }).eq("user_id", id),
      ]);
      setStats({
        students: students.count ?? 0,
        assignments: assignments.count ?? 0,
        plans: plans.count ?? 0,
      });
      setLoading(false);
    })();
  }, [id]);

  return (
    <ScreenShell title="Teacher Detail" loading={loading}>
      <CardRow title={teacher?.full_name ?? "Teacher"} subtitle={teacher?.email ?? ""} />
      <CardRow title="School" subtitle={`${teacher?.school_name ?? ""} · ${teacher?.city ?? ""} · ${teacher?.country ?? ""}`} />
      <CardRow title="Students" subtitle={String(stats.students)} />
      <CardRow title="Assignments" subtitle={String(stats.assignments)} />
      <CardRow title="Lesson plans" subtitle={String(stats.plans)} />
    </ScreenShell>
  );
}
