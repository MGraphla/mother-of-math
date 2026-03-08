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

        // 1. Fetch Total Students
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
        let monthlyData: Record<string, { total: number, count: number }> = {};

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
              assignments ( title )
            `)
            .in('assignment_id', assignmentIds)
            .order('submitted_at', { ascending: false });

          if (submissionsError) throw submissionsError;

          if (submissions) {
            // Process submissions for stats
            submissions.forEach(sub => {
              if (sub.status === 'graded') {
                gradedCount++;
                if (sub.score !== null) {
                  totalScore += Number(sub.score);
                  scoreCount++;
                  
                  // Process for chart (group by month)
                  const date = new Date(sub.graded_at || sub.submitted_at);
                  const month = date.toLocaleString('default', { month: 'short' });
                  if (!monthlyData[month]) {
                    monthlyData[month] = { total: 0, count: 0 };
                  }
                  monthlyData[month].total += Number(sub.score);
                  monthlyData[month].count++;
                }
              }
            });

            // Format recent submissions
            submissionsData = submissions.slice(0, 5).map(sub => ({
              student: sub.students?.full_name || 'Unknown Student',
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

        // Format chart data
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentMonthIndex = new Date().getMonth();
        const chartDataFormatted = [];
        
        // Show last 6 months
        for (let i = 5; i >= 0; i--) {
          let monthIndex = currentMonthIndex - i;
          if (monthIndex < 0) monthIndex += 12;
          const monthName = months[monthIndex];
          
          const monthStats = monthlyData[monthName];
          const avgScore = monthStats && monthStats.count > 0 
            ? Math.round((monthStats.total / monthStats.count) * 10) // Convert to percentage assuming score is out of 10
            : 0;
            
          chartDataFormatted.push({
            name: monthName,
            score: avgScore
          });
        }

        setStats({
          totalStudents: studentsCount || 0,
          assignmentsGraded: gradedCount,
          averageScore: scoreCount > 0 ? Number((totalScore / scoreCount).toFixed(1)) : 0,
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
    { title: t('dashboard.averageScore'), value: `${stats.averageScore}/10`, icon: <Star className="w-8 h-8 text-yellow-500" />, color: "text-yellow-500" },
    { title: t('dashboard.lessonPlansCreated'), value: stats.lessonPlansCreated.toString(), icon: <BookOpen className="w-8 h-8 text-blue-500" />, color: "text-blue-500" },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-full">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-gray-800">{t('dashboard.welcomeBack')}, {profile?.full_name || 'User'}!</h1>
        <p className="text-lg text-gray-500 mt-1">{t('dashboard.snapshot')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi, index) => (
          <Card key={index} className="shadow-lg hover:shadow-xl transition-shadow duration-300 border-l-4 border-primary">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${kpi.color}`}>{kpi.title}</CardTitle>
              {kpi.icon}
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-gray-800">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Performance Chart */}
        <Card className="lg:col-span-4 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800">{t('dashboard.performanceTrend')}</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                <Tooltip cursor={{fill: 'rgba(34, 197, 94, 0.1)'}}/>
                <Bar dataKey="score" fill="#22C55E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
