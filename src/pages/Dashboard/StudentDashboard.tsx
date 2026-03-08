import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { 
  Loader2, 
  GraduationCap, 
  BookCheck, 
  Clock, 
  CheckCircle2, 
  User, 
  ArrowRight,
  TrendingUp,
  Calendar,
  AlertCircle
} from "lucide-react";
import {
  Student,
  StudentAssignment,
  AssignmentSubmission,
  getStudentSession,
  refreshStudentSession,
  getAssignmentsForStudent,
  getSubmissionsForStudent,
} from "@/services/studentService";
import { cn } from "@/lib/utils";

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [student, setStudent] = useState<Student | null>(null);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      let s = getStudentSession();
      if (!s) {
        navigate("/student-login", { replace: true });
        return;
      }
      // Refresh from DB to get latest data
      const fresh = await refreshStudentSession();
      if (!fresh || fresh.account_status !== "active") {
        navigate("/student-login", { replace: true });
        return;
      }
      s = fresh;
      setStudent(s);

      const [a, sub] = await Promise.all([
        getAssignmentsForStudent(s.id),
        getSubmissionsForStudent(s.id),
      ]);
      setAssignments(a);
      setSubmissions(sub);
    } catch (e) {
      console.error("Error loading student dashboard:", e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground font-medium">{t('student.loadingDashboard')}</span>
      </div>
    );
  }

  if (!student) return null;

  const submittedIds = new Set(submissions.map((s) => s.assignment_id));
  const pendingAssignments = assignments
    .filter((a) => !submittedIds.has(a.id) && new Date(a.due_date) > new Date())
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    
  const overdueAssignments = assignments
    .filter((a) => !submittedIds.has(a.id) && new Date(a.due_date) < new Date())
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  
  const completedCount = submissions.length;
  const totalAssignments = assignments.length;
  const completionRate = totalAssignments > 0 ? Math.round((completedCount / totalAssignments) * 100) : 0;
  
  const gradedSubmissions = submissions.filter((s) => s.status === "graded");
  const averageScore = gradedSubmissions.length > 0
    ? Math.round(gradedSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / gradedSubmissions.length)
    : 0;

  // Get greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('student.goodMorning') : hour < 18 ? t('student.goodAfternoon') : t('student.goodEvening');

  return (
    <div className="container py-8 space-y-8 max-w-7xl animate-in fade-in duration-500 pb-20">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-8 md:p-10 gap-6">
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
               {student.profile_photo_url ? (
                  <img 
                    src={student.profile_photo_url} 
                    alt={student.full_name} 
                    className="h-20 w-20 md:h-24 md:w-24 rounded-full border-4 border-white/20 object-cover shadow-lg"
                  />
                ) : (
                  <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-white/20 flex items-center justify-center border-4 border-white/20 text-3xl font-bold backdrop-blur-sm shadow-lg">
                    {student.full_name.charAt(0)}
                  </div>
                )}
              <div className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-green-400 border-2 border-white"></div>
            </div>
            
            <div className="text-center md:text-left">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                {greeting}, {student.full_name.split(" ")[0]}!
              </h1>
              <p className="mt-2 text-primary-foreground/90 text-lg font-medium opacity-90">
                {t('common.youHave')} {pendingAssignments.length} {t('student.assignmentsPending')}.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-md px-3 py-1 text-sm font-normal">
                  {student.grade_level}
                </Badge>
                {student.class_name && (
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-md px-3 py-1 text-sm font-normal">
                    {student.class_name}
                  </Badge>
                )}
                <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-md px-3 py-1 text-sm font-normal">
                  {t('student.activeStudent')}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="hidden md:block">
            <Link to="/student/assignments">
              <Button size="lg" variant="secondary" className="font-semibold shadow-lg transition-all hover:scale-105 border-0">
                {t('student.startLearning')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatsCard 
          title={t('sidebar.assignments')} 
          value={totalAssignments} 
          icon={BookCheck} 
          description={t('student.totalAssigned')}
          color="bg-primary"
          lightColor="bg-primary/10 text-primary"
        />
        <StatsCard 
          title={t('student.pending')} 
          value={pendingAssignments.length} 
          icon={Clock} 
          description={t('student.dueSoon')}
          color="bg-amber-500"
          lightColor="bg-amber-50 text-amber-700"
        />
        <StatsCard 
          title={t('student.completed')} 
          value={completedCount} 
          icon={CheckCircle2} 
          description={`${completionRate}% ${t('student.completionRate')}`}
          color="bg-emerald-500"
          lightColor="bg-emerald-50 text-emerald-700"
        />
        <StatsCard 
          title={t('dashboard.averageScore')} 
          value={averageScore > 0 ? `${averageScore}%` : "N/A"} 
          icon={TrendingUp} 
          description={t('student.basedOnGraded')}
          color="bg-blue-500"
          lightColor="bg-blue-50 text-blue-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Recent/Upcoming Assignments */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> 
                {t('student.upcomingDueDates')}
              </h2>
              <Link to="/student/assignments" className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
                {t('student.viewAll')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {pendingAssignments.length === 0 ? (
              <Card className="border-dashed border-2 bg-gray-50/50 shadow-none">
                <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="p-4 bg-emerald-100 rounded-full">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">{t('student.allCaughtUp')}</h3>
                  <p className="text-muted-foreground max-w-xs">
                    {t('student.noPendingAssignments')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingAssignments.slice(0, 3).map((assignment) => {
                  const dueDate = new Date(assignment.due_date);
                  const isSoon = (dueDate.getTime() - Date.now()) < (1000 * 60 * 60 * 48); // 48 hours
                  
                  return (
                    <Card key={assignment.id} className="group overflow-hidden border-l-4 border-l-primary hover:shadow-lg transition-all duration-300">
                      <CardContent className="p-0">
                        <div className="flex flex-col sm:flex-row">
                          <div className="p-5 flex-1 space-y-1">
                            <div className="flex items-center gap-2 mb-2">
                              {/* Using simple badges for now */}
                              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{assignment.subject}</Badge>
                              {isSoon && (
                                <Badge variant="destructive" className="animate-pulse">Due Soon</Badge>
                              )}
                            </div>
                            <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">{assignment.title}</h3>
                            <p className="text-muted-foreground line-clamp-2 text-sm">
                              {/* Assuming description snippet or generic text */}
                              Check the assignment details for instructions and materials.
                            </p>
                          </div>
                          <div className="bg-gray-50 p-5 flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-3 border-t sm:border-t-0 sm:border-l sm:w-40 shrink-0">
                            <div className="text-center">
                              <span className="text-xs text-muted-foreground uppercase font-semibold">Due Date</span>
                              <div className="font-bold text-gray-700 mt-1 flex items-center justify-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {format(dueDate, "MMM d")}
                              </div>
                            </div>
                            <Link to={`/student/assignments`} className="w-full">
                              <Button size="sm" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                                Open
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Overdue Warning Section (if any) */}
          {overdueAssignments.length > 0 && (
             <section className="space-y-4">
               <h2 className="text-xl font-bold text-red-600 flex items-center gap-2">
                 <AlertCircle className="h-5 w-5" /> 
                 Overdue Assignments
               </h2>
               <div className="grid gap-3">
                 {overdueAssignments.slice(0, 2).map((assignment) => (
                   <Card key={assignment.id} className="border-l-4 border-l-red-500 bg-red-50/30">
                     <CardContent className="p-4 flex items-center justify-between gap-4">
                       <div>
                         <p className="font-semibold text-gray-800">{assignment.title}</p>
                         <p className="text-sm text-red-600 font-medium">
                           Due {format(new Date(assignment.due_date), "MMM d, yyyy")}
                         </p>
                       </div>
                       <Button variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-100" onClick={() => navigate("/student/assignments")}>
                         View
                       </Button>
                     </CardContent>
                   </Card>
                 ))}
               </div>
             </section>
          )}

        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          
          {/* Quick Actions */}
          <Card className="overflow-hidden shadow-sm border-0 bg-white ring-1 ring-gray-200">
             <CardHeader className="bg-gray-50/50 pb-4 border-b">
               <CardTitle className="text-lg font-bold flex items-center gap-2">
                 Quick Actions
               </CardTitle>
             </CardHeader>
             <CardContent className="p-4 grid grid-cols-2 gap-3">
               <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all" onClick={() => navigate("/student/assignments")}>
                 <BookCheck className="h-6 w-6" />
                 <span className="text-xs font-semibold">Assignments</span>
               </Button>
               <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all" onClick={() => navigate("/student/profile")}>
                 <User className="h-6 w-6" />
                 <span className="text-xs font-semibold">Profile</span>
               </Button>
               {/* Add more quick actions if needed */}
             </CardContent>
          </Card>

          {/* Recent Grades */}
          <Card className="overflow-hidden shadow-sm border-0 bg-white ring-1 ring-gray-200">
            <CardHeader className="bg-gray-50/50 pb-4 border-b">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-emerald-600" />
                Recent Grades
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {gradedSubmissions.length > 0 ? (
                <div className="divide-y text-left">
                  {gradedSubmissions.slice(0, 5).map((sub) => {
                     const assignment = assignments.find((a) => a.id === sub.assignment_id);
                     const isGoodScore = (sub.score || 0) >= 80;
                     return (
                       <div key={sub.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                         <div className="min-w-0 pr-4">
                           <p className="font-medium text-sm truncate text-gray-900">{assignment?.title || "Assignment"}</p>
                           <p className="text-xs text-muted-foreground mt-0.5">
                             {format(new Date(sub.submitted_at), "MMM d")}
                           </p>
                         </div>
                         <div className={cn(
                           "h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm",
                           isGoodScore ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                         )}>
                           {sub.score}
                         </div>
                       </div>
                     );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No graded assignments yet.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Motivational Quote */}
          <Card className="bg-primary text-primary-foreground border-0 shadow-lg relative overflow-hidden">
             <div className="absolute top-0 right-0 -mt-6 -mr-6 h-24 w-24 bg-white/20 rounded-full blur-xl"></div>
             <CardContent className="p-6 relative z-10 text-center">
               <p className="text-lg font-serif italic mb-2">"Mathematics is the language with which God has written the universe."</p>
               <p className="text-sm text-primary-foreground/90 font-semibold">— Galileo Galilei</p>
             </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
  color: string;
  lightColor: string;
}

const StatsCard = ({ title, value, icon: Icon, description, color, lightColor }: StatsCardProps) => (
  <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-gray-200 hover:ring-primary/40 hover:shadow-md transition-all duration-300 group">
    <CardContent className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1 group-hover:text-primary transition-colors">{title}</p>
          <h3 className="text-2xl font-bold tracking-tight text-gray-900">{value}</h3>
        </div>
        <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110", lightColor)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <div className="mt-4 flex items-center text-xs">
        <span className={cn("inline-block h-1.5 w-1.5 rounded-full mr-2", color)}></span>
        <span className="text-muted-foreground font-medium">{description}</span>
      </div>
    </CardContent>
  </Card>
);

export default StudentDashboard;
