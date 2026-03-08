import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { isTeacher, PRIMARY_GRADE_LEVELS } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Search, Users, UserPlus, MoreHorizontal, Eye, Trash2, PauseCircle, PlayCircle,
  Link2, Copy, GraduationCap, Loader2, CheckCircle2, XCircle, Clock, BarChart3,
  List, Download, Filter, SortAsc, SortDesc, RefreshCw, QrCode,
  Phone, Calendar, Shield, AlertTriangle, Award,
  BookOpen, FileText, LayoutGrid
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Link, useNavigate } from "react-router-dom";
import {
  Student,
  getStudentsByTeacher,
  deleteStudent,
  toggleStudentStatus,
  buildAccessLink,
  getStudentStats,
  StudentStats,
  regenerateAccessToken,
} from "@/services/studentService";
import { QRCodeSVG } from "qrcode.react";

// ── Types ──────────────────────────────────────────────

interface StudentWithStats extends Student {
  stats?: StudentStats;
}

type ViewMode = 'grid' | 'list';
type SortField = 'full_name' | 'grade_level' | 'created_at' | 'account_status';
type SortDirection = 'asc' | 'desc';

// ── Component ──────────────────────────────────────────────

const StudentManagement = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  
  // Data state
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeTab, setActiveTab] = useState("all");
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  
  // Selection state
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Dialog state
  const [viewingStudent, setViewingStudent] = useState<StudentWithStats | null>(null);
  const [showQrCode, setShowQrCode] = useState<Student | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Student | null>(null);
  const [bulkActionDialog, setBulkActionDialog] = useState<'pause' | 'activate' | 'delete' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [linkCopied, setLinkCopied] = useState<string | null>(null);

  // ── Fetch students from database ──────────────────────────

  useEffect(() => {
    if (user?.id) {
      fetchStudents();
    }
  }, [user?.id]);

  const fetchStudents = async (showRefresh = false) => {
    if (!user?.id) return;
    
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const data = await getStudentsByTeacher(user.id);
      
      // Fetch stats for each student in parallel
      const studentsWithStats = await Promise.all(
        data.map(async (student) => {
          try {
            const stats = await getStudentStats(student.id);
            return { ...student, stats };
          } catch {
            return { ...student, stats: undefined };
          }
        })
      );
      
      setStudents(studentsWithStats);
    } catch (e) {
      console.error('Error fetching students:', e);
      toast({
        title: "Error",
        description: "Failed to load students. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // ── Derived data ──────────────────────────────────────────

  // Get unique class names for filtering
  const uniqueClasses = useMemo(() => {
    const classes = new Set(students.map(s => s.class_name).filter(Boolean));
    return Array.from(classes).sort();
  }, [students]);

  // Stats calculations
  const stats = useMemo(() => ({
    total: students.length,
    active: students.filter(s => s.account_status === 'active').length,
    paused: students.filter(s => s.account_status === 'paused').length,
    suspended: students.filter(s => s.account_status === 'suspended').length,
    byGrade: PRIMARY_GRADE_LEVELS.reduce((acc, grade) => {
      acc[grade] = students.filter(s => s.grade_level === grade).length;
      return acc;
    }, {} as Record<string, number>),
  }), [students]);

  // Filter and sort students
  const filteredStudents = useMemo(() => {
    let result = [...students];
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.full_name.toLowerCase().includes(term) ||
        (s.student_code || '').toLowerCase().includes(term) ||
        (s.parent_name || '').toLowerCase().includes(term) ||
        (s.parent_email || '').toLowerCase().includes(term) ||
        (s.admission_number || '').toLowerCase().includes(term)
      );
    }
    
    // Tab filter (status)
    if (activeTab !== 'all') {
      result = result.filter(s => s.account_status === activeTab);
    }
    
    // Grade filter
    if (gradeFilter !== 'all') {
      result = result.filter(s => s.grade_level === gradeFilter);
    }
    
    // Class filter
    if (classFilter !== 'all') {
      result = result.filter(s => s.class_name === classFilter);
    }
    
    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'full_name':
          comparison = a.full_name.localeCompare(b.full_name);
          break;
        case 'grade_level':
          comparison = (a.grade_level || '').localeCompare(b.grade_level || '');
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'account_status':
          comparison = (a.account_status || '').localeCompare(b.account_status || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [students, searchTerm, activeTab, gradeFilter, classFilter, sortField, sortDirection]);

  // ── Handlers ──────────────────────────────────────────────

  const handleCopyLink = (token: string) => {
    const link = buildAccessLink(token);
    navigator.clipboard.writeText(link);
    setLinkCopied(token);
    setTimeout(() => setLinkCopied(null), 2000);
    toast({ title: "Link Copied!", description: "Student access link copied to clipboard." });
  };

  const handleToggleStatus = async (student: Student) => {
    const newStatus = student.account_status === 'active' ? 'paused' : 'active';
    try {
      await toggleStudentStatus(student.id, newStatus);
      setStudents(prev => prev.map(s => 
        s.id === student.id ? { ...s, account_status: newStatus } : s
      ));
      toast({
        title: newStatus === 'paused' ? "Account Paused" : "Account Activated",
        description: `${student.full_name}'s account is now ${newStatus}.`
      });
    } catch (e) {
      toast({ title: "Error", description: "Failed to update account status.", variant: "destructive" });
    }
  };

  const handleDeleteStudent = async () => {
    if (!confirmDelete) return;
    setIsProcessing(true);
    try {
      await deleteStudent(confirmDelete.id);
      setStudents(prev => prev.filter(s => s.id !== confirmDelete.id));
      setSelectedStudents(prev => {
        const next = new Set(prev);
        next.delete(confirmDelete.id);
        return next;
      });
      setConfirmDelete(null);
      toast({ title: "Deleted", description: `${confirmDelete.full_name}'s account has been removed.` });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete student.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegenerateToken = async (student: Student) => {
    try {
      const newToken = await regenerateAccessToken(student.id);
      setStudents(prev => prev.map(s => 
        s.id === student.id ? { ...s, access_token: newToken } : s
      ));
      
      // Copy new link to clipboard
      const link = buildAccessLink(newToken);
      navigator.clipboard.writeText(link);
      
      toast({ 
        title: "Access Link Regenerated", 
        description: "New link copied to clipboard. The old link will no longer work." 
      });
    } catch (e) {
      toast({ title: "Error", description: "Failed to regenerate access link.", variant: "destructive" });
    }
  };

  // ── Selection handlers ────────────────────────────────────

  const toggleStudentSelection = (id: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.id)));
    }
    setSelectAll(!selectAll);
  };

  // ── Bulk actions ──────────────────────────────────────────

  const handleBulkAction = async () => {
    if (!bulkActionDialog || selectedStudents.size === 0) return;
    
    setIsProcessing(true);
    try {
      const ids = Array.from(selectedStudents);
      
      if (bulkActionDialog === 'delete') {
        for (const id of ids) {
          await deleteStudent(id);
        }
        setStudents(prev => prev.filter(s => !selectedStudents.has(s.id)));
        toast({ title: "Deleted", description: `${ids.length} student(s) have been removed.` });
      } else {
        const newStatus = bulkActionDialog === 'pause' ? 'paused' : 'active';
        for (const id of ids) {
          await toggleStudentStatus(id, newStatus);
        }
        setStudents(prev => prev.map(s => 
          selectedStudents.has(s.id) ? { ...s, account_status: newStatus } : s
        ));
        toast({ 
          title: newStatus === 'paused' ? "Accounts Paused" : "Accounts Activated", 
          description: `${ids.length} student(s) updated.` 
        });
      }
      
      setSelectedStudents(new Set());
      setSelectAll(false);
      setBulkActionDialog(null);
    } catch (e) {
      toast({ title: "Error", description: "Some actions failed.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Export to CSV ─────────────────────────────────────────

  const exportToCSV = () => {
    try {
      const headers = ['Student ID', 'Full Name', 'Grade/Class', 'Class Name', 'Parent Name', 'Parent Phone', 'Parent Email', 'School', 'Status', 'Assignments', 'Submitted', 'Avg Score', 'Access Link'];
      const studentsToExport = selectedStudents.size > 0 
        ? filteredStudents.filter(s => selectedStudents.has(s.id))
        : filteredStudents;
      
      const rows = studentsToExport.map(s => [
        s.student_code || '',
        s.full_name,
        s.grade_level,
        s.class_name || '',
        s.parent_name || '',
        s.parent_phone || '',
        s.parent_email || '',
        s.school_name || '',
        s.account_status,
        s.stats?.totalAssigned || 0,
        s.stats?.submitted || 0,
        s.stats?.averageScore !== null && s.stats?.averageScore !== undefined ? s.stats.averageScore.toFixed(1) : '-',
        buildAccessLink(s.access_token),
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `students_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({ title: "Exported!", description: `${studentsToExport.length} student(s) exported to CSV.` });
    } catch (e) {
      toast({ title: "Export Failed", variant: "destructive" });
    }
  };

  // ── Access check ──────────────────────────────────────────

  if (!isTeacher(profile)) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">Access Restricted</p>
            <p className="text-muted-foreground mt-1">Only teachers can access student management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render helpers ────────────────────────────────────────

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><PauseCircle className="h-3 w-3 mr-1" />Paused</Badge>;
      case 'suspended':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" />Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const StudentActionMenu = ({ student }: { student: StudentWithStats }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setViewingStudent(student)}>
          <Eye className="h-4 w-4 mr-2" />
          View Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/dashboard/student-accounts?edit=${student.id}`)}>
          <FileText className="h-4 w-4 mr-2" />
          Edit Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCopyLink(student.access_token)}>
          <Link2 className="h-4 w-4 mr-2" />
          Copy Access Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setShowQrCode(student)}>
          <QrCode className="h-4 w-4 mr-2" />
          Show QR Code
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleToggleStatus(student)}>
          {student.account_status === 'active' ? (
            <><PauseCircle className="h-4 w-4 mr-2" />Pause Account</>
          ) : (
            <><PlayCircle className="h-4 w-4 mr-2" />Activate Account</>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleRegenerateToken(student)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Regenerate Link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => setConfirmDelete(student)}
          className="text-red-600 focus:text-red-600"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Student
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // ── Student Card Component ────────────────────────────────

  const StudentCard = ({ student }: { student: StudentWithStats }) => (
    <Card className="group hover:shadow-lg transition-all duration-200 border-l-4 border-l-primary/20 hover:border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-12 w-12 ring-2 ring-primary/10">
                <AvatarImage src={student.profile_photo_url || ''} />
                <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-white font-semibold">
                  {student.full_name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${
                student.account_status === 'active' ? 'bg-green-500' : 
                student.account_status === 'paused' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
            </div>
            <div>
              <CardTitle className="text-base">{student.full_name}</CardTitle>
              <CardDescription className="flex items-center gap-1 text-xs">
                <GraduationCap className="h-3 w-3" /> {student.grade_level}
                {student.class_name && <span className="text-muted-foreground">• {student.class_name}</span>}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Checkbox 
              checked={selectedStudents.has(student.id)}
              onCheckedChange={() => toggleStudentSelection(student.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
            <StudentActionMenu student={student} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-3">
          {/* Student Code */}
          {student.student_code && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Student ID</span>
              <Badge variant="outline" className="font-mono text-xs">{student.student_code}</Badge>
            </div>
          )}
          
          {/* Stats */}
          {student.stats && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/50 rounded-md p-2">
                <div className="text-lg font-semibold text-primary">{student.stats.totalAssigned}</div>
                <div className="text-xs text-muted-foreground">Assigned</div>
              </div>
              <div className="bg-muted/50 rounded-md p-2">
                <div className="text-lg font-semibold text-green-600">{student.stats.submitted}</div>
                <div className="text-xs text-muted-foreground">Submitted</div>
              </div>
              <div className="bg-muted/50 rounded-md p-2">
                <div className="text-lg font-semibold text-blue-600">
                  {student.stats.averageScore !== null ? student.stats.averageScore.toFixed(0) : '-'}
                </div>
                <div className="text-xs text-muted-foreground">Avg Score</div>
              </div>
            </div>
          )}
          
          {/* Parent Contact */}
          {student.parent_name && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {student.parent_name}
              {student.parent_phone && <span className="ml-1">• {student.parent_phone}</span>}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-0 flex gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => handleCopyLink(student.access_token)}
              >
                {linkCopied === student.access_token ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy access link</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => setShowQrCode(student)}
              >
                <QrCode className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Show QR Code</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="default" 
                size="sm" 
                className="flex-1"
                onClick={() => setViewingStudent(student)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View profile</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardFooter>
    </Card>
  );

  // ── Main Render ───────────────────────────────────────────

  return (
    <div className="container py-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Student Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your students, track progress, and share access links
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => fetchStudents(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button asChild>
            <Link to="/dashboard/student-accounts">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Student
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                <p className="text-3xl font-bold text-primary">{stats.total}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-3xl font-bold text-green-600">{stats.active}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 border-yellow-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Paused</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.paused}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <PauseCircle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">By Grade</p>
                <p className="text-sm text-blue-600 font-medium mt-1">
                  {Object.entries(stats.byGrade)
                    .filter(([, count]) => count > 0)
                    .slice(0, 2)
                    .map(([grade, count]) => `${grade}: ${count}`)
                    .join(' | ') || 'No data'}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, parent, email..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {PRIMARY_GRADE_LEVELS.map(grade => (
                    <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {uniqueClasses.length > 0 && (
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {uniqueClasses.map(cls => (
                      <SelectItem key={cls} value={cls!}>{cls}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Select 
                value={`${sortField}-${sortDirection}`} 
                onValueChange={(v) => {
                  const [field, dir] = v.split('-') as [SortField, SortDirection];
                  setSortField(field);
                  setSortDirection(dir);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  {sortDirection === 'asc' ? <SortAsc className="h-4 w-4 mr-2" /> : <SortDesc className="h-4 w-4 mr-2" />}
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at-desc">Newest First</SelectItem>
                  <SelectItem value="created_at-asc">Oldest First</SelectItem>
                  <SelectItem value="full_name-asc">Name A-Z</SelectItem>
                  <SelectItem value="full_name-desc">Name Z-A</SelectItem>
                  <SelectItem value="grade_level-asc">Grade (Low-High)</SelectItem>
                  <SelectItem value="grade_level-desc">Grade (High-Low)</SelectItem>
                </SelectContent>
              </Select>
              
              {/* View Toggle */}
              <div className="flex items-center border rounded-md">
                <Button 
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button 
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          
          {/* Bulk Actions */}
          {selectedStudents.size > 0 && (
            <div className="flex items-center gap-2 mt-4 p-3 bg-muted/50 rounded-lg">
              <Checkbox checked={selectAll} onCheckedChange={toggleSelectAll} />
              <span className="text-sm font-medium">
                {selectedStudents.size} student(s) selected
              </span>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => setBulkActionDialog('activate')}>
                <PlayCircle className="h-4 w-4 mr-1" /> Activate
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBulkActionDialog('pause')}>
                <PauseCircle className="h-4 w-4 mr-1" /> Pause
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkActionDialog('delete')}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all" className="gap-1">
            All <Badge variant="secondary" className="ml-1">{stats.total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-1">
            Active <Badge variant="secondary" className="ml-1 bg-green-100 text-green-800">{stats.active}</Badge>
          </TabsTrigger>
          <TabsTrigger value="paused" className="gap-1">
            Paused <Badge variant="secondary" className="ml-1 bg-yellow-100 text-yellow-800">{stats.paused}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Student List/Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground mt-2">Loading students...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No students found</h3>
            <p className="text-muted-foreground text-center max-w-md mt-1">
              {searchTerm || gradeFilter !== 'all' || classFilter !== 'all'
                ? "Try adjusting your search or filters."
                : "Get started by adding your first student."}
            </p>
            {!searchTerm && gradeFilter === 'all' && classFilter === 'all' && (
              <Button asChild className="mt-4">
                <Link to="/dashboard/student-accounts">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Your First Student
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredStudents.map(student => (
            <StudentCard key={student.id} student={student} />
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox checked={selectAll} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Assignments</TableHead>
                <TableHead className="text-center">Avg Score</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map(student => (
                <TableRow key={student.id} className="group">
                  <TableCell>
                    <Checkbox 
                      checked={selectedStudents.has(student.id)}
                      onCheckedChange={() => toggleStudentSelection(student.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={student.profile_photo_url || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                          {student.full_name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{student.full_name}</div>
                        {student.student_code && (
                          <div className="text-xs text-muted-foreground font-mono">{student.student_code}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{student.grade_level}</TableCell>
                  <TableCell>{student.class_name || '-'}</TableCell>
                  <TableCell>{getStatusBadge(student.account_status)}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="font-medium">{student.stats?.submitted || 0}</span>
                      <span className="text-muted-foreground">/</span>
                      <span>{student.stats?.totalAssigned || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {student.stats?.averageScore !== null && student.stats?.averageScore !== undefined ? (
                      <Badge variant="outline" className="font-mono">
                        {student.stats.averageScore.toFixed(1)}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {student.parent_name || '-'}
                      {student.parent_phone && (
                        <div className="text-xs text-muted-foreground">{student.parent_phone}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StudentActionMenu student={student} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Footer Stats */}
      {filteredStudents.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {filteredStudents.length} of {stats.total} students
          </span>
          <Button variant="ghost" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export to CSV
          </Button>
        </div>
      )}

      {/* ── Dialogs ─────────────────────────────────────────── */}

      {/* View Student Dialog */}
      <Dialog open={!!viewingStudent} onOpenChange={() => setViewingStudent(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewingStudent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={viewingStudent.profile_photo_url || ''} />
                    <AvatarFallback className="bg-primary text-white">
                      {viewingStudent.full_name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span>{viewingStudent.full_name}</span>
                    <DialogDescription className="flex items-center gap-2 mt-1">
                      {viewingStudent.student_code && (
                        <Badge variant="outline" className="font-mono">{viewingStudent.student_code}</Badge>
                      )}
                      {getStatusBadge(viewingStudent.account_status)}
                    </DialogDescription>
                  </div>
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 mt-4">
                {/* Quick Stats */}
                {viewingStudent.stats && (
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <BookOpen className="h-5 w-5 mx-auto text-primary mb-1" />
                      <div className="text-xl font-bold">{viewingStudent.stats.totalAssigned}</div>
                      <div className="text-xs text-muted-foreground">Assigned</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 mx-auto text-green-600 mb-1" />
                      <div className="text-xl font-bold">{viewingStudent.stats.submitted}</div>
                      <div className="text-xs text-muted-foreground">Submitted</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <Clock className="h-5 w-5 mx-auto text-yellow-600 mb-1" />
                      <div className="text-xl font-bold">{viewingStudent.stats.pending}</div>
                      <div className="text-xs text-muted-foreground">Pending</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <Award className="h-5 w-5 mx-auto text-blue-600 mb-1" />
                      <div className="text-xl font-bold">
                        {viewingStudent.stats.averageScore?.toFixed(1) || '-'}
                      </div>
                      <div className="text-xs text-muted-foreground">Avg Score</div>
                    </div>
                  </div>
                )}
                
                <Separator />
                
                {/* Student Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Grade Level</Label>
                    <p className="font-medium">{viewingStudent.grade_level}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Class</Label>
                    <p className="font-medium">{viewingStudent.class_name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">School</Label>
                    <p className="font-medium">{viewingStudent.school_name || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Admission No.</Label>
                    <p className="font-medium">{viewingStudent.admission_number || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">
                      {viewingStudent.date_of_birth 
                        ? new Date(viewingStudent.date_of_birth).toLocaleDateString()
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Gender</Label>
                    <p className="font-medium">{viewingStudent.gender || '-'}</p>
                  </div>
                </div>
                
                <Separator />
                
                {/* Parent/Guardian Info */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Parent/Guardian Contact
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <p className="font-medium">{viewingStudent.parent_name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Relationship</Label>
                      <p className="font-medium">{viewingStudent.parent_relationship || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Phone</Label>
                      <p className="font-medium">{viewingStudent.parent_phone || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium">{viewingStudent.parent_email || '-'}</p>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                {/* Access Link */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Student Access Link
                  </h4>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Input 
                      readOnly 
                      value={buildAccessLink(viewingStudent.access_token)} 
                      className="font-mono text-xs"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => handleCopyLink(viewingStudent.access_token)}
                    >
                      {linkCopied === viewingStudent.access_token ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => setShowQrCode(viewingStudent)}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setViewingStudent(null)}>
                  Close
                </Button>
                <Button onClick={() => {
                  setViewingStudent(null);
                  navigate(`/dashboard/student-accounts?edit=${viewingStudent.id}`);
                }}>
                  <FileText className="h-4 w-4 mr-2" />
                  Edit Details
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={!!showQrCode} onOpenChange={() => setShowQrCode(null)}>
        <DialogContent className="max-w-sm">
          {showQrCode && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center">Student Access QR Code</DialogTitle>
                <DialogDescription className="text-center">
                  {showQrCode.full_name}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center py-6">
                <div className="p-4 bg-white rounded-lg shadow-inner">
                  <QRCodeSVG 
                    value={buildAccessLink(showQrCode.access_token)} 
                    size={200}
                    level="H"
                    includeMargin
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-4 max-w-[200px]">
                  Scan this QR code to access the student dashboard
                </p>
              </div>
              <DialogFooter>
                <Button 
                  className="w-full" 
                  onClick={() => handleCopyLink(showQrCode.access_token)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Student
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{confirmDelete?.full_name}</strong>? 
              This action cannot be undone and will remove all their assignments and submissions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteStudent} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Confirmation Dialog */}
      <Dialog open={!!bulkActionDialog} onOpenChange={() => setBulkActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bulkActionDialog === 'delete' ? (
                <><AlertTriangle className="h-5 w-5 text-red-600" /> Delete Students</>
              ) : bulkActionDialog === 'pause' ? (
                <><PauseCircle className="h-5 w-5 text-yellow-600" /> Pause Accounts</>
              ) : (
                <><PlayCircle className="h-5 w-5 text-green-600" /> Activate Accounts</>
              )}
            </DialogTitle>
            <DialogDescription>
              {bulkActionDialog === 'delete' 
                ? `Are you sure you want to delete ${selectedStudents.size} student(s)? This cannot be undone.`
                : `This will ${bulkActionDialog} ${selectedStudents.size} student account(s).`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkActionDialog(null)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              variant={bulkActionDialog === 'delete' ? 'destructive' : 'default'}
              onClick={handleBulkAction} 
              disabled={isProcessing}
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentManagement;
