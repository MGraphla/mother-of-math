import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, ClipboardCheck, Star, BookOpen } from 'lucide-react';

export default function Overview() {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalStudents: 0,
    assignmentsGraded: 0,
    averageScore: 0,
    lessonPlansCreated: 0,
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // 1. Fetch Total Learner
        const { count: studentsCount, error: studentsError } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_id', user.id);

        if (studentsError) throw studentsError;

        // 2. Fetch Assignments Graded & Average Score
        // First get all assignments for this teacher
        const { data: assignments, error: assignmentsError } = await supabase
          .from('assignments')
          .select('id')
          .eq('teacher_id', user.id);

        if (assignmentsError) throw assignmentsError;

        let gradedCount = 0;
        let totalScore = 0;
        let scoreCount = 0;
        let submissionsData: any[] = [];
        let monthlyData: Record<string, { total: number; count: number }> = {};

        if (assignments && assignments.length > 0) {
          const assignmentIds = assignments.map(a => a.id);

          // Get submissions for these assignments
          const { data: submissions, error: submissionsError } = await supabase
            .from('assignment_submissions')
            .select(`
              id,
              score,
              status,
              submitted_at,
              graded_at,
              students ( full_name ),
              assignments ( title, max_score )
            `)
            .in('assignment_id', assignmentIds)
            .order('submitted_at', { ascending: false });

          if (submissionsError) throw submissionsError;

          if (submissions) {
            const scoreToPercentage = (rawScore: number, maxScore: unknown): number => {
              const n = Number(rawScore);
              if (!Number.isFinite(n)) return 0;
              const max =
                maxScore != null && Number(maxScore) > 0 ? Number(maxScore) : 10;
              return Math.min(100, Math.max(0, (n / max) * 100));
            };

            // Process submissions for stats
            submissions.forEach((sub: any) => {
              if (sub.status === 'graded') {
                gradedCount++;
                if (sub.score !== null && sub.score !== undefined) {
                  const max = sub.assignments?.max_score;
                  const pct = scoreToPercentage(Number(sub.score), max);
                  totalScore += pct;
                  scoreCount++;

                  // Chart buckets: YYYY-MM (locale-agnostic — avoids "Jan" vs "janv." mismatch)
                  const date = new Date(sub.graded_at || sub.submitted_at);
                  const y = date.getFullYear();
                  const m = date.getMonth();
                  const key = `${y}-${String(m + 1).padStart(2, '0')}`;
                  if (!monthlyData[key]) {
                    monthlyData[key] = { total: 0, count: 0 };
                  }
                  monthlyData[key].total += pct;
                  monthlyData[key].count++;
                }
              }
            });

            // Format recent submissions
            submissionsData = submissions.slice(0, 5).map(sub => ({
              student: sub.students?.full_name || 'Unknown Learner',
              assignment: sub.assignments?.title || 'Unknown Assignment',
              status: sub.status === 'graded' ? 'Graded' : sub.status === 'returned' ? 'Returned' : 'Pending',
              score: sub.score !== null ? `${sub.score}/10` : '-' // Assuming max score is 10 for display, adjust if needed
            }));
          }
        }

        // 3. Fetch Lesson Plans Created
        const { count: lessonPlansCount, error: lessonPlansError } = await supabase
          .from('lesson_plans')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (lessonPlansError) console.warn("Error fetching lesson plans:", lessonPlansError);

        // Format chart data — last 6 calendar months, keys aligned with aggregation
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const now = new Date();
        const chartDataFormatted: { name: string; score: number; ym: string }[] = [];

        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const y = d.getFullYear();
          const monthIndex = d.getMonth();
          const ym = `${y}-${String(monthIndex + 1).padStart(2, '0')}`;
          const monthName = months[monthIndex];
          const monthStats = monthlyData[ym];
          const avgPct =
            monthStats && monthStats.count > 0
              ? Math.round(monthStats.total / monthStats.count)
              : 0;

          chartDataFormatted.push({
            name: monthName,
            score: avgPct,
            ym,
          });
        }

        setStats({
          totalStudents: studentsCount || 0,
          assignmentsGraded: gradedCount,
          averageScore:
            scoreCount > 0 ? Number((totalScore / scoreCount).toFixed(1)) : 0,
          lessonPlansCreated: lessonPlansCount || 0,
        });
        setChartData(chartDataFormatted);
        setRecentSubmissions(submissionsData);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const kpiData = [
    { title: t('dashboard.totalStudents'), value: stats.totalStudents.toString(), icon: <Users className="w-8 h-8 text-primary" />, color: "text-primary" },
    { title: t('dashboard.assignmentsGraded'), value: stats.assignmentsGraded.toString(), icon: <ClipboardCheck className="w-8 h-8 text-green-500" />, color: "text-green-500" },
    { title: t('dashboard.averageScore'), value: `${Math.round(stats.averageScore)}%`, icon: <Star className="w-8 h-8 text-yellow-500" />, color: "text-yellow-500" },
    { title: t('dashboard.lessonPlansCreated'), value: stats.lessonPlansCreated.toString(), icon: <BookOpen className="w-8 h-8 text-blue-500" />, color: "text-blue-500" },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-full">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-3 sm:space-y-5 md:space-y-6 px-1 sm:px-0">
      <div>
        <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-gray-800 leading-tight">
          {t('dashboard.welcomeBack')}, {profile?.full_name || 'User'}!
        </h1>
        <p className="text-sm sm:text-lg text-gray-500 mt-0.5 sm:mt-1 hidden sm:block">{t('dashboard.snapshot')}</p>
      </div>

      {/* KPI — compact strip on mobile */}
      <div className="md:hidden rounded-lg border border-gray-200 bg-muted/40 divide-x divide-border overflow-hidden flex text-center">
        {kpiData.map((kpi, index) => (
          <div key={index} className="flex-1 min-w-0 py-2 px-1">
            <p className="text-[9px] font-medium text-gray-500 leading-none line-clamp-2">{kpi.title}</p>
            <p className="text-sm font-bold text-gray-800 tabular-nums mt-1 leading-none">{kpi.value}</p>
          </div>
        ))}
      </div>
      <div className="hidden md:grid gap-4 lg:gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi, index) => (
          <Card key={index} className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 border-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${kpi.color}`}>{kpi.title}</CardTitle>
              <span className="scale-90 sm:scale-100 [&_svg]:w-7 [&_svg]:h-7 sm:[&_svg]:w-8 sm:[&_svg]:h-8">{kpi.icon}</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl lg:text-4xl font-bold text-gray-800">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Performance Chart */}
        <Card className="lg:col-span-4 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800">{t('dashboard.performanceTrend')}</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {chartData.some((d) => d.score > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(34, 197, 94, 0.1)' }}
                    formatter={(value: number) => [`${value}%`, t('dashboard.averageScore')]}
                  />
                  <Bar dataKey="score" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] flex-col items-center justify-center px-4 text-center text-sm text-muted-foreground">
                <p className="max-w-md text-xs leading-relaxed">
                  {t('dashboard.noPerformanceTrendData')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Submissions */}
        <Card className="lg:col-span-3 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800">{t('dashboard.recentSubmissions')}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSubmissions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.student')}</TableHead>
                    <TableHead>{t('common.assignment')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSubmissions.map((submission, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{submission.student}</TableCell>
                      <TableCell>{submission.assignment}</TableCell>
                      <TableCell>
                        <Badge variant={submission.status === 'Graded' ? 'default' : 'secondary'} className={submission.status === 'Graded' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                          {submission.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {t('dashboard.noSubmissions')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
