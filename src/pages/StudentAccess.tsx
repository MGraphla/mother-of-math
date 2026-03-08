import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getStudentByToken, setStudentSession } from "@/services/studentService";
import { Loader2, ShieldAlert, GraduationCap, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Status = "loading" | "success" | "paused" | "not-found" | "error";

const StudentAccess = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    const validateToken = async () => {
      if (!token) { setStatus("not-found"); return; }

      try {
        const student = await getStudentByToken(token);

        if (!student) {
          setStatus("not-found");
          return;
        }

        if (student.account_status === "paused" || student.account_status === "suspended") {
          setStudentName(student.full_name);
          setStatus("paused");
          return;
        }

        // Valid active student — store session & redirect
        setStudentSession(student);
        setStudentName(student.full_name);
        setStatus("success");

        // Brief delay so user sees the welcome before redirect
        setTimeout(() => {
          navigate("/student", { replace: true });
        }, 1500);
      } catch (e) {
        console.error("Magic link error:", e);
        setStatus("error");
      }
    };

    validateToken();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-emerald-50 p-4">
      <Card className="max-w-md w-full shadow-xl border-0">
        <CardContent className="pt-10 pb-8 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-14 w-14 animate-spin text-primary mx-auto" />
              <h2 className="text-xl font-semibold">Opening your dashboard...</h2>
              <p className="text-muted-foreground text-sm">Please wait while we verify your access link.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-9 w-9 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold">Welcome, {studentName}!</h2>
              <p className="text-muted-foreground text-sm">Taking you to your dashboard...</p>
            </>
          )}

          {status === "paused" && (
            <>
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                <ShieldAlert className="h-9 w-9 text-amber-600" />
              </div>
              <h2 className="text-xl font-semibold">Account Paused</h2>
              <p className="text-muted-foreground text-sm">
                Hi {studentName}, your account has been temporarily paused by your teacher. Please contact your teacher for more information.
              </p>
            </>
          )}

          {status === "not-found" && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <ShieldAlert className="h-9 w-9 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold">Invalid Link</h2>
              <p className="text-muted-foreground text-sm">
                This access link is not valid or has expired. Please ask your teacher for a new link.
              </p>
              <Button variant="outline" onClick={() => navigate("/")} className="mt-2">Go Home</Button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <ShieldAlert className="h-9 w-9 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold">Something went wrong</h2>
              <p className="text-muted-foreground text-sm">
                We couldn't verify your access link. Please try again or contact your teacher.
              </p>
              <Button variant="outline" onClick={() => window.location.reload()} className="mt-2">Try Again</Button>
            </>
          )}

          <div className="pt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <GraduationCap className="h-4 w-4" />
            <span>Mother of Mathematics — Student Portal</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentAccess;
