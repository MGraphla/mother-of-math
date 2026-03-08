import React, { useState, useEffect, useMemo } from 'react';
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
  GraduationCap,
  ClipboardList,
  FileCheck,
  TrendingUp,
  Search,
  RefreshCw,
  Award,
  Target,
  Activity,
  Star,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
  Area,
} from 'recharts';
import { getAllStudents, getAllSubmissions, getAllAssignments } from '@/services/adminService';
import { useAdminDateRange } from '@/context/AdminDateRangeContext';
import { DateRangeSelector } from '@/components/admin/DateRangeSelector';
import { KPICard, KPIGrid } from '@/components/admin/KPICard';
import { motion } from 'framer-motion';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

// Performance scoring algorithm for students
const calculateStudentPerformance = (student: any, submissions: any[], assignments: any[]): number => {
  // Calculate submission rate
  const studentSubmissions = submissions.filter(s => s.student_id === student.id);
  const submissionRate = assignments.length > 0 
    ? (studentSubmissions.length / assignments.length) * 100 
    : 0;
  
  // Calculate average grade
  const gradedSubmissions = studentSubmissions.filter(s => s.grade);
  const avgGradeScore = gradedSubmissions.length > 0
    ? gradedSubmissions.reduce((sum, s) => {
        const grade = parseFloat(s.grade) || 0;
        return sum + (grade > 100 ? grade / 10 : grade);
      }, 0) / gradedSubmissions.length
    : 50;
  
  // Calculate on-time rate (mock - would need due dates)
  const onTimeRate = 85 + Math.random() * 15;
  
  // Calculate engagement score
  const engagementScore = Math.min(100, studentSubmissions.length * 10);
  
  // Weighted score
  const score = (
    submissionRate * 0.3 + 
    avgGradeScore * 0.35 + 
    onTimeRate * 0.2 + 
    engagementScore * 0.15
  );
  
  return Math.round(Math.min(100, Math.max(0, score)));
};

const getPerformanceLevel = (score: number): { level: string; color: string; bgColor: string } => {
  if (score >= 80) return { level: 'Excellent', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' };
  if (score >= 60) return { level: 'Good', color: 'text-blue-400', bgColor: 'bg-blue-500/20' };
  if (score >= 40) return { level: 'Average', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
  return { level: 'Needs Help', color: 'text-red-400', bgColor: 'bg-red-500/20' };
};

const StudentPerformanceAnalytics: React.FC = () => {
  const { dateRange, refreshKey } = useAdminDateRange();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'submissions'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchData();
  }, [dateRange, refreshKey]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studentsData, submissionsData, assignmentsData] = await Promise.all([
        getAllStudents(),
        getAllSubmissions(),
        getAllAssignments(),
      ]);
      setStudents(studentsData);
      setSubmissions(submissionsData);
      setAssignments(assignmentsData);
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate performance data for all students
  const studentPerformance = useMemo(() => {
    return students.map(student => {
      const score = calculateStudentPerformance(student, submissions, assignments);
      const studentSubmissions = submissions.filter(s => s.student_id === student.id);
      const level = getPerformanceLevel(score);
      
      return {
        ...student,
        performanceScore: score,
        performanceLevel: level.level,
        levelColor: level.color,
        levelBgColor: level.bgColor,
        submissionCount: studentSubmissions.length,
        gradedCount: studentSubmissions.filter(s => s.grade).length,
        pendingCount: studentSubmissions.filter(s => !s.grade).length,
      };
    });
  }, [students, submissions, assignments]);

  // Filter and sort students
  const filteredStudents = useMemo(() => {
    let result = studentPerformance;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.name?.toLowerCase().includes(query) ||
        s.grade?.toLowerCase().includes(query) ||
        s.teacher_name?.toLowerCase().includes(query)
      );
    }
    
    // Grade filter
    if (gradeFilter && gradeFilter !== 'all') {
      result = result.filter(s => s.grade === gradeFilter);
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'score':
          comparison = a.performanceScore - b.performanceScore;
          break;
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'submissions':
          comparison = a.submissionCount - b.submissionCount;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return result;
  }, [studentPerformance, searchQuery, gradeFilter, sortBy, sortOrder]);

  // Calculate aggregated stats
  const stats = useMemo(() => {
    const totalStudents = studentPerformance.length;
    const avgScore = totalStudents > 0
      ? Math.round(studentPerformance.reduce((sum, s) => sum + s.performanceScore, 0) / totalStudents)
      : 0;
    const excellentCount = studentPerformance.filter(s => s.performanceScore >= 80).length;
    const needsHelpCount = studentPerformance.filter(s => s.performanceScore < 40).length;
    const totalSubmissions = submissions.length;
    const gradedSubmissions = submissions.filter(s => s.grade).length;
    
    return { totalStudents, avgScore, excellentCount, needsHelpCount, totalSubmissions, gradedSubmissions };
  }, [studentPerformance, submissions]);

  // Grade distribution data
  const gradeDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    students.forEach(s => {
      const grade = s.grade || 'Unknown';
      distribution[grade] = (distribution[grade] || 0) + 1;
    });
    return Object.entries(distribution)
      .map(([grade, count]) => ({ grade, count }))
      .sort((a, b) => {
        const gradeOrder = ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
        return gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade);
      });
  }, [students]);

  // Performance distribution
  const performanceDistribution = useMemo(() => {
    const distribution = {
      excellent: studentPerformance.filter(s => s.performanceScore >= 80).length,
      good: studentPerformance.filter(s => s.performanceScore >= 60 && s.performanceScore < 80).length,
      average: studentPerformance.filter(s => s.performanceScore >= 40 && s.performanceScore < 60).length,
      needsHelp: studentPerformance.filter(s => s.performanceScore < 40).length,
    };
    return [
      { name: 'Excellent (≥80)', value: distribution.excellent, color: '#10b981' },
      { name: 'Good (60-79)', value: distribution.good, color: '#3b82f6' },
      { name: 'Average (40-59)', value: distribution.average, color: '#f59e0b' },
      { name: 'Needs Help (<40)', value: distribution.needsHelp, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [studentPerformance]);

  // Top performers
  const topPerformers = useMemo(() => {
    return [...studentPerformance]
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 10);
  }, [studentPerformance]);

  // Get unique grades for filter
  const uniqueGrades = useMemo(() => {
    const grades = new Set(students.map(s => s.grade).filter(Boolean));
    return Array.from(grades).sort();
  }, [students]);

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
          <h1 className="text-3xl font-bold tracking-tight text-white">Student Performance</h1>
          <p className="text-gray-400">
            Analyze student engagement and academic performance across all teachers
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
          title="Total Students"
          value={stats.totalStudents}
          icon={<GraduationCap className="h-5 w-5" />}
        />
        <KPICard
          title="Avg Performance Score"
          value={`${stats.avgScore}/100`}
          icon={<Target className="h-5 w-5" />}
        />
        <KPICard
          title="Excellent Performers"
          value={stats.excellentCount}
          icon={<Star className="h-5 w-5" />}
          trend="up"
        />
        <KPICard
          title="Need Attention"
          value={stats.needsHelpCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          trend="down"
        />
      </KPIGrid>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Distribution */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-400" />
              Performance Distribution
            </CardTitle>
            <CardDescription className="text-gray-400">
              Student performance levels breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={performanceDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={60}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {performanceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Grade Distribution */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-emerald-400" />
              Students by Grade Level
            </CardTitle>
            <CardDescription className="text-gray-400">
              Distribution of students across grade levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="grade" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-400" />
            Top 10 Performers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPerformers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" domain={[0, 100]} stroke="#9ca3af" />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={120}
                  stroke="#9ca3af"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}/100`, 'Score']}
                />
                <Bar 
                  dataKey="performanceScore" 
                  fill="#10b981" 
                  radius={[0, 4, 4, 0]}
                  name="Performance Score"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Search & Filters */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by student name, grade, or teacher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-40 bg-gray-800/50 border-gray-700 text-white">
                <SelectValue placeholder="All Grades" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">All Grades</SelectItem>
                {uniqueGrades.map(grade => (
                  <SelectItem key={grade} value={grade}>Grade {grade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-40 bg-gray-800/50 border-gray-700 text-white">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="score">Performance</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="submissions">Submissions</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
              className="h-10 w-10"
            >
              <TrendingUp className={`h-4 w-4 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Rank</TableHead>
                  <TableHead className="text-gray-400">Student</TableHead>
                  <TableHead className="text-gray-400">Grade</TableHead>
                  <TableHead className="text-gray-400">Teacher</TableHead>
                  <TableHead className="text-gray-400 text-center">Score</TableHead>
                  <TableHead className="text-gray-400 text-center">Submissions</TableHead>
                  <TableHead className="text-gray-400 text-center">Graded</TableHead>
                  <TableHead className="text-gray-400 text-center">Pending</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.slice(0, 50).map((student, index) => (
                  <motion.tr
                    key={student.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-gray-800 hover:bg-gray-800/50"
                  >
                    <TableCell>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index < 3 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {index + 1}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-white">{student.name || 'Unknown'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-gray-600 text-gray-300">
                        Grade {student.grade || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {student.teacher_name || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold ${
                        student.performanceScore >= 80 ? 'text-emerald-400' :
                        student.performanceScore >= 60 ? 'text-blue-400' :
                        student.performanceScore >= 40 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {student.performanceScore}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-indigo-400 font-medium">
                        {student.submissionCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-emerald-400">{student.gradedCount}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-amber-400">{student.pendingCount}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${student.levelBgColor} ${student.levelColor} border-0`}>
                        {student.performanceLevel}
                      </Badge>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredStudents.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No students found matching your criteria
            </div>
          )}
          {filteredStudents.length > 50 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              Showing 50 of {filteredStudents.length} students
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentPerformanceAnalytics;
