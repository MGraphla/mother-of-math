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
  Learner,
  StudentAssignment,
  AssignmentSubmission,
  getStudentSession,
  refreshStudentSession,
  getAssignmentsForStudent,
  getSubmissionsForStudent,
} from "@/services/studentService";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const StudentDashboard = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [student, setStudent] = useState<Learner | null>(null);
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
      <div className="mx-auto flex min-h-[50dvh] w-full max-w-7xl flex-wrap items-center justify-center gap-3 rounded-2xl border border-border bg-background/95 px-4 py-16 text-muted-foreground shadow-sm lg:my-1">
        <Loader2 className="h-8 w-8 shrink-0 animate-spin text-primary" />
        <span className="max-w-[16rem] text-center text-sm font-medium sm:text-base">{t('student.loadingDashboard')}</span>
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
    <motion.div
      className="mx-auto flex min-h-0 w-full min-w-0 max-w-7xl flex-1 flex-col space-y-3 rounded-2xl border border-border bg-background/95 px-2 py-2 pb-4 shadow-sm xs:space-y-5 xs:px-3 xs:py-3 sm:space-y-6 sm:px-5 sm:py-6 md:space-y-8 md:py-8 lg:my-1 lg:border-border/80 lg:px-6 lg:shadow-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Welcome Banner */}
      <motion.div
        className="relative overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-lg sm:rounded-2xl"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
      >
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col items-center justify-between gap-3 p-4 sm:p-8 md:flex-row sm:gap-5 md:p-10 md:gap-6">
          <div className="flex w-full min-w-0 flex-col items-center gap-3 xs:flex-row xs:items-center sm:gap-6 md:w-auto">
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
            
            <div className="min-w-0 text-center md:text-left">
              <h1 className="break-words text-xl font-bold tracking-tight sm:text-3xl md:text-4xl leading-tight">
                {greeting}, {student.full_name.split(" ")[0]}!
              </h1>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base font-medium text-primary-foreground/90 opacity-90 md:text-lg line-clamp-2 sm:line-clamp-none">
                {t('common.youHave')} {pendingAssignments.length} {t('student.assignmentsPending')}.
              </p>
              <div className="mt-2 sm:mt-4 flex flex-wrap justify-center gap-1.5 sm:gap-2 md:justify-start">
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
          
          <div className="flex w-full flex-col gap-2 xs:flex-row xs:justify-center md:w-auto md:block">
            <Link to="/student/assignments" className="w-full md:w-auto">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ type: "spring", stiffness: 450, damping: 22 }}>
                <Button size="lg" variant="secondary" className="h-12 w-full touch-manipulation border-0 font-semibold shadow-lg md:w-auto">
                  {t('student.startLearning')}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Stats — one row on small screens */}
      <div className="md:hidden rounded-lg border bg-muted/50 divide-x divide-border flex text-center text-[9px]">
        {[
          { l: t('sidebar.assignments').slice(0, 4), v: totalAssignments },
          { l: t('student.pending').slice(0, 4), v: pendingAssignments.length },
          { l: t('student.completed').slice(0, 4), v: completedCount },
          { l: "Avg", v: averageScore > 0 ? `${averageScore}%` : "—" },
        ].map((row) => (
          <div key={row.l} className="flex-1 min-w-0 py-2 px-0.5">
            <p className="text-muted-foreground font-medium leading-none line-clamp-1">{row.l}</p>
            <p className="text-xs font-bold tabular-nums mt-0.5 leading-none">{row.v}</p>
          </div>
        ))}
      </div>
      <div className="hidden md:grid md:grid-cols-4 gap-6">
        {[
          { title: t('sidebar.assignments'), value: totalAssignments, icon: BookCheck, description: t('student.totalAssigned'), color: "bg-primary", lightColor: "bg-primary/10 text-primary" },
          { title: t('student.pending'), value: pendingAssignments.length, icon: Clock, description: t('student.dueSoon'), color: "bg-amber-500", lightColor: "bg-amber-50 text-amber-700" },
          { title: t('student.completed'), value: completedCount, icon: CheckCircle2, description: `${completionRate}% ${t('student.completionRate')}`, color: "bg-emerald-500", lightColor: "bg-emerald-50 text-emerald-700" },
          { title: t('dashboard.averageScore'), value: averageScore > 0 ? `${averageScore}%` : "N/A", icon: TrendingUp, description: t('student.basedOnGraded'), color: "bg-blue-500", lightColor: "bg-blue-50 text-blue-700" },
        ].map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 + i * 0.07, type: "spring", stiffness: 380, damping: 28 }}
          >
            <StatsCard title={s.title} value={s.value} icon={s.icon} description={s.description} color={s.color} lightColor={s.lightColor} />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        {/* Main Content Area */}
        <div className="min-w-0 space-y-6 lg:col-span-2 lg:space-y-8">
          
          {/* Recent/Upcoming Assignments */}
          <section className="space-y-4">
            <div className="flex flex-col gap-3 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 sm:text-xl">
                <Clock className="h-5 w-5 shrink-0 text-primary" /> 
                <span className="min-w-0">{t('student.upcomingDueDates')}</span>
              </h2>
              <Link to="/student/assignments" className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80 touch-manipulation">
                {t('student.viewAll')} <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            </div>

            {pendingAssignments.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
              >
              <Card className="border-dashed border-2 bg-gray-50/50 shadow-none">
                <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <motion.div
                    className="rounded-full bg-emerald-100 p-4"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.12 }}
                  >
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </motion.div>
                  <h3 className="text-lg font-medium text-gray-900">{t('student.allCaughtUp')}</h3>
                  <p className="text-muted-foreground max-w-xs">
                    {t('student.noPendingAssignments')}
                  </p>
                </CardContent>
              </Card>
              </motion.div>
            ) : (
              <div className="grid gap-4">
                {pendingAssignments.slice(0, 3).map((assignment, idx) => {
                  const dueDate = new Date(assignment.due_date);
                  const isSoon = (dueDate.getTime() - Date.now()) < (1000 * 60 * 60 * 48); // 48 hours
                  
                  return (
                    <motion.div
                      key={assignment.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.06, type: "spring", stiffness: 360, damping: 28 }}
                      whileHover={{ y: -3 }}
                    >
                    <Card className="group overflow-hidden border-l-4 border-l-primary transition-shadow duration-300 hover:shadow-lg">
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
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Overdue Warning Section (if any) */}
          {overdueAssignments.length > 0 && (
             <section className="space-y-4">
               <h2 className="flex items-center gap-2 text-lg font-bold text-red-600 sm:text-xl">
                 <AlertCircle className="h-5 w-5 shrink-0" /> 
                 Overdue Assignments
               </h2>
               <div className="grid gap-3">
                 {overdueAssignments.slice(0, 2).map((assignment) => (
                   <Card key={assignment.id} className="border-l-4 border-l-red-500 bg-red-50/30">
                     <CardContent className="flex flex-col gap-3 p-4 min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between">
                       <div className="min-w-0">
                         <p className="font-semibold text-gray-800 break-words">{assignment.title}</p>
                         <p className="text-sm font-medium text-red-600">
                           Due {format(new Date(assignment.due_date), "MMM d, yyyy")}
                         </p>
                       </div>
                       <Button variant="outline" size="sm" className="h-10 w-full touch-manipulation border-red-200 text-red-700 hover:bg-red-100 min-[400px]:w-auto shrink-0" onClick={() => navigate("/student/assignments")}>
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
        <div className="min-w-0 space-y-6">
          
          {/* Quick Actions */}
          <Card className="overflow-hidden shadow-sm border-0 bg-white ring-1 ring-gray-200">
             <CardHeader className="bg-gray-50/50 pb-4 border-b">
               <CardTitle className="text-lg font-bold flex items-center gap-2">
                 Quick Actions
               </CardTitle>
             </CardHeader>
             <CardContent className="grid grid-cols-2 gap-3 p-4">
               <Button variant="outline" className="flex h-auto min-h-[5.5rem] touch-manipulation flex-col gap-2 py-4 transition-all hover:border-primary/20 hover:bg-primary/5 hover:text-primary" onClick={() => navigate("/student/assignments")}>
                 <BookCheck className="h-6 w-6" />
                 <span className="text-xs font-semibold">Assignments</span>
               </Button>
               <Button variant="outline" className="flex h-auto min-h-[5.5rem] touch-manipulation flex-col gap-2 py-4 transition-all hover:border-primary/20 hover:bg-primary/5 hover:text-primary" onClick={() => navigate("/student/profile")}>
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
    </motion.div>
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
  <Card className="group overflow-hidden border-0 shadow-sm ring-1 ring-gray-200 transition-all duration-300 hover:shadow-md hover:ring-primary/40">
    <CardContent className="p-3 sm:p-5">
      <div className="flex items-center justify-between">
        <div className="min-w-0 pr-2">
          <p className="mb-0.5 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-primary sm:text-sm">{title}</p>
          <h3 className="text-lg font-bold tracking-tight text-gray-900 sm:text-2xl">{value}</h3>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-110 sm:h-12 sm:w-12", lightColor)}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
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
