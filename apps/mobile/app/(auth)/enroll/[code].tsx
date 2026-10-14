import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { AuthShell } from "../../../src/components/AuthShell";
import { Field, PrimaryButton, showError, showSuccess } from "../../../src/components/ScreenKit";
import { supabase } from "../../../src/lib/supabase";

export default function ClassEnrollCodeScreen() {
  const { code: routeCode } = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(typeof routeCode === "string" ? routeCode : "");
  const [fullName, setFullName] = useState("");
  const [grade, setGrade] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof routeCode === "string" && routeCode) setCode(routeCode);
  }, [routeCode]);

  return (
    <AuthShell title="Join a class" subtitle="Request enrollment with your teacher's join code">
      <Field value={code} onChangeText={setCode} placeholder="Class join code" autoCapitalize="characters" />
      <Field value={fullName} onChangeText={setFullName} placeholder="Your full name" autoCapitalize="words" />
      <Field value={grade} onChangeText={setGrade} placeholder="Grade level" />
      <PrimaryButton
        label={submitting ? "Submitting…" : "Request to join"}
        disabled={submitting}
        onPress={async () => {
          if (!code.trim() || !fullName.trim()) {
            showError("Missing details", new Error("Enter join code and full name."));
            return;
          }
          setSubmitting(true);
          try {
            const { error } = await supabase.rpc("submit_enrollment_request", {
              p_join_code: code.trim(),
              p_full_name: fullName.trim(),
              p_grade_level: grade.trim() || null,
            });
            if (error) {
              const { data: teacher } = await supabase
                .from("profiles")
                .select("id")
                .eq("class_join_code", code.trim())
                .maybeSingle();
              if (!teacher) throw error;
              const { error: e2 } = await supabase.from("enrollment_requests").insert({
                teacher_id: teacher.id,
                full_name: fullName.trim(),
                grade_level: grade.trim() || null,
                status: "pending",
              });
              if (e2) throw e2;
            }
            showSuccess("Submitted", "Enrollment request sent to your teacher.");
            router.replace("/(public)/welcome");
          } catch (e) {
            showError("Enrollment failed", e);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </AuthShell>
  );
}
