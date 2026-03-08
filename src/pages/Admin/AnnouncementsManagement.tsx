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
import { getAllAnnouncements } from "@/services/adminService";
import type { AnnouncementStats } from "@/types/admin";
import {
  Search,
  Megaphone,
  Download,
  Pin,
  Eye,
  AlertTriangle,
  AlertCircle,
  Info,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const AnnouncementsManagement = () => {
  const [announcements, setAnnouncements] = useState<AnnouncementStats[]>([]);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<AnnouncementStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await getAllAnnouncements();
      setAnnouncements(data);
      setFilteredAnnouncements(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredAnnouncements(announcements);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredAnnouncements(
        announcements.filter(
          (a) =>
            a.title.toLowerCase().includes(query) ||
            a.message.toLowerCase().includes(query) ||
            a.teacher_name?.toLowerCase().includes(query) ||
            a.target_grade_level?.toLowerCase().includes(query) ||
            a.category?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, announcements]);

  const exportToCSV = () => {
    const headers = ['Title', 'Message', 'Teacher', 'Grade', 'Class', 'Priority', 'Pinned', 'Reads', 'Created'];
    const csvData = filteredAnnouncements.map(a => [
      a.title.replace(/,/g, ';'),
      a.message.replace(/,/g, ';').substring(0, 100),
      a.teacher_name || '',
      a.target_grade_level || 'All',
      a.target_class_name || 'All',
      a.priority,
      a.is_pinned ? 'Yes' : 'No',
      a.read_count,
      a.created_at ? format(new Date(a.created_at), 'yyyy-MM-dd') : '',
    ]);
    
    const csv = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `announcements-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'high':
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'low':
        return <Info className="w-4 h-4 text-gray-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      urgent: 'bg-red-500/20 text-red-400',
      high: 'bg-amber-500/20 text-amber-400',
      normal: 'bg-blue-500/20 text-blue-400',
      low: 'bg-gray-500/20 text-gray-400',
    };
    return styles[priority] || styles.normal;
  };

  // Stats calculations
  const pinnedCount = announcements.filter(a => a.is_pinned).length;
  const totalReads = announcements.reduce((sum, a) => sum + a.read_count, 0);
  const priorityStats = announcements.reduce((acc, a) => {
    acc[a.priority] = (acc[a.priority] || 0) + 1;
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Announcements</h1>
          <p className="text-gray-400 mt-1">
            View all announcements ({announcements.length} total)
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
              <Megaphone className="w-8 h-8 text-pink-400" />
              <div>
                <p className="text-2xl font-bold text-white">{announcements.length}</p>
                <p className="text-xs text-gray-400">Total Announcements</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Pin className="w-8 h-8 text-amber-400" />
              <div>
                <p className="text-2xl font-bold text-white">{pinnedCount}</p>
                <p className="text-xs text-gray-400">Pinned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Eye className="w-8 h-8 text-emerald-400" />
              <div>
                <p className="text-2xl font-bold text-white">{totalReads}</p>
                <p className="text-xs text-gray-400">Total Reads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-1">
              {Object.entries(priorityStats).map(([priority, count]) => (
                <Badge key={priority} className={`text-xs ${getPriorityBadge(priority)}`}>
                  {priority}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search announcements by title, message, teacher, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-gray-900/50 border-gray-700 text-white"
        />
      </div>

      {/* Announcements Table */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-400">Priority</TableHead>
                  <TableHead className="text-gray-400">Title</TableHead>
                  <TableHead className="text-gray-400">Teacher</TableHead>
                  <TableHead className="text-gray-400">Target Grade</TableHead>
                  <TableHead className="text-gray-400">Target Class</TableHead>
                  <TableHead className="text-gray-400">Pinned</TableHead>
                  <TableHead className="text-gray-400">Reads</TableHead>
                  <TableHead className="text-gray-400">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnnouncements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                      {announcements.length === 0 ? "No announcements found in the database" : "No matching announcements found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAnnouncements.map((announcement) => (
                    <TableRow key={announcement.id} className="border-gray-800 hover:bg-gray-800/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPriorityIcon(announcement.priority)}
                          <Badge className={`text-xs ${getPriorityBadge(announcement.priority)}`}>
                            {announcement.priority}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-white font-medium max-w-xs">
                        <div>
                          <p className="truncate">{announcement.title}</p>
                          <p className="text-xs text-gray-500 truncate max-w-xs">
                            {announcement.message.substring(0, 60)}...
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {announcement.teacher_name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {announcement.target_grade_level || 'All Grades'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {announcement.target_class_name || 'All Classes'}
                      </TableCell>
                      <TableCell>
                        {announcement.is_pinned ? (
                          <Pin className="w-4 h-4 text-amber-400" />
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        {announcement.read_count}
                      </TableCell>
                      <TableCell className="text-gray-300 text-sm">
                        {announcement.created_at
                          ? format(new Date(announcement.created_at), "MMM d, yyyy")
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

export default AnnouncementsManagement;
