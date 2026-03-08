import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getComprehensiveAdminStats } from "@/services/adminService";
import type { DashboardOverview } from "@/types/admin";
import { Link } from "react-router-dom";
import {
  Users,
  GraduationCap,
  BookOpen,
  MessageSquare,
  ClipboardList,
  FileText,
  TrendingUp,
  Calendar,
  Activity,
  FolderOpen,
  Megaphone,
  MessageCircle,
  Image,
  School,
  Globe,
  Bot,
  Send,
  BarChart3,
  FileText as WordsIcon,
} from "lucide-react";
import { motion } from "framer-motion";
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
  AreaChart,
  Area,
} from "recharts";
import RealtimeActivityFeed from "@/components/admin/RealtimeActivityFeed";
import { useRealtimeStats } from "@/hooks/useAdminRealtime";

// Chart colors
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

interface ComprehensiveStats {
  overview: DashboardOverview & {
    totalImagesGenerated: number;
    totalChatInputs: number;
    totalChatResponses: number;
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    aiWordsGenerated: number;
  };
  studentsPerTeacher: { teacherId: string; teacherName: string; studentCount: number; schoolName: string | null }[];
  lessonPlansByTeacher: { teacherId: string; teacherName: string; lessonPlanCount: number }[];
  schools: { name: string; type: string | null; city: string | null; country: string | null; teacherCount: number; studentCount: number }[];
  teachersByCountry: { country: string; count: number }[];
  activityTrends: { date: string; lessonPlans: number; assignments: number; submissions: number; messages: number }[];
  imagesGeneratedByTeacher: { teacherId: string; teacherName: string; imageCount: number }[];
}

const AdminOverview = () => {
  const [stats, setStats] = useState<ComprehensiveStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const data = await getComprehensiveAdminStats();
    if (data) {
      setStats(data as ComprehensiveStats);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh stats when real-time events occur
  useRealtimeStats(fetchData, !loading);

  const overview = stats?.overview;

  const mainStatCards = [
    {
      title: "Total Teachers",
      value: overview?.totalTeachers || 0,
      icon: Users,
      color: "#3b82f6",
      bgColor: "bg-blue-500/10",
      link: "/admin/teachers",
      description: "Registered teachers",
    },
    {
      title: "Total Students",
      value: overview?.totalStudents || 0,
      icon: GraduationCap,
      color: "#10b981",
      bgColor: "bg-emerald-500/10",
      link: "/admin/students",
      description: "Students created",
    },
    {
      title: "Lesson Plans",
      value: overview?.totalLessonPlans || 0,
      icon: BookOpen,
      color: "#a855f7",
      bgColor: "bg-purple-500/10",
      link: "/admin/lesson-plans",
      description: "Generated lesson plans",
    },
    {
      title: "Assignments",
      value: overview?.totalAssignments || 0,
      icon: ClipboardList,
      color: "#f59e0b",
      bgColor: "bg-amber-500/10",
      link: "/admin/assignments",
      description: "Created assignments",
    },
    {
      title: "Submissions",
      value: overview?.totalSubmissions || 0,
      icon: FileText,
      color: "#f43f5e",
      bgColor: "bg-rose-500/10",
      link: "/admin/submissions",
      description: "Student submissions",
    },
    {
      title: "Chat Conversations",
      value: overview?.totalChatConversations || 0,
      icon: MessageSquare,
      color: "#06b6d4",
      bgColor: "bg-cyan-500/10",
      link: "/admin/chatbot",
      description: "Chatbot conversations",
    },
    {
      title: "Resources",
      value: overview?.totalResources || 0,
      icon: FolderOpen,
      color: "#6366f1",
      bgColor: "bg-indigo-500/10",
      link: "/admin/resources",
      description: "Uploaded resources",
    },
    {
      title: "Announcements",
      value: overview?.totalAnnouncements || 0,
      icon: Megaphone,
      color: "#ec4899",
      bgColor: "bg-pink-500/10",
      link: "/admin/announcements",
      description: "Posted announcements",
    },
    {
      title: "Images Generated",
      value: overview?.totalImagesGenerated || 0,
      icon: Image,
      color: "#8b5cf6",
      bgColor: "bg-violet-500/10",
      link: "/admin/teachers",
      description: "AI-generated images",
    },
  ];

  const activityCards = [
    {
      title: "Active Today",
      value: overview?.activeTeachersToday || 0,
      icon: Activity,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Active This Week",
      value: overview?.activeTeachersThisWeek || 0,
      icon: Calendar,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Active This Month",
      value: overview?.activeTeachersThisMonth || 0,
      icon: TrendingUp,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "New Teachers (Week)",
      value: overview?.newTeachersThisWeek || 0,
      icon: Users,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "New Students (Week)",
      value: overview?.newStudentsThisWeek || 0,
      icon: GraduationCap,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
    },
  ];

  const chatStats = [
    {
      title: "Chat Inputs",
      value: overview?.totalChatInputs || 0,
      icon: Send,
      color: "text-cyan-400",
      description: "User questions",
    },
    {
      title: "Chat Responses",
      value: overview?.totalChatResponses || 0,
      icon: Bot,
      color: "text-violet-400",
      description: "AI responses",
    },
    {
      title: "Total Messages",
      value: overview?.totalChatMessages || 0,
      icon: MessageCircle,
      color: "text-pink-400",
      description: "All messages",
    },
    {
      title: "AI Words Generated",
      value: overview?.aiWordsGenerated || 0,
      icon: WordsIcon,
      color: "text-amber-400",
      description: "Total words by AI",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // Prepare chart data
  const studentsPerTeacherData = (stats?.studentsPerTeacher || []).slice(0, 10).map(t => ({
    name: t.teacherName.length > 15 ? t.teacherName.substring(0, 15) + '...' : t.teacherName,
    students: t.studentCount,
  }));

  const lessonPlansByTeacherData = (stats?.lessonPlansByTeacher || []).slice(0, 10).map(t => ({
    name: t.teacherName.length > 15 ? t.teacherName.substring(0, 15) + '...' : t.teacherName,
    lessonPlans: t.lessonPlanCount,
  }));

  const teachersByCountryData = (stats?.teachersByCountry || []).slice(0, 8).map(c => ({
    name: c.country,
    value: c.count,
  }));

  const imagesPerTeacherData = (stats?.imagesGeneratedByTeacher || []).slice(0, 8).map(t => ({
    name: t.teacherName.length > 12 ? t.teacherName.substring(0, 12) + '...' : t.teacherName,
    images: t.imageCount,
  }));

  // Get last 14 days for activity trend
  const activityTrendData = (stats?.activityTrends || []).slice(-14).map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    lessonPlans: d.lessonPlans,
    assignments: d.assignments,
    submissions: d.submissions,
    messages: d.messages,
  }));

  return (
    <div className="space-y-6 p-2">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Comprehensive overview of Mother of Math platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-gray-800 rounded-lg px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-300">Live Data</span>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mainStatCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Link to={stat.link}>
                <Card className="bg-gray-900/50 border-gray-800 hover:border-gray-700 transition-all cursor-pointer hover:bg-gray-800/50 hover:scale-[1.02]">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-gray-400 text-sm font-medium">
                          {stat.title}
                        </p>
                        <p className="text-3xl font-bold text-white mt-1">
                          {stat.value.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                      </div>
                      <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                        <Icon className="w-6 h-6" style={{ color: stat.color }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Activity & Chat Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Stats */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              Platform Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {activityCards.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.title}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    className={`p-3 rounded-lg ${stat.bgColor} text-center`}
                  >
                    <Icon className={`w-5 h-5 mx-auto mb-1 ${stat.color}`} />
                    <p className="text-xl font-bold text-white">
                      {stat.value.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">{stat.title}</p>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Chat Stats */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
              Chatbot Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {chatStats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                    className="bg-gray-800/50 p-4 rounded-lg text-center"
                  >
                    <Icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                    <p className="text-2xl font-bold text-white">
                      {stat.value.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{stat.title}</p>
                    <p className="text-xs text-gray-500">{stat.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Students per Teacher & Lesson Plans by Teacher */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students per Teacher Bar Chart */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-400" />
              Students per Teacher (Top 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {studentsPerTeacherData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={studentsPerTeacherData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="name" type="category" stroke="#9ca3af" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="students" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lesson Plans by Teacher Bar Chart */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-400" />
              Lesson Plans by Teacher (Top 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lessonPlansByTeacherData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={lessonPlansByTeacherData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="name" type="category" stroke="#9ca3af" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="lessonPlans" fill="#a855f7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Teachers by Country & Images Generated */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teachers by Country Pie Chart */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              Teachers by Country
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teachersByCountryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={teachersByCountryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {teachersByCountryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    formatter={(value: number) => [`${value} teachers`, 'Count']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Images Generated per Teacher */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Image className="w-5 h-5 text-violet-400" />
              Images Generated by Teacher
            </CardTitle>
          </CardHeader>
          <CardContent>
            {imagesPerTeacherData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={imagesPerTeacherData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="images" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No images generated yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Trends Line Chart - Full Width */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-rose-400" />
            Activity Trends (Last 14 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={activityTrendData}>
                <defs>
                  <linearGradient id="colorLessons" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAssignments" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Area type="monotone" dataKey="lessonPlans" stroke="#a855f7" fillOpacity={1} fill="url(#colorLessons)" name="Lesson Plans" />
                <Area type="monotone" dataKey="assignments" stroke="#f59e0b" fillOpacity={1} fill="url(#colorAssignments)" name="Assignments" />
                <Area type="monotone" dataKey="submissions" stroke="#10b981" fillOpacity={1} fill="url(#colorSubmissions)" name="Submissions" />
                <Area type="monotone" dataKey="messages" stroke="#06b6d4" fillOpacity={1} fill="url(#colorMessages)" name="Messages" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-gray-500">
              No activity data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schools List */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <School className="w-5 h-5 text-amber-400" />
            All Schools ({stats?.schools?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.schools && stats.schools.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.schools.map((school, index) => (
                <motion.div
                  key={school.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <h3 className="font-semibold text-white text-sm mb-2 truncate" title={school.name}>
                    {school.name}
                  </h3>
                  <div className="space-y-1 text-xs text-gray-400">
                    {school.type && (
                      <p className="flex items-center gap-1">
                        <span className="text-gray-500">Type:</span> {school.type}
                      </p>
                    )}
                    {(school.city || school.country) && (
                      <p className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {[school.city, school.country].filter(Boolean).join(', ')}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-700">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-blue-400" />
                        <span className="text-white font-medium">{school.teacherCount}</span> teachers
                      </span>
                      <span className="flex items-center gap-1">
                        <GraduationCap className="w-3 h-3 text-emerald-400" />
                        <span className="text-white font-medium">{school.studentCount}</span> students
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No schools registered yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Link to="/admin/teachers">
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-indigo-500/50 cursor-pointer transition-all group text-center">
                <Users className="w-8 h-8 mx-auto text-gray-400 group-hover:text-indigo-400 transition-colors mb-2" />
                <p className="text-sm text-gray-300 group-hover:text-white">View Teachers</p>
              </div>
            </Link>
            <Link to="/admin/students">
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-emerald-500/50 cursor-pointer transition-all group text-center">
                <GraduationCap className="w-8 h-8 mx-auto text-gray-400 group-hover:text-emerald-400 transition-colors mb-2" />
                <p className="text-sm text-gray-300 group-hover:text-white">View Students</p>
              </div>
            </Link>
            <Link to="/admin/lesson-plans">
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-purple-500/50 cursor-pointer transition-all group text-center">
                <BookOpen className="w-8 h-8 mx-auto text-gray-400 group-hover:text-purple-400 transition-colors mb-2" />
                <p className="text-sm text-gray-300 group-hover:text-white">Lesson Plans</p>
              </div>
            </Link>
            <Link to="/admin/chatbot">
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-cyan-500/50 cursor-pointer transition-all group text-center">
                <MessageSquare className="w-8 h-8 mx-auto text-gray-400 group-hover:text-cyan-400 transition-colors mb-2" />
                <p className="text-sm text-gray-300 group-hover:text-white">Chatbot Data</p>
              </div>
            </Link>
            <Link to="/admin/analytics">
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-rose-500/50 cursor-pointer transition-all group text-center">
                <TrendingUp className="w-8 h-8 mx-auto text-gray-400 group-hover:text-rose-400 transition-colors mb-2" />
                <p className="text-sm text-gray-300 group-hover:text-white">Analytics</p>
              </div>
            </Link>
            <Link to="/admin/create-teacher">
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-amber-500/50 cursor-pointer transition-all group text-center">
                <Users className="w-8 h-8 mx-auto text-gray-400 group-hover:text-amber-400 transition-colors mb-2" />
                <p className="text-sm text-gray-300 group-hover:text-white">Create Teacher</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Real-time Activity Feed - Fixed Position */}
      <RealtimeActivityFeed 
        maxItems={15} 
        collapsible={true}
        className="fixed bottom-4 right-4 w-96 z-40 shadow-xl"
      />
    </div>
  );
};

export default AdminOverview;
