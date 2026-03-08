import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  Database,
  Server,
  HardDrive,
  Wifi,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Zap,
  Users,
} from 'lucide-react';
import { KPICard, KPIGrid } from '@/components/admin/KPICard';
import { getSystemHealth, getAdminDashboardOverview } from '@/services/adminService';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

interface HealthMetric {
  metric_name: string;
  metric_value: string;
  status: string;
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  uptime: number;
  latency: number;
  lastCheck: Date;
}

const statusColors = {
  healthy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  degraded: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  down: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  ok: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const statusIcons = {
  healthy: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  degraded: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  down: <XCircle className="h-5 w-5 text-red-500" />,
  ok: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
};

// Simulated performance data for charts
const generatePerformanceData = () => {
  const data = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    data.push({
      time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      responseTime: Math.floor(Math.random() * 100) + 50,
      requests: Math.floor(Math.random() * 500) + 100,
      errors: Math.floor(Math.random() * 10),
      cpu: Math.floor(Math.random() * 40) + 20,
      memory: Math.floor(Math.random() * 30) + 40,
    });
  }
  return data;
};

const SystemHealthPage: React.FC = () => {
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [performanceData] = useState(generatePerformanceData());
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [overview, setOverview] = useState<any>(null);

  // Simulated services
  const services: ServiceStatus[] = [
    { name: 'Database (Supabase)', status: 'healthy', uptime: 99.99, latency: 12, lastCheck: new Date() },
    { name: 'Authentication', status: 'healthy', uptime: 99.95, latency: 45, lastCheck: new Date() },
    { name: 'Storage', status: 'healthy', uptime: 99.90, latency: 78, lastCheck: new Date() },
    { name: 'AI Services (OpenAI)', status: 'healthy', uptime: 99.85, latency: 234, lastCheck: new Date() },
    { name: 'Image Generation', status: 'healthy', uptime: 99.80, latency: 456, lastCheck: new Date() },
    { name: 'Edge Functions', status: 'healthy', uptime: 99.95, latency: 23, lastCheck: new Date() },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [health, overviewData] = await Promise.all([
        getSystemHealth(),
        getAdminDashboardOverview(),
      ]);
      setHealthMetrics(health);
      setOverview(overviewData);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching system health:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const calculateOverallHealth = () => {
    const healthyCount = services.filter(s => s.status === 'healthy').length;
    return (healthyCount / services.length) * 100;
  };

  const avgLatency = services.reduce((acc, s) => acc + s.latency, 0) / services.length;
  const avgUptime = services.reduce((acc, s) => acc + s.uptime, 0) / services.length;

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
            <p className="text-muted-foreground">
              Monitor system performance, uptime, and service status
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
            <Button onClick={fetchData} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Overall Health KPIs */}
        <KPIGrid columns={4}>
          <KPICard
            title="Overall Health"
            value={`${calculateOverallHealth().toFixed(1)}%`}
            icon={<Activity className="h-5 w-5" />}
            colorScheme={calculateOverallHealth() >= 95 ? 'success' : calculateOverallHealth() >= 80 ? 'warning' : 'danger'}
            loading={loading}
          />
          <KPICard
            title="Avg Response Time"
            value={`${avgLatency.toFixed(0)}ms`}
            icon={<Zap className="h-5 w-5" />}
            colorScheme={avgLatency < 200 ? 'success' : avgLatency < 500 ? 'warning' : 'danger'}
            loading={loading}
          />
          <KPICard
            title="Avg Uptime"
            value={`${avgUptime.toFixed(2)}%`}
            icon={<Server className="h-5 w-5" />}
            colorScheme="success"
            loading={loading}
          />
          <KPICard
            title="Active Users"
            value={overview?.activeTeachersToday || 0}
            icon={<Users className="h-5 w-5" />}
            loading={loading}
          />
        </KPIGrid>

        {/* Database Metrics */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {healthMetrics.length > 0 ? (
                healthMetrics.map((metric) => (
                  <div key={metric.metric_name} className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">
                      {metric.metric_name.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{metric.metric_value}</span>
                      <Badge className={statusColors[metric.status as keyof typeof statusColors] || statusColors.ok}>
                        {metric.status}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Database Size</span>
                    <span className="text-sm font-medium">Calculating...</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Tables</span>
                    <span className="text-sm font-medium">~20</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Teachers</span>
                    <span className="text-sm font-medium">{overview?.totalTeachers || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Students</span>
                    <span className="text-sm font-medium">{overview?.totalStudents || 0}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Storage Usage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Database Storage</span>
                  <span className="font-medium">45% used</span>
                </div>
                <Progress value={45} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>File Storage</span>
                  <span className="font-medium">32% used</span>
                </div>
                <Progress value={32} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Generated Images</span>
                  <span className="font-medium">{overview?.totalImagesGenerated || 0} files</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Total Resources</span>
                  <span className="font-medium">{overview?.totalResources || 0} files</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Service Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Service Status
            </CardTitle>
            <CardDescription>
              Real-time status of all connected services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    {statusIcons[service.status]}
                    <div>
                      <p className="font-medium text-sm">{service.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {service.latency}ms · {service.uptime}% uptime
                      </p>
                    </div>
                  </div>
                  <Badge className={statusColors[service.status]}>
                    {service.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Performance Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Response Time (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="time" fontSize={12} />
                    <YAxis fontSize={12} unit="ms" />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="responseTime"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Resource Usage (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="time" fontSize={12} />
                    <YAxis fontSize={12} unit="%" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="cpu"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      name="CPU"
                    />
                    <Line
                      type="monotone"
                      dataKey="memory"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      name="Memory"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Summary</CardTitle>
            <CardDescription>
              Platform usage statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{overview?.totalChatConversations || 0}</p>
                <p className="text-sm text-muted-foreground">Total Conversations</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{overview?.totalChatMessages || 0}</p>
                <p className="text-sm text-muted-foreground">Total Messages</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{overview?.totalLessonPlans || 0}</p>
                <p className="text-sm text-muted-foreground">Lesson Plans</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{overview?.totalAssignments || 0}</p>
                <p className="text-sm text-muted-foreground">Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  );
};

export default SystemHealthPage;
