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
import { getAllAssignments } from "@/services/adminService";
import type { AssignmentStats } from "@/types/admin";
import {
  Search,
  ClipboardList,
  Users,
  CheckCircle,
  Star,
  Download,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const AssignmentsManagement = () => {
  const [assignments, setAssignments] = useState<AssignmentStats[]>([]);
  const [filteredAssignments, setFilteredAssignments] = useState<AssignmentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await getAllAssignments();
      setAssignments(data);
      setFilteredAssignments(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredAssignments(assignments);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredAssignments(
        assignments.filter(
          (a) =>
            a.title.toLowerCase().includes(query) ||
            a.grade_level.toLowerCase().includes(query) ||
            a.subject.toLowerCase().includes(query) ||
            a.teacher_name?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, assignments]);

  const exportToCSV = () => {
    const headers = ['Title', 'Subject', 'Grade', 'Teacher', 'Students', 'Submitted', 'Graded', 'Avg Score', 'Due Date', 'Status'];
    const csvData = filteredAssignments.map(a => [
      a.title.replace(/,/g, ';'),
      a.subject,
      a.grade_level,
      a.teacher_name || '',
      a.total_students,
      a.submitted_count,
      a.graded_count,
      a.average_score !== null ? a.average_score.toFixed(1) : '',
      a.due_date ? format(new Date(a.due_date), 'yyyy-MM-dd') : '',
      a.status,
    ]);
    
    const csv = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const elem = document.createElement('a');
    elem.href = url;
    elem.download = `assignments-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    elem.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Draft</Badge>;
      case 'closed':
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Closed</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400">Unknown</Badge>;
    }
  };

  // Stats calculations
  const totalStudentsAssigned = assignments.reduce((sum, a) => sum + a.total_students, 0);
  const totalSubmissions = assignments.reduce((sum, a) => sum + a.submitted_count, 0);
  const totalGraded = assignments.reduce((sum, a) => sum + a.graded_count, 0);

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
          <h1 className="text-3xl font-bold text-white">Assignments</h1>
          <p className="text-gray-400 mt-1">
            {assignments.length} assignments created by teachers
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
              <div className="p-2 rounded-lg bg-amber-500/10">
                <ClipboardList className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{assignments.length}</p>
                <p className="text-xs text-gray-400">Assignments</p>
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
                <p className="text-2xl font-bold text-white">{totalStudentsAssigned}</p>
                <p className="text-xs text-gray-400">Assigned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <CheckCircle className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalSubmissions}</p>
                <p className="text-xs text-gray-400">Submitted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Star className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalGraded}</p>
                <p className="text-xs text-gray-400">Graded</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by title, subject, grade, or teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Assignments Table */}
      <Card className="bg-gray-900/50 border-gray-800 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Title</TableHead>
                  <TableHead className="text-gray-400">Subject</TableHead>
                  <TableHead className="text-gray-400">Grade</TableHead>
                  <TableHead className="text-gray-400">Teacher</TableHead>
                  <TableHead className="text-gray-400 text-center">Students</TableHead>
                  <TableHead className="text-gray-400 text-center">Submitted</TableHead>
                  <TableHead className="text-gray-400 text-center">Graded</TableHead>
                  <TableHead className="text-gray-400 text-center">Avg Score</TableHead>
                  <TableHead className="text-gray-400">Due</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map((assignment, index) => (
                  <motion.tr
                    key={assignment.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="border-gray-800 hover:bg-gray-800/50"
                  >
                    <TableCell>
                      <p className="font-medium text-white max-w-xs truncate">
                        {assignment.title}
                      </p>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {assignment.subject}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-400">
                        {assignment.grade_level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {assignment.teacher_name || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-blue-400 font-medium">
                        {assignment.total_students}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-purple-400 font-medium">
                        {assignment.submitted_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-green-400 font-medium">
                        {assignment.graded_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {assignment.average_score !== null ? (
                        <span className="text-cyan-400 font-medium">
                          {assignment.average_score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {assignment.due_date
                        ? format(new Date(assignment.due_date), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(assignment.status)}</TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredAssignments.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No assignments found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AssignmentsManagement;
