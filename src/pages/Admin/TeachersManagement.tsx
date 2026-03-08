import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { getAllTeachers, updateTeacherStatus } from "@/services/adminService";
import type { TeacherStats } from "@/types/admin";
import {
  Search,
  MoreVertical,
  Mail,
  School,
  MapPin,
  Users,
  BookOpen,
  ClipboardList,
  MessageSquare,
  PlayCircle,
  PauseCircle,
  Ban,
  Eye,
  Download,
  CheckSquare,
  XSquare,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";

const TeachersManagement = () => {
  const [teachers, setTeachers] = useState<TeacherStats[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<TeacherStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherStats | null>(null);
  
  // Bulk action states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkActionDialog, setBulkActionDialog] = useState<{
    open: boolean;
    action: 'active' | 'paused' | 'suspended' | null;
  }>({ open: false, action: null });

  // Derived state for select all
  const allSelected = useMemo(() => 
    filteredTeachers.length > 0 && filteredTeachers.every(t => selectedIds.has(t.id)),
    [filteredTeachers, selectedIds]
  );
  const someSelected = useMemo(() => 
    filteredTeachers.some(t => selectedIds.has(t.id)) && !allSelected,
    [filteredTeachers, selectedIds, allSelected]
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await getAllTeachers();
      setTeachers(data);
      setFilteredTeachers(data);
      setLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredTeachers(teachers);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredTeachers(
        teachers.filter(
          (t) =>
            t.full_name.toLowerCase().includes(query) ||
            t.email.toLowerCase().includes(query) ||
            t.school_name?.toLowerCase().includes(query) ||
            t.country?.toLowerCase().includes(query)
        )
      );
    }
    // Clear selection when filter changes
    setSelectedIds(new Set());
  }, [searchQuery, teachers]);

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTeachers.map(t => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk action handler
  const handleBulkStatusChange = async (status: 'active' | 'paused' | 'suspended') => {
    setBulkActionLoading(true);
    try {
      const selectedIdArray = Array.from(selectedIds);
      let successCount = 0;
      let failCount = 0;

      for (const teacherId of selectedIdArray) {
        const success = await updateTeacherStatus(teacherId, status);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      // Update local state
      setTeachers(prev =>
        prev.map(t => 
          selectedIds.has(t.id) ? { ...t, account_status: status } : t
        )
      );

      // Clear selection
      setSelectedIds(new Set());

      // Show result toast
      if (successCount > 0) {
        toast.success(`Updated ${successCount} teacher(s) to ${status}`);
      }
      if (failCount > 0) {
        toast.error(`Failed to update ${failCount} teacher(s)`);
      }
    } catch (error) {
      console.error('Bulk action error:', error);
      toast.error('An error occurred during bulk action');
    } finally {
      setBulkActionLoading(false);
      setBulkActionDialog({ open: false, action: null });
    }
  };

  // Export selected or all
  const exportSelectedToCSV = () => {
    const teachersToExport = selectedIds.size > 0 
      ? filteredTeachers.filter(t => selectedIds.has(t.id))
      : filteredTeachers;
    
    const headers = [
      'Name', 'Email', 'Gender', 'Date of Birth', 'Phone', 'WhatsApp', 
      'Country', 'City', 'School Name', 'School Type', 'School Address', 
      'Number of Students', 'Education Level', 'Years of Experience', 
      'Subjects Taught', 'Grade Levels', 'Preferred Language', 'Bio',
      'Total Students', 'Total Lessons', 'Total Assignments', 'Total Messages',
      'Total Resources', 'Total Announcements', 'Account Status', 'Created At'
    ];
    const escapeCSV = (value: string | number | null | undefined) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const csvData = teachersToExport.map(t => [
      escapeCSV(t.full_name),
      escapeCSV(t.email),
      escapeCSV(t.gender),
      escapeCSV(t.date_of_birth),
      escapeCSV(t.phone_number),
      escapeCSV(t.whatsapp_number),
      escapeCSV(t.country),
      escapeCSV(t.city),
      escapeCSV(t.school_name),
      escapeCSV(t.school_type),
      escapeCSV(t.school_address),
      escapeCSV(t.number_of_students),
      escapeCSV(t.education_level),
      escapeCSV(t.years_of_experience),
      escapeCSV(t.subjects_taught),
      escapeCSV(t.grade_levels),
      escapeCSV(t.preferred_language),
      escapeCSV(t.bio),
      t.total_students,
      t.total_lesson_plans,
      t.total_assignments,
      t.total_chatbot_messages,
      t.total_resources || 0,
      t.total_announcements || 0,
      escapeCSV(t.account_status),
      t.created_at ? format(new Date(t.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
    ]);
    
    const csv = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = selectedIds.size > 0 ? `-selected-${selectedIds.size}` : '';
    a.download = `teachers-export${suffix}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    
    toast.success(`Exported ${teachersToExport.length} teacher(s) to CSV`);
  };

  const handleStatusChange = async (teacherId: string, status: 'active' | 'paused' | 'suspended') => {
    const success = await updateTeacherStatus(teacherId, status);
    if (success) {
      setTeachers(prev =>
        prev.map(t => (t.id === teacherId ? { ...t, account_status: status } : t))
      );
    }
  };

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
      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={bulkActionDialog.open} onOpenChange={(open) => setBulkActionDialog({ ...bulkActionDialog, open })}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Confirm Bulk Action
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to change the status of {selectedIds.size} teacher(s) to{' '}
              <span className={
                bulkActionDialog.action === 'active' ? 'text-green-400' :
                bulkActionDialog.action === 'paused' ? 'text-yellow-400' :
                'text-red-400'
              }>
                {bulkActionDialog.action}
              </span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkActionDialog.action && handleBulkStatusChange(bulkActionDialog.action)}
              className={
                bulkActionDialog.action === 'active' ? 'bg-green-600 hover:bg-green-700' :
                bulkActionDialog.action === 'paused' ? 'bg-yellow-600 hover:bg-yellow-700' :
                'bg-red-600 hover:bg-red-700'
              }
              disabled={bulkActionLoading}
            >
              {bulkActionLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                'Confirm'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Teachers Management</h1>
          <p className="text-gray-400 mt-1">
            {teachers.length} teachers registered on the platform
          </p>
        </div>
        <Button 
          onClick={exportSelectedToCSV}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Download className="w-4 h-4 mr-2" />
          {selectedIds.size > 0 ? `Export Selected (${selectedIds.size})` : 'Export CSV'}
        </Button>
      </div>

      {/* Bulk Actions Toolbar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-indigo-900/30 border border-indigo-700/50 rounded-lg p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckSquare className="w-5 h-5 text-indigo-400" />
                <span className="text-white font-medium">
                  {selectedIds.size} teacher{selectedIds.size !== 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="text-gray-400 hover:text-white"
                >
                  <XSquare className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm mr-2">Bulk Actions:</span>
                <Button
                  size="sm"
                  onClick={() => setBulkActionDialog({ open: true, action: 'active' })}
                  className="bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/40"
                  disabled={bulkActionLoading}
                >
                  <PlayCircle className="w-4 h-4 mr-1" />
                  Activate
                </Button>
                <Button
                  size="sm"
                  onClick={() => setBulkActionDialog({ open: true, action: 'paused' })}
                  className="bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 border border-yellow-600/40"
                  disabled={bulkActionLoading}
                >
                  <PauseCircle className="w-4 h-4 mr-1" />
                  Pause
                </Button>
                <Button
                  size="sm"
                  onClick={() => setBulkActionDialog({ open: true, action: 'suspended' })}
                  className="bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/40"
                  disabled={bulkActionLoading}
                >
                  <Ban className="w-4 h-4 mr-1" />
                  Suspend
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{teachers.length}</p>
                <p className="text-xs text-gray-400">Total Teachers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {teachers.reduce((sum, t) => sum + t.total_students, 0)}
                </p>
                <p className="text-xs text-gray-400">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <BookOpen className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {teachers.reduce((sum, t) => sum + t.total_lesson_plans, 0)}
                </p>
                <p className="text-xs text-gray-400">Lesson Plans</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {teachers.reduce((sum, t) => sum + t.total_chatbot_messages, 0)}
                </p>
                <p className="text-xs text-gray-400">Chat Messages</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by name, email, school, or country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800/50 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Teachers Table */}
      <Card className="bg-gray-900/50 border-gray-800 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="w-12 text-gray-400">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      className="border-gray-600 data-[state=checked]:bg-indigo-600"
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="text-gray-400">Teacher</TableHead>
                  <TableHead className="text-gray-400">School</TableHead>
                  <TableHead className="text-gray-400">Country</TableHead>
                  <TableHead className="text-gray-400 text-center">Students</TableHead>
                  <TableHead className="text-gray-400 text-center">Lessons</TableHead>
                  <TableHead className="text-gray-400 text-center">Assignments</TableHead>
                  <TableHead className="text-gray-400 text-center">Messages</TableHead>
                  <TableHead className="text-gray-400">Joined</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400 w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.map((teacher, index) => (
                  <motion.tr
                    key={teacher.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={`border-gray-800 hover:bg-gray-800/50 ${selectedIds.has(teacher.id) ? 'bg-indigo-900/20' : ''}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(teacher.id)}
                        onCheckedChange={() => toggleSelect(teacher.id)}
                        className="border-gray-600 data-[state=checked]:bg-indigo-600"
                        aria-label={`Select ${teacher.full_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{teacher.full_name}</p>
                        <p className="text-xs text-gray-500">{teacher.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {teacher.school_name || '-'}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {teacher.country || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-emerald-400 font-medium">
                        {teacher.total_students}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-purple-400 font-medium">
                        {teacher.total_lesson_plans}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-amber-400 font-medium">
                        {teacher.total_assignments}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-cyan-400 font-medium">
                        {teacher.total_chatbot_messages}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {teacher.created_at
                        ? format(new Date(teacher.created_at), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(teacher.account_status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4 text-gray-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-gray-800 border-gray-700"
                        >
                          <DropdownMenuItem
                            onClick={() => setSelectedTeacher(teacher)}
                            className="text-gray-300 focus:bg-gray-700 focus:text-white"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {teacher.account_status !== 'active' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(teacher.id, 'active')}
                              className="text-green-400 focus:bg-gray-700"
                            >
                              <PlayCircle className="w-4 h-4 mr-2" />
                              Activate
                            </DropdownMenuItem>
                          )}
                          {teacher.account_status !== 'paused' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(teacher.id, 'paused')}
                              className="text-yellow-400 focus:bg-gray-700"
                            >
                              <PauseCircle className="w-4 h-4 mr-2" />
                              Pause Account
                            </DropdownMenuItem>
                          )}
                          {teacher.account_status !== 'suspended' && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(teacher.id, 'suspended')}
                              className="text-red-400 focus:bg-gray-700"
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              Suspend Account
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredTeachers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No teachers found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teacher Details Modal - Shows ALL profile information */}
      {selectedTeacher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900 border border-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  {selectedTeacher.avatar_url ? (
                    <img 
                      src={selectedTeacher.avatar_url} 
                      alt={selectedTeacher.full_name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-2xl font-bold text-white">
                      {selectedTeacher.full_name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {selectedTeacher.full_name}
                    </h2>
                    <p className="text-gray-400">{selectedTeacher.email}</p>
                    <div className="mt-1">{getStatusBadge(selectedTeacher.account_status)}</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedTeacher(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </Button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-emerald-400">
                    {selectedTeacher.total_students}
                  </p>
                  <p className="text-xs text-gray-400">Students</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-purple-400">
                    {selectedTeacher.total_lesson_plans}
                  </p>
                  <p className="text-xs text-gray-400">Lessons</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-amber-400">
                    {selectedTeacher.total_assignments}
                  </p>
                  <p className="text-xs text-gray-400">Assignments</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-cyan-400">
                    {selectedTeacher.total_conversations || 0}
                  </p>
                  <p className="text-xs text-gray-400">Chats</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-pink-400">
                    {selectedTeacher.total_chatbot_messages}
                  </p>
                  <p className="text-xs text-gray-400">Messages</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-indigo-400">
                    {selectedTeacher.total_resources || 0}
                  </p>
                  <p className="text-xs text-gray-400">Resources</p>
                </div>
              </div>

              {/* Personal Information */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  Personal Information
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-800/30 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-gray-500">Full Name</p>
                    <p className="text-white">{selectedTeacher.full_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Gender</p>
                    <p className="text-white">{selectedTeacher.gender || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Date of Birth</p>
                    <p className="text-white">{selectedTeacher.date_of_birth || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-white">{selectedTeacher.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone Number</p>
                    <p className="text-white">{selectedTeacher.phone_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">WhatsApp</p>
                    <p className="text-white">{selectedTeacher.whatsapp_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Country</p>
                    <p className="text-white">{selectedTeacher.country || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">City</p>
                    <p className="text-white">{selectedTeacher.city || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Preferred Language</p>
                    <p className="text-white">{selectedTeacher.preferred_language || '-'}</p>
                  </div>
                </div>
              </div>

              {/* School Information */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <School className="w-5 h-5 text-emerald-400" />
                  School Information
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-800/30 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-gray-500">School Name</p>
                    <p className="text-white">{selectedTeacher.school_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">School Type</p>
                    <p className="text-white">{selectedTeacher.school_type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">School Address</p>
                    <p className="text-white">{selectedTeacher.school_address || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Number of Students</p>
                    <p className="text-white">{selectedTeacher.number_of_students || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Professional Information */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-400" />
                  Professional Information
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-gray-800/30 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-gray-500">Education Level</p>
                    <p className="text-white">{selectedTeacher.education_level || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Years of Experience</p>
                    <p className="text-white">{selectedTeacher.years_of_experience || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Subjects Taught</p>
                    <p className="text-white">{selectedTeacher.subjects_taught || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Grade Levels</p>
                    <p className="text-white">{selectedTeacher.grade_levels || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Bio */}
              {selectedTeacher.bio && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Bio</h3>
                  <div className="bg-gray-800/30 rounded-lg p-4">
                    <p className="text-gray-300 whitespace-pre-wrap">{selectedTeacher.bio}</p>
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                <div>
                  <p className="text-xs text-gray-500">Account Created</p>
                  <p className="text-sm text-white">
                    {selectedTeacher.created_at
                      ? format(new Date(selectedTeacher.created_at), 'MMMM d, yyyy \'at\' h:mm a')
                      : '-'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Last Activity</p>
                  <p className="text-sm text-white">
                    {selectedTeacher.updated_at
                      ? format(new Date(selectedTeacher.updated_at), 'MMMM d, yyyy \'at\' h:mm a')
                      : '-'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default TeachersManagement;
