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
import { getAllSubmissions } from "@/services/adminService";
import type { SubmissionStats } from "@/types/admin";
import {
  Search,
  FileText,
  CheckCircle,
  Star,
  Download,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const SubmissionsManagement = () => {
  const [submissions, setSubmissions] = useState<SubmissionStats[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<SubmissionStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await getAllSubmissions();
      setSubmissions(data);
      setFilteredSubmissions(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredSubmissions(submissions);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredSubmissions(
        submissions.filter(
          (s) =>
            s.assignment_title?.toLowerCase().includes(query) ||
            s.student_name?.toLowerCase().includes(query) ||
            s.teacher_name?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, submissions]);

  const exportToCSV = () => {
    const headers = ['Assignment', 'Student', 'Teacher', 'Status', 'Score', 'AI Score', 'Submitted', 'Graded'];
    const csvData = filteredSubmissions.map(s => [
      s.assignment_title?.replace(/,/g, ';') || '',
      s.student_name || '',
      s.teacher_name || '',
      s.status,
      s.score !== null ? s.score : '',
      s.ai_score !== null ? s.ai_score : '',
      s.submitted_at ? format(new Date(s.submitted_at), 'yyyy-MM-dd HH:mm') : '',
      s.graded_at ? format(new Date(s.graded_at), 'yyyy-MM-dd HH:mm') : '',
    ]);
    
    const csv = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const elem = document.createElement('a');
    elem.href = url;
    elem.download = `submissions-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    elem.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Submitted</Badge>;
      case 'graded':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Graded</Badge>;
      case 'returned':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Returned</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400">Unknown</Badge>;
    }
  };

  // Stats
  const submittedCount = submissions.filter(s => s.status === 'submitted').length;
  const gradedCount = submissions.filter(s => s.status === 'graded').length;
  const returnedCount = submissions.filter(s => s.status === 'returned').length;
  const scoredSubmissions = submissions.filter(s => s.score !== null);
  const avgScore = scoredSubmissions.length > 0
    ? (scoredSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / scoredSubmissions.length).toFixed(1)
    : '-';

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
          <h1 className="text-3xl font-bold text-white">Submissions</h1>
          <p className="text-gray-400 mt-1">
            {submissions.length} submissions from students
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
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{submittedCount}</p>
                <p className="text-xs text-gray-400">Pending</p>
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
                <p className="text-2xl font-bold text-white">{gradedCount}</p>
                <p className="text-xs text-gray-400">Graded</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileText className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{returnedCount}</p>
                <p className="text-xs text-gray-400">Returned</p>
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
                <p className="text-2xl font-bold text-white">{avgScore}</p>
                <p className="text-xs text-gray-400">Avg Score</p>
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
              placeholder="Search by assignment, student, or teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Submissions Table */}
      <Card className="bg-gray-900/50 border-gray-800 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Assignment</TableHead>
                  <TableHead className="text-gray-400">Student</TableHead>
                  <TableHead className="text-gray-400">Teacher</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400 text-center">Score</TableHead>
                  <TableHead className="text-gray-400 text-center">AI Score</TableHead>
                  <TableHead className="text-gray-400">Submitted</TableHead>
                  <TableHead className="text-gray-400">Graded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map((submission, index) => (
                  <motion.tr
                    key={submission.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.01 }}
                    className="border-gray-800 hover:bg-gray-800/50"
                  >
                    <TableCell>
                      <p className="font-medium text-white max-w-xs truncate">
                        {submission.assignment_title || '-'}
                      </p>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {submission.student_name || '-'}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {submission.teacher_name || '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(submission.status)}</TableCell>
                    <TableCell className="text-center">
                      {submission.score !== null ? (
                        <span className="text-green-400 font-medium">
                          {submission.score}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {submission.ai_score !== null ? (
                        <span className="text-purple-400 font-medium">
                          {submission.ai_score}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {submission.submitted_at
                        ? format(new Date(submission.submitted_at), 'MMM d, HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {submission.graded_at
                        ? format(new Date(submission.graded_at), 'MMM d, HH:mm')
                        : '-'}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredSubmissions.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No submissions found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubmissionsManagement;
