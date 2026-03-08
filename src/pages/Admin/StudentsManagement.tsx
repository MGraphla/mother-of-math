import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { getAllStudents } from "@/services/adminService";
import type { StudentStats } from "@/types/admin";
import {
  Search,
  GraduationCap,
  Users,
  FileText,
  Star,
  Download,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const StudentsManagement = () => {
  const [students, setStudents] = useState<StudentStats[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await getAllStudents();
      setStudents(data);
      setFilteredStudents(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredStudents(students);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredStudents(
        students.filter(
          (s) =>
            s.full_name.toLowerCase().includes(query) ||
            s.grade_level.toLowerCase().includes(query) ||
            s.teacher_name?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, students]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Paused</Badge>;
      case 'suspended':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Suspended</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400">Unknown</Badge>;
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Grade', 'Teacher', 'Submissions', 'Avg Score', 'Status', 'Created'];
    const csvData = filteredStudents.map(s => [
      s.full_name,
      s.grade_level,
      s.teacher_name || '',
      s.total_submissions,
      s.average_score !== null ? s.average_score.toFixed(1) : '',
      s.account_status,
      s.created_at ? format(new Date(s.created_at), 'yyyy-MM-dd') : '',
    ]);
    
    const csv = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  // Group by grade for stats
  const gradeStats = students.reduce((acc, s) => {
    acc[s.grade_level] = (acc[s.grade_level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Students Overview</h1>
          <p className="text-gray-400 mt-1">
            {students.length} students registered across all teachers
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
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <GraduationCap className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{students.length}</p>
                <p className="text-xs text-gray-400">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {new Set(students.map(s => s.teacher_id)).size}
                </p>
                <p className="text-xs text-gray-400">Teachers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <FileText className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {students.reduce((sum, s) => sum + s.total_submissions, 0)}
                </p>
                <p className="text-xs text-gray-400">Submissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {(() => {
                    const scored = students.filter(s => s.average_score !== null);
                    if (scored.length === 0) return '-';
                    const avg = scored.reduce((sum, s) => sum + (s.average_score || 0), 0) / scored.length;
                    return avg.toFixed(1);
                  })()}
                </p>
                <p className="text-xs text-gray-400">Avg Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grade Distribution */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Students by Grade Level</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(gradeStats).sort((a, b) => a[0].localeCompare(b[0])).map(([grade, count]) => (
              <Badge key={grade} variant="outline" className="bg-gray-800/50 border-gray-700 text-white">
                {grade}: <span className="ml-1 text-emerald-400">{count}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name, grade, or teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card className="bg-gray-900/50 border-gray-800 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Student</TableHead>
                  <TableHead className="text-gray-400">Grade</TableHead>
                  <TableHead className="text-gray-400">Teacher</TableHead>
                  <TableHead className="text-gray-400 text-center">Submissions</TableHead>
                  <TableHead className="text-gray-400 text-center">Avg Score</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student, index) => (
                  <motion.tr
                    key={student.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-gray-800 hover:bg-gray-800/50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <span className="text-emerald-400 font-medium text-sm">
                            {student.full_name.charAt(0)}
                          </span>
                        </div>
                        <p className="font-medium text-white">{student.full_name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30 text-purple-400">
                        {student.grade_level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {student.teacher_name || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-cyan-400 font-medium">
                        {student.total_submissions}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {student.average_score !== null ? (
                        <span className="text-amber-400 font-medium">
                          {student.average_score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(student.account_status)}</TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {student.created_at
                        ? format(new Date(student.created_at), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredStudents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No students found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentsManagement;
