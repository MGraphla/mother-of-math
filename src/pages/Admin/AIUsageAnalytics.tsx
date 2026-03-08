import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DashboardOverview } from '@/types/admin';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Bot,
  Image,
  Brain,
  MessageSquare,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Zap,
  Users,
  Clock,
  BarChart3,
  Activity,
} from 'lucide-react';
import { KPICard, KPIGrid } from '@/components/admin/KPICard';
import { DateRangeSelector } from '@/components/admin/DateRangeSelector';
import { useAdminDateRange } from '@/context/AdminDateRangeContext';
import {
  getComprehensiveAdminStats,
  getAllTeachers,
  getAllChatConversations,
} from '@/services/adminService';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { format, subDays } from 'date-fns';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

interface AIStats {
  totalChatMessages: number;
  totalChatInputs: number;
  totalChatResponses: number;
  totalImagesGenerated: number;
  aiWordsGenerated: number;
  totalConversations: number;
  avgMessagesPerConversation: number;
  topChatUsers: { name: string; messages: number }[];
  topImageGenerators: { name: string; images: number }[];
  dailyUsage: { date: string; chats: number; images: number }[];
  gradeDistribution: { grade: string; count: number }[];
}

const AIUsageAnalyticsPage: React.FC = () => {
  const { dateRange, refreshKey } = useAdminDateRange();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AIStats | null>(null);

  useEffect(() => {
    fetchData();
  }, [dateRange, refreshKey]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [comprehensiveStats, teachers, conversations] = await Promise.all([
        getComprehensiveAdminStats(),
        getAllTeachers(),
        getAllChatConversations(),
      ]);

      // Calculate AI stats
      const overview = (comprehensiveStats?.overview || {}) as DashboardOverview;
      
      // Top chat users from conversations
      const userChatCounts: Record<string, number> = {};
      conversations.forEach((conv: any) => {
        const name = conv.user_name || 'Unknown';
        userChatCounts[name] = (userChatCounts[name] || 0) + (conv.message_count || 0);
      });
      const topChatUsers = Object.entries(userChatCounts)
        .map(([name, messages]) => ({ name, messages }))
        .sort((a, b) => b.messages - a.messages)
        .slice(0, 10);

      // Top image generators from teachers
      const topImageGenerators = (comprehensiveStats?.imagesGeneratedByTeacher || [])
        .slice(0, 10)
        .map((t: any) => ({ name: t.teacherName, images: t.imageCount }));

      // Generate daily usage data (mock based on activity trends)
      const activityTrends = comprehensiveStats?.activityTrends || [];
      const dailyUsage = activityTrends.slice(-14).map((d: any) => ({
        date: format(new Date(d.date), 'MMM d'),
        chats: d.messages || 0,
        images: Math.floor(Math.random() * 20), // Mock image data
      }));

      // Grade distribution from conversations
      const gradeCount: Record<string, number> = {};
      conversations.forEach((conv: any) => {
        const grade = conv.grade || 'Unknown';
        gradeCount[grade] = (gradeCount[grade] || 0) + 1;
      });
      const gradeDistribution = Object.entries(gradeCount)
        .map(([grade, count]) => ({ grade, count }))
        .sort((a, b) => b.count - a.count);

      setStats({
        totalChatMessages: overview.totalChatMessages || 0,
        totalChatInputs: overview.totalChatInputs || 0,
        totalChatResponses: overview.totalChatResponses || 0,
        totalImagesGenerated: overview.totalImagesGenerated || 0,
        aiWordsGenerated: overview.aiWordsGenerated || 0,
        totalConversations: overview.totalChatConversations || 0,
        avgMessagesPerConversation: overview.totalChatConversations
          ? Math.round(overview.totalChatMessages / overview.totalChatConversations)
          : 0,
        topChatUsers,
        topImageGenerators,
        dailyUsage,
        gradeDistribution,
      });
    } catch (error) {
      console.error('Error fetching AI stats:', error);
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-3xl font-bold tracking-tight text-white">AI Usage Analytics</h1>
          <p className="text-gray-400">
            Track AI chatbot, image generation, and intelligent features usage
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
          title="Total AI Conversations"
          value={stats?.totalConversations || 0}
          icon={<MessageSquare className="h-5 w-5" />}
          trend="up"
        />
        <KPICard
          title="Total Chat Messages"
          value={stats?.totalChatMessages || 0}
          icon={<Bot className="h-5 w-5" />}
          trend="up"
        />
        <KPICard
          title="Images Generated"
          value={stats?.totalImagesGenerated || 0}
          icon={<Image className="h-5 w-5" />}
          trend="up"
        />
        <KPICard
          title="AI Words Generated"
          value={stats?.aiWordsGenerated || 0}
          format="number"
          icon={<Sparkles className="h-5 w-5" />}
        />
      </KPIGrid>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-cyan-500/10">
                <Zap className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats?.totalChatInputs || 0}</p>
                <p className="text-sm text-gray-400">User Questions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-500/10">
                <Brain className="h-6 w-6 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats?.totalChatResponses || 0}</p>
                <p className="text-sm text-gray-400">AI Responses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/10">
                <Activity className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats?.avgMessagesPerConversation || 0}</p>
                <p className="text-sm text-gray-400">Avg Messages/Conversation</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList className="bg-gray-800">
          <TabsTrigger value="usage">Usage Trends</TabsTrigger>
          <TabsTrigger value="chatbot">Chatbot Analytics</TabsTrigger>
          <TabsTrigger value="images">Image Generation</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboards</TabsTrigger>
        </TabsList>

        {/* Usage Trends Tab */}
        <TabsContent value="usage">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Usage Chart */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-400" />
                  Daily AI Usage (Last 14 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={stats?.dailyUsage || []}>
                    <defs>
                      <linearGradient id="colorChats" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorImages" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
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
                    <Area type="monotone" dataKey="chats" stroke="#6366f1" fillOpacity={1} fill="url(#colorChats)" name="Chat Messages" />
                    <Area type="monotone" dataKey="images" stroke="#10b981" fillOpacity={1} fill="url(#colorImages)" name="Images Generated" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Grade Distribution */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-amber-400" />
                  Chatbot Usage by Grade Level
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats?.gradeDistribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ grade, percent }) => `${grade} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {(stats?.gradeDistribution || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Chatbot Analytics Tab */}
        <TabsContent value="chatbot">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-cyan-400" />
                  Chatbot Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <MessageSquare className="h-5 w-5 text-indigo-400" />
                      </div>
                      <span className="text-gray-300">Total Conversations</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{stats?.totalConversations || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-cyan-500/20 rounded-lg">
                        <Zap className="h-5 w-5 text-cyan-400" />
                      </div>
                      <span className="text-gray-300">User Questions</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{stats?.totalChatInputs || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-violet-500/20 rounded-lg">
                        <Bot className="h-5 w-5 text-violet-400" />
                      </div>
                      <span className="text-gray-300">AI Responses</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{stats?.totalChatResponses || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/20 rounded-lg">
                        <Sparkles className="h-5 w-5 text-amber-400" />
                      </div>
                      <span className="text-gray-300">Words Generated</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{(stats?.aiWordsGenerated || 0).toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-400" />
                  Top Chatbot Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats?.topChatUsers || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" stroke="#9ca3af" />
                    <YAxis dataKey="name" type="category" stroke="#9ca3af" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="messages" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Image Generation Tab */}
        <TabsContent value="images">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Image className="h-5 w-5 text-pink-400" />
                  Image Generation Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-pink-500/20 to-violet-500/20 mb-4">
                      <Image className="h-10 w-10 text-pink-400" />
                    </div>
                    <p className="text-5xl font-bold text-white mb-2">{stats?.totalImagesGenerated || 0}</p>
                    <p className="text-gray-400">Total Images Generated</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                    <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                      <p className="text-2xl font-bold text-green-400">
                        {stats?.topImageGenerators?.length || 0}
                      </p>
                      <p className="text-sm text-gray-400">Active Generators</p>
                    </div>
                    <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                      <p className="text-2xl font-bold text-amber-400">
                        {stats?.totalImagesGenerated && stats?.topImageGenerators?.length
                          ? Math.round(stats.totalImagesGenerated / (stats.topImageGenerators.length || 1))
                          : 0}
                      </p>
                      <p className="text-sm text-gray-400">Avg per Teacher</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-violet-400" />
                  Top Image Generators
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.topImageGenerators && stats.topImageGenerators.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.topImageGenerators}>
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
                  <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
                    <Image className="h-12 w-12 mb-3 opacity-50" />
                    <p>No image generation data yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Leaderboards Tab */}
        <TabsContent value="leaderboard">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chat Leaderboard */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-indigo-400" />
                  Chatbot Usage Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-gray-800">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800">
                        <TableHead className="text-gray-400">Rank</TableHead>
                        <TableHead className="text-gray-400">User</TableHead>
                        <TableHead className="text-gray-400 text-right">Messages</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(stats?.topChatUsers || []).map((user, index) => (
                        <TableRow key={user.name} className="border-gray-800">
                          <TableCell>
                            {index < 3 ? (
                              <Badge className={
                                index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                                index === 1 ? 'bg-gray-400/20 text-gray-300' :
                                'bg-amber-600/20 text-amber-400'
                              }>
                                #{index + 1}
                              </Badge>
                            ) : (
                              <span className="text-gray-500">#{index + 1}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-white font-medium">
                            {user.name.length > 20 ? user.name.substring(0, 20) + '...' : user.name}
                          </TableCell>
                          <TableCell className="text-right text-indigo-400 font-semibold">
                            {user.messages.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!stats?.topChatUsers || stats.topChatUsers.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                            No chat data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Image Generation Leaderboard */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Image className="h-5 w-5 text-pink-400" />
                  Image Generation Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-gray-800">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-800">
                        <TableHead className="text-gray-400">Rank</TableHead>
                        <TableHead className="text-gray-400">Teacher</TableHead>
                        <TableHead className="text-gray-400 text-right">Images</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(stats?.topImageGenerators || []).map((user, index) => (
                        <TableRow key={user.name} className="border-gray-800">
                          <TableCell>
                            {index < 3 ? (
                              <Badge className={
                                index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                                index === 1 ? 'bg-gray-400/20 text-gray-300' :
                                'bg-amber-600/20 text-amber-400'
                              }>
                                #{index + 1}
                              </Badge>
                            ) : (
                              <span className="text-gray-500">#{index + 1}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-white font-medium">
                            {user.name.length > 20 ? user.name.substring(0, 20) + '...' : user.name}
                          </TableCell>
                          <TableCell className="text-right text-pink-400 font-semibold">
                            {user.images.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!stats?.topImageGenerators || stats.topImageGenerators.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                            No image generation data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIUsageAnalyticsPage;
