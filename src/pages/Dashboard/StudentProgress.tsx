import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Award, TrendingUp, Star, BookCheck, GraduationCap } from "lucide-react";
import {
  Learner,
  StudentAssignment,
  AssignmentSubmission,
  getStudentSession,
  getAssignmentsForStudent,
  getSubmissionsForStudent,
} from "@/services/studentService";

const StudentProgress = () => {
  const navigate = useNavigate();
  const [student, setStudent] = useState<Learner | null>(null);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const s = getStudentSession();
    if (!s) { navigate("/student-login", { replace: true }); return; }
    setStudent(s);
    loadData(s.id);
  }, []);

  const loadData = async (studentId: string) => {
    setIsLoading(true);
    try {
      const [a, sub] = await Promise.all([
        getAssignmentsForStudent(studentId),
        getSubmissionsForStudent(studentId),
      ]);
      setAssignments(a);
      setSubmissions(sub);
    } catch (e) {
      console.error("Error loading progress:", e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50dvh] flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-muted-foreground">
        <Loader2 className="h-8 w-8 shrink-0 animate-spin text-primary" />
        <span className="text-center text-sm font-medium sm:text-base">Loading progress...</span>
      </div>
    );
  }

  if (!student) return null;

  const totalAssignments = assignments.length;
  const completedCount = submissions.length;
  const gradedSubmissions = submissions.filter((s) => s.status === "graded");
  const completionRate = totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0;
  const averageScore = gradedSubmissions.length > 0
    ? Math.round(gradedSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / gradedSubmissions.length)
    : 0;

  // Group submissions by subject via assignments
  const subjectMap = new Map<string, { total: number; submitted: number; scores: number[] }>();
  assignments.forEach((a) => {
    const entry = subjectMap.get(a.subject) || { total: 0, submitted: 0, scores: [] };
    entry.total++;
    const sub = submissions.find((s) => s.assignment_id === a.id);
    if (sub) {
      entry.submitted++;
      if (sub.score !== null) entry.scores.push(sub.score);
    }
    subjectMap.set(a.subject, entry);
  });

  const subjects = Array.from(subjectMap.entries()).map(([name, data]) => ({
    name,
    progress: data.total > 0 ? Math.round((data.submitted / data.total) * 100) : 0,
    avgScore: data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : null,
    total: data.total,
    submitted: data.submitted,
  }));

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-3 px-1 pb-8 xs:px-2 sm:space-y-5 sm:px-4 sm:pb-16">
      <div className="relative overflow-hidden rounded-xl bg-primary px-3 py-4 text-primary-foreground shadow-lg sm:rounded-2xl sm:px-6 sm:py-8">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10 hidden sm:block" />
        <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-white/5 hidden sm:block" />
        <div className="relative z-10">
          <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/60">Your learning</p>
          <h1 className="mt-0.5 sm:mt-1 flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight sm:text-2xl md:text-3xl leading-tight">
            <TrendingUp className="h-6 w-6 shrink-0 text-primary-foreground/90 sm:h-8 sm:w-8" /> <span>My progress</span>
          </h1>
          <p className="text-primary-foreground/75 text-xs sm:text-sm mt-1 sm:mt-2 max-w-lg hidden sm:block">
            See how much work you have finished and how you are doing on your scores. Numbers update when you submit and when your teacher grades your work.
          </p>
        </div>
      </div>

      {/* Overview Stats — slim strip on phones */}
      <div className="sm:hidden rounded-lg border bg-muted/40 divide-x divide-border flex text-center">
        <div className="flex-1 min-w-0 py-2 px-1">
          <p className="text-[9px] text-muted-foreground font-medium">Done %</p>
          <p className="text-sm font-bold tabular-nums">{completionRate}%</p>
        </div>
        <div className="flex-1 min-w-0 py-2 px-1">
          <p className="text-[9px] text-muted-foreground font-medium">Avg</p>
          <p className="text-sm font-bold tabular-nums">{averageScore > 0 ? `${averageScore}%` : "—"}</p>
        </div>
        <div className="flex-1 min-w-0 py-2 px-1">
          <p className="text-[9px] text-muted-foreground font-medium">Work</p>
          <p className="text-sm font-bold tabular-nums">{completedCount}/{totalAssignments}</p>
        </div>
      </div>
      <div className="hidden sm:grid sm:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-5 pb-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-2">
              <BookCheck className="h-6 w-6 text-primary" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{completionRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">Completion Rate</p>
            <Progress value={completionRate} className="h-2 mt-3" />
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="pt-5 pb-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{averageScore > 0 ? `${averageScore}%` : "\u2014"}</p>
            <p className="text-xs text-muted-foreground mt-1">Average Score</p>
            <Progress value={averageScore} className="h-2 mt-3" />
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="pt-5 pb-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Star className="h-6 w-6 text-primary" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{completedCount}/{totalAssignments}</p>
            <p className="text-xs text-muted-foreground mt-1">Assignments Done</p>
          </CardContent>
        </Card>
      </div>

      {/* Subject Breakdown */}
      {subjects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Subject Progress</CardTitle>
            <CardDescription>Your performance across different subjects</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {subjects.map((subject) => (
              <div key={subject.name} className="space-y-2">
                <div className="flex flex-col gap-2 text-sm min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between">
                  <span className="min-w-0 shrink font-medium leading-tight">{subject.name}</span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-3">
                    {subject.avgScore !== null && (
                      <Badge variant="outline" className="text-xs">Avg: {subject.avgScore}%</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {subject.submitted}/{subject.total} done
                    </span>
                    <span className="text-sm font-bold tabular-nums">{subject.progress}%</span>
                  </div>
                </div>
                <Progress value={subject.progress} className="h-2.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Graded Assignments */}
      {gradedSubmissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" /> Graded Assignments
            </CardTitle>
            <CardDescription>Assignments that have been reviewed by your teacher</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {gradedSubmissions.map((sub) => {
                const assignment = assignments.find((a) => a.id === sub.assignment_id);
                const score = sub.score || 0;
                return (
                  <div key={sub.id} className="flex flex-col gap-3 rounded-lg bg-muted/30 p-3 min-[360px]:flex-row min-[360px]:items-center min-[360px]:gap-4">
                    <div className="flex w-full min-w-0 items-center gap-3 min-[360px]:flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {score}%
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium min-[360px]:truncate min-[360px]:line-clamp-none">{assignment?.title || "Assignment"}</p>
                        <p className="text-xs text-muted-foreground">{assignment?.subject}</p>
                      </div>
                    </div>
                    {sub.teacher_feedback && (
                      <Badge variant="outline" className="w-fit shrink-0 text-xs">Has Feedback</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {totalAssignments === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <TrendingUp className="h-14 w-14 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No progress data yet</h3>
            <p className="text-sm text-muted-foreground">
              Once your teacher assigns work and you submit it, your progress will appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StudentProgress;
