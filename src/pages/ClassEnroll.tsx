import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { submitEnrollmentRequest } from "@/services/studentService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, GraduationCap, CheckCircle2, ShieldAlert } from "lucide-react";
import { PRIMARY_GRADE_LEVELS } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Public enrollment page: /enroll/:code
 * Creates a pending enrollment request for the teacher who owns the code.
 */
const ClassEnroll = () => {
  const { code } = useParams<{ code: string }>();
  const joinCode = decodeURIComponent(code || "").trim();

  const [fullName, setFullName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [className, setClassName] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!joinCode) {
      setError("Missing class code in the URL.");
      return;
    }
    if (!fullName.trim() || !gradeLevel.trim()) {
      setError("Learner name and class level are required.");
      return;
    }
    setSubmitting(true);
    try {
      await submitEnrollmentRequest({
        joinCode,
        fullName: fullName.trim(),
        gradeLevel: gradeLevel.trim(),
        className: className.trim() || undefined,
        parentName: parentName.trim() || undefined,
        parentPhone: parentPhone.trim() || undefined,
        parentEmail: parentEmail.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Check the class code.";
      setError(msg.replace(/^RPC.*?: /, "").replace(/^.*Exception: /, "") || msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!joinCode) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-primary/5 via-background to-emerald-50 p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="pt-8 pb-6 text-center space-y-3">
            <ShieldAlert className="h-12 w-12 text-amber-600 mx-auto" />
            <h1 className="text-lg font-semibold">Invalid link</h1>
            <p className="text-sm text-muted-foreground">Ask your teacher for the full enrollment link.</p>
            <Button asChild variant="outline" className="mt-2">
              <Link to="/">Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-primary/5 via-background to-emerald-50 p-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="pt-10 pb-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>
            <h1 className="text-xl font-semibold">Request sent</h1>
            <p className="text-sm text-muted-foreground px-2">
              Your teacher will review this enrollment. You will hear from them when the learner account is ready.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-primary/5 via-background to-emerald-50 py-8 px-4 pt-[max(1.5rem,env(safe-area-inset-top,0px))]">
      <Card className="max-w-lg mx-auto border-0 shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <GraduationCap className="h-6 w-6" />
            <CardTitle className="text-xl">Request learner access</CardTitle>
          </div>
          <CardDescription>
            Your teacher invited you to this page. Submit the details below; they will approve and create the portal link.
          </CardDescription>
          <p className="text-xs text-muted-foreground font-mono">Class code: {joinCode}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="enroll-name">Learner full name *</Label>
              <Input
                id="enroll-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g., Nfor Che Junior"
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enroll-grade">Class / grade level *</Label>
              <Select value={gradeLevel} onValueChange={setGradeLevel}>
                <SelectTrigger id="enroll-grade">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {PRIMARY_GRADE_LEVELS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enroll-class">Class name (optional)</Label>
              <Input
                id="enroll-class"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g., Class 5A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enroll-parent">Parent / guardian name</Label>
              <Input
                id="enroll-parent"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Guardian full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enroll-phone">Parent phone</Label>
              <Input
                id="enroll-phone"
                type="tel"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="+237 …"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enroll-email">Parent email</Label>
              <Input
                id="enroll-email"
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder="parent@email.com"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enroll-notes">Note to teacher (optional)</Label>
              <Textarea
                id="enroll-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything your teacher should know"
                className="resize-none"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit request"
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Mother of Mathematics — Learner Portal
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClassEnroll;
