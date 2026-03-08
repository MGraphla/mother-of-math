import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getAllStudentWorks } from "@/services/adminService";
import type { StudentWorkStats } from "@/types/admin";
import {
  Search,
  Upload,
  Download,
  FileText,
  Image,
  Users,
  BookOpen,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const UploadsManagement = () => {
  const [studentWorks, setStudentWorks] = useState<StudentWorkStats[]>([]);
  const [filteredWorks, setFilteredWorks] = useState<StudentWorkStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWork, setSelectedWork] = useState<StudentWorkStats | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('Fetching student works...');
        const data = await getAllStudentWorks();
        console.log('Student works received:', data.length, 'records');
        setStudentWorks(data);
        setFilteredWorks(data);
        if (data.length === 0) {
          setError('No student work data found. Make sure to run the SQL functions in Supabase and that teachers have uploaded student work.');
        }
      } catch (err) {
        console.error('Error fetching student works:', err);
        setError('Failed to fetch student work data. Check console for details.');
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredWorks(studentWorks);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredWorks(
        studentWorks.filter(
          (w) =>
            w.student_name.toLowerCase().includes(query) ||
            w.subject?.toLowerCase().includes(query) ||
            w.teacher_name?.toLowerCase().includes(query) ||
            w.grade?.toLowerCase().includes(query) ||
            w.file_name?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, studentWorks]);

  // Calculate stats
  const totalUploads = studentWorks.length;
  const analyzedCount = studentWorks.filter(w => w.feedback).length;
  const pendingCount = studentWorks.filter(w => !w.feedback).length;
  const uniqueTeachers = new Set(studentWorks.map(w => w.teacher_id)).size;

  // Subject distribution
  const subjectStats = studentWorks.reduce((acc, w) => {
    const subject = w.subject || 'Unspecified';
    acc[subject] = (acc[subject] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const subjectData = Object.entries(subjectStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  // Grade distribution
  const gradeStats = studentWorks.reduce((acc, w) => {
    const grade = w.grade || 'Unspecified';
    acc[grade] = (acc[grade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const gradeData = Object.entries(gradeStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  // Top uploaders (teachers)
  const teacherUploads = studentWorks.reduce((acc, w) => {
    const name = w.teacher_name || 'Unknown';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topUploaders = Object.entries(teacherUploads)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Analysis status
  const analysisData = [
    { name: 'Analyzed', value: analyzedCount },
    { name: 'Pending', value: pendingCount },
  ];

  const exportToCSV = () => {
    const headers = ['Student', 'Subject', 'Grade', 'Teacher', 'Status', 'File Name', 'Created'];
    const csvData = filteredWorks.map(w => [
      w.student_name.replace(/,/g, ';'),
      w.subject || '',
      w.grade || '',
      w.teacher_name || '',
      w.feedback ? 'Analyzed' : 'Pending',
      w.file_name || '',
      w.created_at ? format(new Date(w.created_at), 'yyyy-MM-dd HH:mm') : '',
    ]);
    
    const csv = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student-uploads-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const handlePreview = (work: StudentWorkStats) => {
    setSelectedWork(work);
    setShowPreview(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <p className="text-amber-400 font-medium">Notice</p>
            <p className="text-amber-300/80 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Student Work Uploads</h1>
          <p className="text-gray-400 mt-1">
            Monitor all student work uploaded by teachers for AI analysis
          </p>
        </div>
        <Button 
          onClick={exportToCSV}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Upload className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalUploads}</p>
                <p className="text-xs text-gray-400">Total Uploads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{analyzedCount}</p>
                <p className="text-xs text-gray-400">Analyzed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{pendingCount}</p>
                <p className="text-xs text-gray-400">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Users className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{uniqueTeachers}</p>
                <p className="text-xs text-gray-400">Active Teachers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject Distribution */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">By Subject</CardTitle>
          </CardHeader>
          <CardContent>
            {subjectData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={subjectData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {subjectData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis Status */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Analysis Status</CardTitle>
          </CardHeader>
          <CardContent>
            {analysisData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analysisData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Uploaders */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Top Uploaders</CardTitle>
          </CardHeader>
          <CardContent>
            {topUploaders.length > 0 ? (
              <div className="space-y-3 max-h-[250px] overflow-y-auto">
                {topUploaders.map((uploader, index) => (
                  <div key={uploader.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-5">{index + 1}.</span>
                      <span className="text-white text-sm truncate max-w-[120px]">
                        {uploader.name}
                      </span>
                    </div>
                    <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
                      {uploader.count}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-gray-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grade Distribution Bar Chart */}
      {gradeData.length > 0 && (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Uploads by Grade Level</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={gradeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Search and Table */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by student, teacher, subject, grade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-900/50 border-gray-800 text-white"
          />
        </div>

        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-400">Student</TableHead>
                  <TableHead className="text-gray-400">Subject</TableHead>
                  <TableHead className="text-gray-400">Grade</TableHead>
                  <TableHead className="text-gray-400">Teacher</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400">Uploaded</TableHead>
                  <TableHead className="text-gray-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No student work uploads found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWorks.slice(0, 50).map((work) => (
                    <TableRow key={work.id} className="border-gray-800">
                      <TableCell className="text-white font-medium">
                        <div className="flex items-center gap-2">
                          <Image className="w-4 h-4 text-purple-400" />
                          <span className="truncate max-w-[150px]">{work.student_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-gray-300">
                          {work.subject || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {work.grade || '-'}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {work.teacher_name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {work.feedback ? (
                          <Badge className="bg-green-500/20 text-green-400">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Analyzed
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/20 text-amber-400">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-400 text-sm">
                        {work.created_at 
                          ? format(new Date(work.created_at), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(work)}
                          className="text-gray-400 hover:text-white"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {filteredWorks.length > 50 && (
              <div className="p-4 text-center text-gray-500 border-t border-gray-800">
                Showing 50 of {filteredWorks.length} uploads
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Student Work Details</DialogTitle>
          </DialogHeader>
          {selectedWork && (
            <div className="space-y-4">
              {/* Image Preview */}
              {selectedWork.image_url && (
                <div className="rounded-lg overflow-hidden bg-gray-800">
                  <img 
                    src={selectedWork.image_url} 
                    alt="Student work"
                    className="w-full max-h-[300px] object-contain"
                  />
                </div>
              )}
              
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Student</p>
                  <p className="text-white">{selectedWork.student_name}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Teacher</p>
                  <p className="text-white">{selectedWork.teacher_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Subject</p>
                  <p className="text-white">{selectedWork.subject || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Grade</p>
                  <p className="text-white">{selectedWork.grade || 'N/A'}</p>
                </div>
              </div>

              {/* Feedback Section */}
              {selectedWork.feedback && (
                <div>
                  <p className="text-gray-400 text-sm mb-2">AI Feedback</p>
                  <div className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 max-h-[200px] overflow-y-auto">
                    {selectedWork.feedback}
                  </div>
                </div>
              )}

              {/* Error Type & Remediation */}
              {(selectedWork.error_type || selectedWork.remediation) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedWork.error_type && (
                    <div>
                      <p className="text-gray-400 text-sm mb-2">Error Type</p>
                      <Badge variant="outline" className="text-red-400 border-red-400/30">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {selectedWork.error_type}
                      </Badge>
                    </div>
                  )}
                  {selectedWork.remediation && (
                    <div>
                      <p className="text-gray-400 text-sm mb-2">Remediation</p>
                      <p className="text-gray-300 text-sm">{selectedWork.remediation}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UploadsManagement;
