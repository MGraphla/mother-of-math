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
import { getAllComments } from "@/services/adminService";
import type { CommentStats } from "@/types/admin";
import {
  Search,
  MessageCircle,
  Download,
  Lock,
  Unlock,
  User,
  GraduationCap,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const CommentsManagement = () => {
  const [comments, setComments] = useState<CommentStats[]>([]);
  const [filteredComments, setFilteredComments] = useState<CommentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await getAllComments();
      setComments(data);
      setFilteredComments(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredComments(comments);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredComments(
        comments.filter(
          (c) =>
            c.message.toLowerCase().includes(query) ||
            c.assignment_title?.toLowerCase().includes(query) ||
            c.student_name?.toLowerCase().includes(query) ||
            c.teacher_name?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, comments]);

  const exportToCSV = () => {
    const headers = ['Assignment', 'Author', 'Author Type', 'Message', 'Private', 'Created'];
    const csvData = filteredComments.map(c => [
      c.assignment_title?.replace(/,/g, ';') || '',
      c.student_name || c.teacher_name || 'Unknown',
      c.student_id ? 'Student' : 'Teacher',
      c.message.replace(/,/g, ';').substring(0, 100),
      c.is_private ? 'Yes' : 'No',
      c.created_at ? format(new Date(c.created_at), 'yyyy-MM-dd HH:mm') : '',
    ]);
    
    const csv = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comments-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  // Stats calculations
  const privateComments = comments.filter(c => c.is_private).length;
  const studentComments = comments.filter(c => c.student_id).length;
  const teacherComments = comments.filter(c => c.teacher_id).length;

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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Comments</h1>
          <p className="text-gray-400 mt-1">
            View all assignment comments ({comments.length} total)
          </p>
        </div>
        <Button
          onClick={exportToCSV}
          className="bg-emerald-600 hover:bg-emerald-700"
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
              <MessageCircle className="w-8 h-8 text-teal-400" />
              <div>
                <p className="text-2xl font-bold text-white">{comments.length}</p>
                <p className="text-xs text-gray-400">Total Comments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="text-2xl font-bold text-white">{studentComments}</p>
                <p className="text-xs text-gray-400">From Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <User className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">{teacherComments}</p>
                <p className="text-xs text-gray-400">From Teachers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Lock className="w-8 h-8 text-amber-400" />
              <div>
                <p className="text-2xl font-bold text-white">{privateComments}</p>
                <p className="text-xs text-gray-400">Private Comments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search comments by message, assignment, student, or teacher..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-gray-900/50 border-gray-700 text-white"
        />
      </div>

      {/* Comments Table */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-400">Author</TableHead>
                  <TableHead className="text-gray-400">Type</TableHead>
                  <TableHead className="text-gray-400">Assignment</TableHead>
                  <TableHead className="text-gray-400">Message</TableHead>
                  <TableHead className="text-gray-400">Private</TableHead>
                  <TableHead className="text-gray-400">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                      {comments.length === 0 ? "No comments found in the database" : "No matching comments found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredComments.map((comment) => (
                    <TableRow key={comment.id} className="border-gray-800 hover:bg-gray-800/50">
                      <TableCell className="text-white font-medium">
                        {comment.student_name || comment.teacher_name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {comment.student_id ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400">
                            <GraduationCap className="w-3 h-3 mr-1" />
                            Student
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500/20 text-blue-400">
                            <User className="w-3 h-3 mr-1" />
                            Teacher
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-300 max-w-xs truncate">
                        {comment.assignment_title || 'Unknown Assignment'}
                      </TableCell>
                      <TableCell className="text-gray-300 max-w-md">
                        <p className="truncate">{comment.message}</p>
                      </TableCell>
                      <TableCell>
                        {comment.is_private ? (
                          <Lock className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Unlock className="w-4 h-4 text-gray-500" />
                        )}
                      </TableCell>
                      <TableCell className="text-gray-300 text-sm">
                        {comment.created_at
                          ? format(new Date(comment.created_at), "MMM d, yyyy HH:mm")
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommentsManagement;
