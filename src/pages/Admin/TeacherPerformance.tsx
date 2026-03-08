import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  BookOpen,
  ClipboardList,
  MessageSquare,
  TrendingUp,
  RefreshCw,
  Search,
  Award,
  Target,
  Activity,
  GraduationCap,
  Calendar,
  Star,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { KPICard, KPIGrid } from '@/components/admin/KPICard';
import { DateRangeSelector } from '@/components/admin/DateRangeSelector';
import { useAdminDateRange } from '@/context/AdminDateRangeContext';
import { getAllTeachers, getComprehensiveAdminStats } from '@/services/adminService';
import type { TeacherStats } from '@/types/admin';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
} from 'recharts';
import { format, differenceInDays } from 'date-fns';

interface TeacherPerformance extends TeacherStats {
  performanceScore: number;
  engagementLevel: 'high' | 'medium' | 'low';
  rank: number;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const TeacherPerformanceAnalyticsPage: React.FC = () => {
  const { dateRange, refreshKey } = useAdminDateRange();
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<TeacherPerformance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('performanceScore');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherPerformance | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [dateRange, refreshKey]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teachersData, comprehensiveStats] = await Promise.all([
        getAllTeachers(),
        getComprehensiveAdminStats(),
      ]);

      // Calculate performance scores
      const performanceTeachers: TeacherPerformance[] = teachersData.map((teacher: TeacherStats) => {
        // Calculate performance score based on multiple factors
        const lessonScore = Math.min(teacher.total_lesson_plans * 10, 100);
        const studentScore = Math.min(teacher.total_students * 5, 100);
        const assignmentScore = Math.min(teacher.total_assignments * 8, 100);
        const chatScore = Math.min(teacher.total_chatbot_messages * 2, 100);
        const loginScore = Math.min((teacher.login_count || 0) * 5, 100);
        
        const performanceScore = Math.round(
          (lessonScore * 0.25 + studentScore * 0.2 + assignmentScore * 0.25 + chatScore * 0.15 + loginScore * 0.15)
        );

        let engagementLevel: 'high' | 'medium' | 'low' = 'low';
        if (performanceScore >= 70) engagementLevel = 'high';
        else if (performanceScore >= 40) engagementLevel = 'medium';

        return {
          ...teacher,
          performanceScore,
          engagementLevel,
          rank: 0,
        };
      });

      // Sort by performance score and assign ranks
      performanceTeachers.sort((a, b) => b.performanceScore - a.performanceScore);
      performanceTeachers.forEach((t, i) => t.rank = i + 1);

      setTeachers(performanceTeachers);
      setStats(comprehensiveStats);

      // Select top performer by default
      if (performanceTeachers.length > 0 && !selectedTeacher) {
        setSelectedTeacher(performanceTeachers[0]);
      }
    } catch (error) {
      console.error('Error fetching teacher performance:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort teachers
  const filteredTeachers = teachers
    .filter(t => 
      t.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.school_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'performanceScore': return b.performanceScore - a.performanceScore;
        case 'students': return b.total_students - a.total_students;
        case 'lessonPlans': return b.total_lesson_plans - a.total_lesson_plans;
        case 'assignments': return b.total_assignments - a.total_assignments;
        case 'name': return (a.full_name || '').localeCompare(b.full_name || '');
        default: return 0;
      }
    });

  // Calculate summary stats
  const avgPerformance = teachers.length > 0
    ? Math.round(teachers.reduce((sum, t) => sum + t.performanceScore, 0) / teachers.length)
    : 0;
  const highPerformers = teachers.filter(t => t.engagementLevel === 'high').length;
  const lowPerformers = teachers.filter(t => t.engagementLevel === 'low').length;

  // Prepare radar chart data for selected teacher
  const getRadarData = (teacher: TeacherPerformance) => [
    { subject: 'Lesson Plans', value: Math.min(teacher.total_lesson_plans * 10, 100), fullMark: 100 },
    { subject: 'Students', value: Math.min(teacher.total_students * 5, 100), fullMark: 100 },
    { subject: 'Assignments', value: Math.min(teacher.total_assignments * 8, 100), fullMark: 100 },
    { subject: 'Chatbot Use', value: Math.min(teacher.total_chatbot_messages * 2, 100), fullMark: 100 },
    { subject: 'Login Activity', value: Math.min((teacher.login_count || 0) * 5, 100), fullMark: 100 },
    { subject: 'Resources', value: Math.min((teacher.total_resources || 0) * 10, 100), fullMark: 100 },
  ];

  // Scatter data for performance vs students
  const scatterData = teachers.slice(0, 50).map(t => ({
    x: t.total_students,
    y: t.performanceScore,
    z: t.total_lesson_plans * 3 + 10,
    name: t.full_name,
  }));

  // Top performers chart data
  const topPerformersData = teachers.slice(0, 10).map(t => ({
    name: t.full_name?.length > 12 ? t.full_name.substring(0, 12) + '...' : t.full_name,
    score: t.performanceScore,
    lessons: t.total_lesson_plans,
    students: t.total_students,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Teacher Performance</h1>
          <p className="text-gray-400">
            Analytics and insights on teacher engagement and productivity
          </p>
        </div>
        <div className="flex items-center gap-4">
          <DateRangeSelector />
          <Button onClick={fetchData} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <KPIGrid columns={4}>
        <KPICard
          title="Total Teachers"
          value={teachers.length}
          icon={<Users className="h-5 w-5" />}
        />
        <KPICard
          title="Avg Performance Score"
          value={`${avgPerformance}/100`}
          icon={<Target className="h-5 w-5" />}
        />
        <KPICard
          title="High Performers (≥70)"
          value={highPerformers}
          icon={<Award className="h-5 w-5" />}
          trend="up"
        />
        <KPICard
          title="Need Attention (<40)"
          value={lowPerformers}
          icon={<Activity className="h-5 w-5" />}
          trend="down"
        />
      </KPIGrid>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers Chart */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-400" />
              Top 10 Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topPerformersData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" domain={[0, 100]} />
                <YAxis dataKey="name" type="category" stroke="#9ca3af" width={100} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(value: number, name: string) => [
                    name === 'score' ? `${value}/100` : value,
                    name === 'score' ? 'Performance' : name
                  ]}
                />
                <Bar dataKey="score" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance vs Students Scatter */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              Performance vs Student Count
            </CardTitle>
            <CardDescription className="text-gray-400">
              Bubble size represents lesson plans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="x" stroke="#9ca3af" name="Students" unit="" />
                <YAxis dataKey="y" stroke="#9ca3af" name="Performance" domain={[0, 100]} />
                <ZAxis dataKey="z" range={[50, 400]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(value: number, name: string) => [value, name === 'x' ? 'Students' : 'Score']}
                />
                <Scatter data={scatterData} fill="#10b981">
                  {scatterData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Teacher Detail Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selected Teacher Radar */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-400" />
              {selectedTeacher ? selectedTeacher.full_name : 'Select a Teacher'}
            </CardTitle>
            <CardDescription className="text-gray-400">
              Performance breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedTeacher ? (
              <>
                <div className="flex items-center justify-center mb-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white">{selectedTeacher.performanceScore}</div>
                    <Badge className={
                      selectedTeacher.engagementLevel === 'high' ? 'bg-green-500/20 text-green-400' :
                      selectedTeacher.engagementLevel === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-red-500/20 text-red-400'
                    }>
                      {selectedTeacher.engagementLevel.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={getRadarData(selectedTeacher)}>
                    <PolarGrid stroke="#374151" />
                    <PolarAngleAxis dataKey="subject" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#374151" />
                    <Radar name="Score" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                Select a teacher to view details
              </div>
            )}
          </CardContent>
        </Card>

        {/* Teachers Table */}
        <Card className="lg:col-span-2 bg-gray-900/50 border-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-400" />
                All Teachers
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search teachers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-gray-800 border-gray-700 w-[200px]"
                  />
                </div>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[150px] bg-gray-800 border-gray-700">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="performanceScore">Performance</SelectItem>
                    <SelectItem value="students">Students</SelectItem>
                    <SelectItem value="lessonPlans">Lesson Plans</SelectItem>
                    <SelectItem value="assignments">Assignments</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-gray-800 max-h-[400px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-gray-900">
                  <TableRow className="border-gray-800">
                    <TableHead className="text-gray-400">Rank</TableHead>
                    <TableHead className="text-gray-400">Teacher</TableHead>
                    <TableHead className="text-gray-400 text-center">Score</TableHead>
                    <TableHead className="text-gray-400 text-center">Students</TableHead>
                    <TableHead className="text-gray-400 text-center">Lessons</TableHead>
                    <TableHead className="text-gray-400 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeachers.slice(0, 50).map((teacher) => (
                    <TableRow 
                      key={teacher.id} 
                      className={`border-gray-800 cursor-pointer transition-colors ${
                        selectedTeacher?.id === teacher.id ? 'bg-indigo-500/10' : 'hover:bg-gray-800/50'
                      }`}
                      onClick={() => setSelectedTeacher(teacher)}
                    >
                      <TableCell>
                        {teacher.rank <= 3 ? (
                          <Badge className={
                            teacher.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                            teacher.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                            'bg-amber-600/20 text-amber-400'
                          }>
                            #{teacher.rank}
                          </Badge>
                        ) : (
                          <span className="text-gray-500">#{teacher.rank}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-white font-medium">{teacher.full_name}</p>
                          <p className="text-xs text-gray-500">{teacher.school_name || 'No school'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className={`font-bold ${
                            teacher.performanceScore >= 70 ? 'text-green-400' :
                            teacher.performanceScore >= 40 ? 'text-amber-400' :
                            'text-red-400'
                          }`}>
                            {teacher.performanceScore}
                          </span>
                          {teacher.performanceScore >= 70 ? (
                            <ArrowUpRight className="h-4 w-4 text-green-400" />
                          ) : teacher.performanceScore < 40 ? (
                            <ArrowDownRight className="h-4 w-4 text-red-400" />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-gray-300">{teacher.total_students}</TableCell>
                      <TableCell className="text-center text-gray-300">{teacher.total_lesson_plans}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={
                          teacher.engagementLevel === 'high' ? 'bg-green-500/20 text-green-400' :
                          teacher.engagementLevel === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-red-500/20 text-red-400'
                        }>
                          {teacher.engagementLevel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTeachers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No teachers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeacherPerformanceAnalyticsPage;
