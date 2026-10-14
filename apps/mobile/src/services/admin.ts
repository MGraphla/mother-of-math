import { supabase } from "../lib/supabase";

export interface AdminOverview {
  teachers: number;
  students: number;
  lessonPlans: number;
  assignments: number;
  submissions: number;
  conversations: number;
  messages: number;
  resources: number;
  announcements: number;
}

const num = (value: unknown) => Number(value ?? 0) || 0;

/**
 * Normalised counts for the console dashboards. Mirrors the web's
 * `getAdminDashboardOverview`: the RPC bypasses RLS, direct counts are the
 * fallback when it isn't deployed.
 */
export const fetchAdminOverview = async (): Promise<AdminOverview> => {
  const { data, error } = await supabase.rpc("get_admin_counts");
  const row = Array.isArray(data) ? data[0] : data;
  if (!error && row) {
    return {
      teachers: num(row.teachers_count),
      students: num(row.students_count),
      lessonPlans: num(row.lesson_plans_count),
      assignments: num(row.assignments_count),
      submissions: num(row.submissions_count),
      conversations: num(row.conversations_count),
      messages: num(row.messages_count),
      resources: num(row.resources_count),
      announcements: num(row.announcements_count),
    };
  }

  const head = (table: string, filter?: { column: string; value: string }) => {
    const query = supabase.from(table).select("*", { count: "exact", head: true });
    return filter ? query.eq(filter.column, filter.value) : query;
  };

  const [
    teachers,
    students,
    lessonPlans,
    assignments,
    submissions,
    conversations,
    messages,
    resources,
    announcements,
  ] = await Promise.all([
    head("profiles", { column: "role", value: "teacher" }),
    head("students"),
    head("lesson_plans"),
    head("assignments"),
    head("assignment_submissions"),
    head("conversations"),
    head("conversation_messages"),
    head("resources"),
    head("announcements"),
  ]);

  return {
    teachers: teachers.count ?? 0,
    students: students.count ?? 0,
    lessonPlans: lessonPlans.count ?? 0,
    assignments: assignments.count ?? 0,
    submissions: submissions.count ?? 0,
    conversations: conversations.count ?? 0,
    messages: messages.count ?? 0,
    resources: resources.count ?? 0,
    announcements: announcements.count ?? 0,
  };
};

export interface ActivityTrendPoint {
  date: string;
  lessonPlans: number;
  assignments: number;
  submissions: number;
  messages: number;
}

export const fetchActivityTrends = async (days = 14): Promise<ActivityTrendPoint[]> => {
  const { data, error } = await supabase.rpc("get_activity_trends", { days_lookback: days });
  if (!error && Array.isArray(data)) {
    return data.map((row: Record<string, unknown>) => ({
      date: String(row.activity_date ?? ""),
      lessonPlans: num(row.lesson_plans),
      assignments: num(row.assignments),
      submissions: num(row.submissions),
      messages: num(row.messages),
    }));
  }

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [plans, assignments, submissions] = await Promise.all([
    supabase.from("lesson_plans").select("created_at").gte("created_at", since),
    supabase.from("assignments").select("created_at").gte("created_at", since),
    supabase.from("assignment_submissions").select("submitted_at").gte("submitted_at", since),
  ]);

  const buckets = new Map<string, ActivityTrendPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    buckets.set(key, { date: key, lessonPlans: 0, assignments: 0, submissions: 0, messages: 0 });
  }

  const tally = (rows: { created_at?: string; submitted_at?: string }[] | null, key: keyof ActivityTrendPoint) => {
    (rows ?? []).forEach((row) => {
      const stamp = (row.created_at ?? row.submitted_at ?? "").slice(0, 10);
      const bucket = buckets.get(stamp);
      if (bucket && key !== "date") bucket[key] += 1;
    });
  };

  tally(plans.data, "lessonPlans");
  tally(assignments.data, "assignments");
  tally(submissions.data, "submissions");

  return Array.from(buckets.values());
};

export const fetchAdminCounts = async () => {
  const { data, error } = await supabase.rpc("get_comprehensive_admin_counts");
  if (!error && data) return data as Record<string, number>;

  const [teachers, students, assignments, lessonPlans] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "teacher"),
    supabase.from("students").select("*", { count: "exact", head: true }),
    supabase.from("assignments").select("*", { count: "exact", head: true }),
    supabase.from("lesson_plans").select("*", { count: "exact", head: true }),
  ]);

  return {
    teachers: teachers.count ?? 0,
    students: students.count ?? 0,
    assignments: assignments.count ?? 0,
    lesson_plans: lessonPlans.count ?? 0,
  };
};

export const fetchAllTeachers = async () => {
  const { data, error } = await supabase.rpc("get_all_teachers");
  if (!error && data) return data as any[];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,email,school_name,country,created_at")
    .eq("role", "teacher")
    .order("created_at", { ascending: false });
  if (profileError) throw profileError;
  return profiles ?? [];
};

export const fetchAllStudentsAdmin = async () => {
  const { data, error } = await supabase.rpc("get_all_students_full");
  if (!error && data) return data as any[];

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id,full_name,grade_level,class_name,account_status,teacher_id,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (studentsError) throw studentsError;
  return students ?? [];
};

export const fetchAllAssignmentsAdmin = async () => {
  const { data, error } = await supabase.rpc("get_all_assignments");
  if (!error && data) return data as any[];
  const { data: rows, error: e2 } = await supabase
    .from("assignments")
    .select("id,title,grade_level,status,due_date,teacher_id,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (e2) throw e2;
  return rows ?? [];
};

export const fetchAllLessonPlansAdmin = async () => {
  const { data, error } = await supabase.rpc("get_all_lesson_plans");
  if (!error && data) return data as any[];
  const { data: rows, error: e2 } = await supabase
    .from("lesson_plans")
    .select("id,title,level,user_id,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (e2) throw e2;
  return rows ?? [];
};

export const fetchAllResourcesAdmin = async () => {
  const { data, error } = await supabase.rpc("get_all_resources");
  if (!error && data) return data as any[];
  const { data: rows, error: e2 } = await supabase
    .from("resources")
    .select("id,title,file_type,teacher_id,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (e2) throw e2;
  return rows ?? [];
};

export const fetchAllAnnouncementsAdmin = async () => {
  const { data, error } = await supabase.rpc("get_all_announcements");
  if (!error && data) return data as any[];
  const { data: rows, error: e2 } = await supabase
    .from("announcements")
    .select("id,title,category,teacher_id,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (e2) throw e2;
  return rows ?? [];
};

export const fetchAllSubmissionsAdmin = async () => {
  const { data, error } = await supabase.rpc("get_all_submissions");
  if (!error && data) return data as any[];
  const { data: rows, error: e2 } = await supabase
    .from("assignment_submissions")
    .select("id,status,score,submitted_at,assignment_id,student_id")
    .order("submitted_at", { ascending: false })
    .limit(200);
  if (e2) throw e2;
  return rows ?? [];
};

export const fetchAllSchools = async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("school_name,school_type,city,country")
    .eq("role", "teacher")
    .not("school_name", "is", null);
  if (error) throw error;
  const map = new Map<string, any>();
  (data ?? []).forEach((row) => {
    const key = `${row.school_name}|${row.country}`;
    const existing = map.get(key);
    if (existing) existing.teacherCount += 1;
    else
      map.set(key, {
        name: row.school_name,
        type: row.school_type,
        city: row.city,
        country: row.country,
        teacherCount: 1,
      });
  });
  return Array.from(map.values());
};

export const fetchAllComments = async () => {
  const { data, error } = await supabase.rpc("get_all_comments");
  if (!error && data) return data as any[];
  const { data: rows, error: e2 } = await supabase
    .from("assignment_comments")
    .select("id,message,assignment_id,teacher_id,created_at,is_private")
    .order("created_at", { ascending: false })
    .limit(200);
  if (e2) throw e2;
  return rows ?? [];
};

export const fetchAllImages = async () => {
  const { data, error } = await supabase.rpc("get_all_images");
  if (!error && data) return data as any[];
  const { data: rows, error: e2 } = await supabase
    .from("generated_images")
    .select("id,prompt,image_url,user_id,created_at,description")
    .order("created_at", { ascending: false })
    .limit(200);
  if (e2) {
    const { data: fallback } = await supabase
      .from("student_works")
      .select("id,image_url,student_name,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return fallback ?? [];
  }
  return rows ?? [];
};

export const fetchTeachersByCountry = async () => {
  const teachers = await fetchAllTeachers();
  const map = new Map<string, number>();
  teachers.forEach((t: any) => {
    const country = t.country || "Unknown";
    map.set(country, (map.get(country) ?? 0) + 1);
  });
  return Array.from(map.entries()).map(([country, count]) => ({ country, count }));
};

export const fetchModerationFlags = async () => {
  const { data, error } = await supabase.rpc("get_all_content_flags");
  if (!error && data) return data as any[];
  const { data: rows } = await supabase
    .from("content_flags")
    .select("id,reason,status,content_type,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return rows ?? [];
};

export const createTeacherAccount = async (input: {
  email: string;
  password: string;
  full_name: string;
  school_name?: string;
  country?: string;
}) => {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.full_name,
        role: "teacher",
        school_name: input.school_name ?? null,
        country: input.country ?? "Cameroon",
      },
    },
  });
  if (error) throw error;
  if (data.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      email: input.email,
      full_name: input.full_name,
      role: "teacher",
      school_name: input.school_name ?? null,
      country: input.country ?? "Cameroon",
      updated_at: new Date().toISOString(),
    });
  }
  return data.user;
};

export const fetchAiUsageStats = async () => {
  const [conversations, messages, images, lessonPlans] = await Promise.all([
    supabase.from("conversations").select("*", { count: "exact", head: true }),
    supabase.from("conversation_messages").select("*", { count: "exact", head: true }),
    supabase.from("generated_images").select("*", { count: "exact", head: true }),
    supabase.from("lesson_plans").select("*", { count: "exact", head: true }),
  ]);
  return {
    conversations: conversations.count ?? 0,
    messages: messages.count ?? 0,
    images: images.count ?? 0,
    lesson_plans: lessonPlans.count ?? 0,
  };
};

export const fetchTeacherPerformance = async () => {
  const teachers = await fetchAllTeachers();
  return Promise.all(
    teachers.slice(0, 50).map(async (t: any) => {
      const id = t.id ?? t.teacher_id;
      const [students, assignments, plans] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }).eq("teacher_id", id),
        supabase.from("assignments").select("*", { count: "exact", head: true }).eq("teacher_id", id),
        supabase.from("lesson_plans").select("*", { count: "exact", head: true }).eq("user_id", id),
      ]);
      return {
        id,
        name: t.full_name ?? t.teacher_name ?? "Teacher",
        students: students.count ?? 0,
        assignments: assignments.count ?? 0,
        lessonPlans: plans.count ?? 0,
        school: t.school_name ?? "",
      };
    }),
  );
};

export const fetchStudentPerformance = async () => {
  const students = await fetchAllStudentsAdmin();
  return students.slice(0, 100).map((s: any) => ({
    id: s.id,
    name: s.full_name ?? "Student",
    grade: s.grade_level ?? "",
    status: s.account_status ?? "",
    className: s.class_name ?? "",
  }));
};

export const fetchSystemHealth = async () => {
  const checks = await Promise.allSettled([
    supabase.from("profiles").select("id", { head: true, count: "exact" }),
    supabase.from("students").select("id", { head: true, count: "exact" }),
    supabase.from("assignments").select("id", { head: true, count: "exact" }),
  ]);
  return checks.map((c, i) => ({
    name: ["profiles", "students", "assignments"][i],
    ok: c.status === "fulfilled" && !(c.value as any).error,
  }));
};
