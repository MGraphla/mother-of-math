import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Award, TrendingUp, Star, BookCheck, GraduationCap } from "lucide-react";
import {
  Student,
  StudentAssignment,
  AssignmentSubmission,
  getStudentSession,
  getAssignmentsForStudent,
  getSubmissionsForStudent,
} from "@/services/studentService";

const StudentProgress = () => {
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
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
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading progress...</span>
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
    <div className="container py-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-primary" /> My Progress
        </h1>
        <p className="text-muted-foreground mt-1">Track your learning journey and achievements</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-5 pb-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-2">
              <BookCheck className="h-6 w-6 text-primary" />
            </div>
            <p className="text-3xl font-bold">{completionRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">Completion Rate</p>
            <Progress value={completionRate} className="h-2 mt-3" />
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="pt-5 pb-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <p className="text-3xl font-bold">{averageScore > 0 ? `${averageScore}%` : "\u2014"}</p>
            <p className="text-xs text-muted-foreground mt-1">Average Score</p>
            <Progress value={averageScore} className="h-2 mt-3" />
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="pt-5 pb-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Star className="h-6 w-6 text-primary" />
            </div>
            <p className="text-3xl font-bold">{completedCount}/{totalAssignments}</p>
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
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{subject.name}</span>
                  <div className="flex items-center gap-3">
                    {subject.avgScore !== null && (
                      <Badge variant="outline" className="text-xs">Avg: {subject.avgScore}%</Badge>
                    )}
                    <span className="text-muted-foreground text-xs">
                      {subject.submitted}/{subject.total} done
                    </span>
                    <span className="font-bold text-sm">{subject.progress}%</span>
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
                  <div key={sub.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 bg-primary/10 text-primary">
                      {score}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{assignment?.title || "Assignment"}</p>
                      <p className="text-xs text-muted-foreground">{assignment?.subject}</p>
                    </div>
                    {sub.teacher_feedback && (
                      <Badge variant="outline" className="text-xs shrink-0">Has Feedback</Badge>
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
