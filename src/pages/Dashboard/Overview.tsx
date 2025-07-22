import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, ClipboardCheck, Star, BookOpen } from 'lucide-react';

// Mock Data
const kpiData = [
  { title: "Total Students", value: "78", icon: <Users className="w-8 h-8 text-primary" />, color: "text-primary" },
  { title: "Assignments Graded", value: "124", icon: <ClipboardCheck className="w-8 h-8 text-green-500" />, color: "text-green-500" },
  { title: "Average Score", value: "8.2/10", icon: <Star className="w-8 h-8 text-yellow-500" />, color: "text-yellow-500" },
  { title: "Lesson Plans Created", value: "12", icon: <BookOpen className="w-8 h-8 text-blue-500" />, color: "text-blue-500" },
];

const chartData = [
  { name: 'Jan', score: 65 },
  { name: 'Feb', score: 72 },
  { name: 'Mar', score: 81 },
  { name: 'Apr', score: 75 },
  { name: 'May', score: 88 },
  { name: 'Jun', score: 92 },
];

const recentSubmissions = [
  { student: 'Fosso Yannick', assignment: 'Addition & Subtraction', status: 'Graded', score: '10/10' },
  { student: 'Ngo Madeleine', assignment: 'Multiplication Tables', status: 'Pending', score: '-' },
  { student: 'Tchami Joel', assignment: 'Basic Fractions', status: 'Graded', score: '8/10' },
  { student: 'Abena Therese', assignment: 'Telling Time', status: 'Pending', score: '-' },
  { student: 'Biyik Andre', assignment: 'Counting Coins', status: 'Graded', score: '9/10' },
];

export default function Overview() {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-gray-800">Welcome back, {profile?.fullName || 'User'}!</h1>
        <p className="text-lg text-gray-500 mt-1">Here's a snapshot of your class's progress.</p>
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
            <CardTitle className="text-xl font-bold text-gray-800">Class Performance Trend</CardTitle>
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
            <CardTitle className="text-xl font-bold text-gray-800">Recent Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Status</TableHead>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
