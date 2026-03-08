import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { isTeacher, PRIMARY_GRADE_LEVELS } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, UserPlus, Copy, Eye, Trash2, PauseCircle, PlayCircle,
  Link2, Users, GraduationCap, Loader2, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, User, Heart, School, Globe, Phone, Mail,
  MapPin, Calendar, Shield, FileText, Edit, Download, QrCode, RefreshCw, Upload, FileSpreadsheet, X, CheckCheck
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import * as XLSX from 'xlsx';
import {
  Student,
  createStudent,
  getStudentsByTeacher,
  deleteStudent,
  toggleStudentStatus,
  buildAccessLink,
  updateStudent,
  regenerateAccessToken,
} from "@/services/studentService";
import { QRCodeSVG } from "qrcode.react";

// â”€â”€ Form field definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface FormField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'select' | 'textarea' | 'email' | 'tel';
  required?: boolean;
  placeholder?: string;
  options?: string[];
  section: 'basic' | 'guardian' | 'school' | 'health' | 'additional';
  icon?: React.ReactNode;
  colSpan?: boolean;
}

const FORM_FIELDS: FormField[] = [
  // Basic Information
  { key: 'full_name', label: "Student's Full Name", type: 'text', required: true, placeholder: "e.g., Nfor Che Junior", section: 'basic', icon: <User className="h-4 w-4" /> },
  { key: 'date_of_birth', label: 'Date of Birth', type: 'date', section: 'basic', icon: <Calendar className="h-4 w-4" /> },
  { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'], section: 'basic' },
  { key: 'nationality', label: 'Nationality', type: 'text', placeholder: 'e.g., Cameroonian', section: 'basic', icon: <Globe className="h-4 w-4" /> },
  { key: 'place_of_birth', label: 'Place of Birth', type: 'text', placeholder: 'e.g., Bamenda', section: 'basic', icon: <MapPin className="h-4 w-4" /> },
  { key: 'home_language', label: 'Home Language', type: 'text', placeholder: 'e.g., Pidgin English', section: 'basic' },

  // Guardian / Contact
  { key: 'parent_name', label: "Parent/Guardian Full Name", type: 'text', placeholder: "e.g., Mrs. Ngum Comfort", section: 'guardian', icon: <User className="h-4 w-4" /> },
  { key: 'parent_phone', label: "Parent/Guardian Phone", type: 'tel', placeholder: 'e.g., +237 6XX XXX XXX', section: 'guardian', icon: <Phone className="h-4 w-4" /> },
  { key: 'parent_email', label: "Parent/Guardian Email", type: 'email', placeholder: 'e.g., parent@email.com', section: 'guardian', icon: <Mail className="h-4 w-4" /> },
  { key: 'parent_relationship', label: 'Relationship to Student', type: 'select', options: ['Mother', 'Father', 'Guardian', 'Uncle', 'Aunt', 'Grandparent', 'Sibling', 'Other'], section: 'guardian' },
  { key: 'home_address', label: 'Home Address', type: 'textarea', placeholder: 'Full home address...', section: 'guardian', icon: <MapPin className="h-4 w-4" />, colSpan: true },

  // School Information
  { key: 'school_name', label: 'School Name', type: 'text', placeholder: "e.g., Government Primary School Bambili", section: 'school', icon: <School className="h-4 w-4" /> },
  { key: 'grade_level', label: 'Class/Grade Level', type: 'select', required: true, options: [...PRIMARY_GRADE_LEVELS], section: 'school', icon: <GraduationCap className="h-4 w-4" /> },
  { key: 'class_name', label: 'Class Name/Section', type: 'text', placeholder: 'e.g., Class 5A', section: 'school' },
  { key: 'admission_number', label: 'Admission/Registration No.', type: 'text', placeholder: 'e.g., GPS/2024/001', section: 'school' },
  { key: 'academic_year', label: 'Academic Year', type: 'text', placeholder: 'e.g., 2025/2026', section: 'school' },

  // Health & Special Needs
  { key: 'blood_group', label: 'Blood Group', type: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'], section: 'health', icon: <Heart className="h-4 w-4" /> },
  { key: 'medical_conditions', label: 'Medical Conditions', type: 'textarea', placeholder: 'Any known medical conditions...', section: 'health', colSpan: true },
  { key: 'allergies', label: 'Allergies', type: 'text', placeholder: 'e.g., None / Penicillin', section: 'health' },
  { key: 'special_needs', label: 'Special Learning Needs', type: 'textarea', placeholder: 'Any learning disabilities or special needs...', section: 'health', colSpan: true },
  { key: 'disability_status', label: 'Disability Status', type: 'select', options: ['None', 'Visual', 'Hearing', 'Physical', 'Intellectual', 'Multiple', 'Other'], section: 'health' },

  // Additional
  { key: 'previous_school', label: 'Previous School', type: 'text', placeholder: 'Name of previous school if any', section: 'additional', icon: <School className="h-4 w-4" /> },
  { key: 'notes', label: 'Additional Notes', type: 'textarea', placeholder: 'Any other relevant information about this student...', section: 'additional', colSpan: true },
];

const SECTIONS = [
  { id: 'basic', title: 'Basic Information', icon: <User className="h-5 w-5" />, description: 'Personal details about the student' },
  { id: 'guardian', title: 'Guardian / Contact', icon: <Phone className="h-5 w-5" />, description: "Parent or guardian's contact information" },
  { id: 'school', title: 'School Information', icon: <School className="h-5 w-5" />, description: 'Academic and school details' },
  { id: 'health', title: 'Health & Special Needs', icon: <Heart className="h-5 w-5" />, description: 'Medical and accessibility information' },
  { id: 'additional', title: 'Additional Information', icon: <FileText className="h-5 w-5" />, description: 'Extra notes and history' },
];

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const StudentAccountCreation = () => {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ basic: true, guardian: true, school: true, health: false, additional: false });
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [linkCopied, setLinkCopied] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Student | null>(null);
  
  // Enhanced features state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showQrCode, setShowQrCode] = useState<Student | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'pause' | 'activate' | 'delete' | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Bulk upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);
  const [bulkUploadData, setBulkUploadData] = useState<any[]>([]);
  const [bulkUploadErrors, setBulkUploadErrors] = useState<string[]>([]);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkUploadResults, setBulkUploadResults] = useState<{ success: number; failed: number } | null>(null);

  // Fetch students on mount
  useEffect(() => {
    if (profile?.id) {
      fetchStudents();
    }
  }, [profile?.id]);

  const fetchStudents = async () => {
    if (!profile?.id) return;
    setIsLoading(true);
    try {
      const data = await getStudentsByTeacher(profile.id);
      setStudents(data);
    } catch (e) {
      console.error('Error fetching students:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Check access
  if (!isTeacher(profile)) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">Access Restricted</p>
            <p className="text-muted-foreground mt-1">Only teachers can manage student accounts.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // â”€â”€ Filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.student_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.parent_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.grade_level || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.admission_number || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'active') return matchesSearch && s.account_status === 'active';
    if (activeTab === 'paused') return matchesSearch && s.account_status === 'paused';
    return matchesSearch;
  });

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleCreateStudent = async () => {
    if (!formData.full_name || !formData.grade_level) {
      toast({ title: "Missing Information", description: "Full name and class level are required.", variant: "destructive" });
      return;
    }
    if (!profile?.id) return;

    setIsSaving(true);
    try {
      const studentData: Record<string, any> = { teacher_id: profile.id };
      FORM_FIELDS.forEach((f) => {
        if (formData[f.key]) studentData[f.key] = formData[f.key];
      });

      // Default school to teacher's school if not provided
      if (!studentData.school_name && profile.school_name) {
        studentData.school_name = profile.school_name;
      }

      const newStudent = await createStudent(studentData);
      setStudents((prev) => [newStudent, ...prev]);
      setFormData({});
      setCreatingStudent(false);

      // Show the access link immediately
      setViewingStudent(newStudent);

      toast({ title: "Student Created!", description: `${newStudent.full_name} has been enrolled successfully.` });
    } catch (e: any) {
      console.error('Error creating student:', e);
      toast({ title: "Failed", description: e?.message || "Could not create student account.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!confirmDelete) return;
    try {
      await deleteStudent(confirmDelete.id);
      setStudents((prev) => prev.filter((s) => s.id !== confirmDelete.id));
      setSelectedStudents((prev) => { const n = new Set(prev); n.delete(confirmDelete.id); return n; });
      setConfirmDelete(null);
      toast({ title: "Deleted", description: `${confirmDelete.full_name}'s account has been removed.` });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete student.", variant: "destructive" });
    }
  };

  const handleToggleStatus = async (student: Student) => {
    const newStatus = student.account_status === 'active' ? 'paused' : 'active';
    try {
      await toggleStudentStatus(student.id, newStatus);
      setStudents((prev) => prev.map((s) => s.id === student.id ? { ...s, account_status: newStatus } : s));
      toast({ title: newStatus === 'paused' ? "Account Paused" : "Account Activated", description: `${student.full_name}'s account is now ${newStatus}.` });
    } catch (e) {
      toast({ title: "Error", description: "Failed to update account status.", variant: "destructive" });
    }
  };

  // â"€â"€ Edit Student â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const handleEditStudent = async () => {
    if (!editingStudent) return;
    if (!formData.full_name || !formData.grade_level) {
      toast({ title: "Missing Information", description: "Full name and class level are required.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const updates: Partial<Student> = {};
      FORM_FIELDS.forEach((f) => {
        if (formData[f.key] !== undefined) {
          (updates as any)[f.key] = formData[f.key] || null;
        }
      });

      await updateStudent(editingStudent.id, updates);
      setStudents((prev) => prev.map((s) => 
        s.id === editingStudent.id ? { ...s, ...updates } : s
      ));
      setFormData({});
      setEditingStudent(null);
      toast({ title: "Updated!", description: `${formData.full_name}'s information has been saved.` });
    } catch (e: any) {
      console.error('Error updating student:', e);
      toast({ title: "Failed", description: e?.message || "Could not update student.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (student: Student) => {
    const data: Record<string, string> = {};
    FORM_FIELDS.forEach((f) => {
      const val = (student as any)[f.key];
      if (val) data[f.key] = val;
    });
    setFormData(data);
    setExpandedSections({ basic: true, guardian: true, school: true, health: false, additional: false });
    setEditingStudent(student);
  };

  // â"€â"€ Bulk Actions â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const toggleStudentSelection = (id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedStudents.size === 0) return;
    
    setIsSaving(true);
    try {
      const ids = Array.from(selectedStudents);
      
      if (bulkAction === 'delete') {
        for (const id of ids) {
          await deleteStudent(id);
        }
        setStudents((prev) => prev.filter((s) => !selectedStudents.has(s.id)));
        toast({ title: "Deleted", description: `${ids.length} student(s) have been removed.` });
      } else {
        const newStatus = bulkAction === 'pause' ? 'paused' : 'active';
        for (const id of ids) {
          await toggleStudentStatus(id, newStatus);
        }
        setStudents((prev) => prev.map((s) => 
          selectedStudents.has(s.id) ? { ...s, account_status: newStatus } : s
        ));
        toast({ title: newStatus === 'paused' ? "Paused" : "Activated", description: `${ids.length} student(s) updated.` });
      }
      
      setSelectedStudents(new Set());
      setBulkAction(null);
    } catch (e) {
      toast({ title: "Error", description: "Some actions failed.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // â"€â"€ Export to CSV â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const exportToCSV = () => {
    setIsExporting(true);
    try {
      const headers = ['Student ID', 'Full Name', 'Grade/Class', 'Parent Name', 'Parent Phone', 'Parent Email', 'School', 'Status', 'Date of Birth', 'Gender', 'Admission No', 'Access Link'];
      const studentsToExport = selectedStudents.size > 0 
        ? students.filter((s) => selectedStudents.has(s.id))
        : students;
      
      const rows = studentsToExport.map((s) => [
        s.student_code || '',
        s.full_name,
        s.grade_level,
        s.parent_name || '',
        s.parent_phone || '',
        s.parent_email || '',
        s.school_name || '',
        s.account_status,
        s.date_of_birth || '',
        s.gender || '',
        s.admission_number || '',
        buildAccessLink(s.access_token),
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
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
    } finally {
      setIsExporting(false);
    }
  };

  const copyLink = (token: string) => {
    const link = buildAccessLink(token);
    navigator.clipboard.writeText(link);
    setLinkCopied(token);
    setTimeout(() => setLinkCopied(null), 2000);
    toast({ title: "Link Copied!", description: "Student access link copied to clipboard." });
  };

  // ── Bulk Upload Functions ──────────────────────────────────

  const downloadTemplate = () => {
    // Create template with all required and optional fields
    const templateData = [
      {
        'Full Name*': 'Nfor Che Junior',
        'Grade Level*': 'Primary 1',
        'Date of Birth': '2015-05-15',
        'Gender': 'Male',
        'Nationality': 'Cameroonian',
        'Place of Birth': 'Bamenda',
        'Home Language': 'Pidgin English',
        'Parent/Guardian Name': 'Mrs. Ngum Comfort',
        'Parent Phone': '+237 6XX XXX XXX',
        'Parent Email': 'parent@email.com',
        'Parent Relationship': 'Mother',
        'Home Address': 'House 12, Street Name, Bamenda',
        'School Name': 'Government Primary School',
        'Class Name': 'Class 1A',
        'Admission Number': 'GPS/2024/001',
        'Academic Year': '2025/2026',
        'Blood Group': 'O+',
        'Medical Conditions': '',
        'Allergies': 'None',
        'Special Learning Needs': '',
        'Disability Status': 'None',
        'Previous School': '',
        'Notes': ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students Template');
    
    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 18 }, { wch: 20 },
      { wch: 18 }, { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 18 },
      { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 20 },
      { wch: 15 }, { wch: 20 }, { wch: 30 }
    ];

    XLSX.writeFile(wb, 'student_upload_template.xlsx');
    toast({ title: "Template Downloaded", description: "Fill in student data and upload the file." });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBulkUploadFile(file);
    setBulkUploadErrors([]);
    setBulkUploadResults(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Validate and transform data
      const errors: string[] = [];
      const validatedData: any[] = [];

      jsonData.forEach((row: any, index) => {
        const rowNum = index + 2; // +2 because Excel rows start at 1 and we have a header
        const errors_for_row: string[] = [];

        // Check required fields
        if (!row['Full Name*']?.toString().trim()) {
          errors_for_row.push(`Row ${rowNum}: Full Name is required`);
        }
        if (!row['Grade Level*']?.toString().trim()) {
          errors_for_row.push(`Row ${rowNum}: Grade Level is required`);
        } else if (!PRIMARY_GRADE_LEVELS.includes(row['Grade Level*'].toString().trim())) {
          errors_for_row.push(`Row ${rowNum}: Invalid Grade Level. Must be one of: ${PRIMARY_GRADE_LEVELS.join(', ')}`);
        }

        if (errors_for_row.length > 0) {
          errors.push(...errors_for_row);
        } else {
          // Map Excel columns to database fields
          validatedData.push({
            full_name: row['Full Name*']?.toString().trim(),
            grade_level: row['Grade Level*']?.toString().trim(),
            date_of_birth: row['Date of Birth']?.toString().trim() || null,
            gender: row['Gender']?.toString().trim() || null,
            nationality: row['Nationality']?.toString().trim() || null,
            place_of_birth: row['Place of Birth']?.toString().trim() || null,
            home_language: row['Home Language']?.toString().trim() || null,
            parent_name: row['Parent/Guardian Name']?.toString().trim() || null,
            parent_phone: row['Parent Phone']?.toString().trim() || null,
            parent_email: row['Parent Email']?.toString().trim() || null,
            parent_relationship: row['Parent Relationship']?.toString().trim() || null,
            home_address: row['Home Address']?.toString().trim() || null,
            school_name: row['School Name']?.toString().trim() || profile?.school_name || null,
            class_name: row['Class Name']?.toString().trim() || null,
            admission_number: row['Admission Number']?.toString().trim() || null,
            academic_year: row['Academic Year']?.toString().trim() || null,
            blood_group: row['Blood Group']?.toString().trim() || null,
            medical_conditions: row['Medical Conditions']?.toString().trim() || null,
            allergies: row['Allergies']?.toString().trim() || null,
            special_needs: row['Special Learning Needs']?.toString().trim() || null,
            disability_status: row['Disability Status']?.toString().trim() || null,
            previous_school: row['Previous School']?.toString().trim() || null,
            notes: row['Notes']?.toString().trim() || null,
          });
        }
      });

      if (errors.length > 0) {
        setBulkUploadErrors(errors);
        setBulkUploadData([]);
      } else {
        setBulkUploadData(validatedData);
        setBulkUploadErrors([]);
        toast({ title: "File Validated", description: `${validatedData.length} students ready to import.` });
      }
    } catch (error) {
      toast({ title: "File Error", description: "Could not read the Excel file. Please check the format.", variant: "destructive" });
      setBulkUploadFile(null);
    }
  };

  const handleBulkUpload = async () => {
    if (!profile?.id || bulkUploadData.length === 0) return;

    setIsBulkUploading(true);
    let successCount = 0;
    let failedCount = 0;

    for (const studentData of bulkUploadData) {
      try {
        await createStudent({
          ...studentData,
          teacher_id: profile.id,
        });
        successCount++;
      } catch (error) {
        console.error('Failed to create student:', studentData.full_name, error);
        failedCount++;
      }
    }

    setIsBulkUploading(false);
    setBulkUploadResults({ success: successCount, failed: failedCount });
    
    // Refresh student list
    await fetchStudents();

    if (failedCount === 0) {
      toast({ 
        title: "Bulk Upload Complete!", 
        description: `Successfully created ${successCount} student accounts.` 
      });
      // Reset after 3 seconds
      setTimeout(() => {
        setShowBulkUpload(false);
        setBulkUploadFile(null);
        setBulkUploadData([]);
        setBulkUploadResults(null);
      }, 3000);
    } else {
      toast({ 
        title: "Upload Completed with Errors", 
        description: `${successCount} succeeded, ${failedCount} failed.`,
        variant: "destructive"
      });
    }
  };

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  // â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.account_status === 'active').length;
  const pausedStudents = students.filter((s) => s.account_status === 'paused').length;

  // â”€â”€ Render Field â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const renderField = (field: FormField) => {
    const value = formData[field.key] || '';
    const baseClass = "h-10";

    return (
      <div key={field.key} className={field.colSpan ? 'sm:col-span-2' : ''}>
        <Label htmlFor={`field-${field.key}`} className="text-sm font-medium flex items-center gap-1.5 mb-1.5">
          {field.icon}
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
        </Label>
        {field.type === 'select' ? (
          <Select value={value} onValueChange={(v) => updateField(field.key, v)}>
            <SelectTrigger className={baseClass}>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : field.type === 'textarea' ? (
          <Textarea
            id={`field-${field.key}`}
            value={value}
            onChange={(e) => updateField(field.key, e.target.value)}
            placeholder={field.placeholder}
            rows={2}
            className="resize-none"
          />
        ) : (
          <Input
            id={`field-${field.key}`}
            type={field.type}
            value={value}
            onChange={(e) => updateField(field.key, e.target.value)}
            placeholder={field.placeholder}
            className={baseClass}
          />
        )}
      </div>
    );
  };

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <div className="container py-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Student Accounts
          </h1>
          <p className="text-muted-foreground mt-1">Create, manage, and share student access links</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={() => setShowBulkUpload(true)} 
            size="lg" 
            variant="outline"
            className="shadow-md border-primary/20 hover:bg-primary/5"
          >
            <FileSpreadsheet className="mr-2 h-5 w-5" />
            Bulk Upload
          </Button>
          <Button onClick={() => { setFormData({}); setExpandedSections({ basic: true, guardian: true, school: true, health: false, additional: false }); setCreatingStudent(true); }} size="lg" className="shadow-md">
            <UserPlus className="mr-2 h-5 w-5" />
            Enroll New Student
          </Button>
        </div>
      </div>

      {/* Stats Cards - Horizontal Scroll on Mobile */}
      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 gap-4 sm:grid sm:grid-cols-3 no-scrollbar snap-x snap-mandatory">
        <Card className="bg-gradient-to-br from-primary/10 to-background border-primary/20 min-w-[200px] snap-center">
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/15"><Users className="h-6 w-6 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{totalStudents}</p>
              <p className="text-xs text-muted-foreground">Total Students</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-background border-emerald-500/20 min-w-[200px] snap-center">
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/15"><CheckCircle2 className="h-6 w-6 text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold">{activeStudents}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-background border-amber-500/20 min-w-[200px] snap-center">
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/15"><PauseCircle className="h-6 w-6 text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold">{pausedStudents}</p>
              <p className="text-xs text-muted-foreground">Paused</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs + Search + Actions */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
           <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex">
              <TabsTrigger value="all">All <span className="hidden sm:inline ml-1">({totalStudents})</span></TabsTrigger>
              <TabsTrigger value="active">Active <span className="hidden sm:inline ml-1">({activeStudents})</span></TabsTrigger>
              <TabsTrigger value="paused">Paused <span className="hidden sm:inline ml-1">({pausedStudents})</span></TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
             <Button variant="outline" size="sm" onClick={exportToCSV} disabled={isExporting || students.length === 0} className="whitespace-nowrap flex-1 sm:flex-none">
              <Download className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">{selectedStudents.size > 0 ? `Export Selected` : 'Export CSV'}</span>
              <span className="sm:hidden">Export</span>
            </Button>
            <Button variant="outline" size="sm" onClick={fetchStudents} disabled={isLoading} className="px-3">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, level, ID..." 
              className="pl-9 w-full bg-background" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedStudents.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3 px-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Checkbox checked={selectedStudents.size === filteredStudents.length} onCheckedChange={toggleSelectAll} />
              <span className="text-sm font-medium">{selectedStudents.size} student(s) selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setBulkAction('pause')}>
                <PauseCircle className="mr-1.5 h-4 w-4" /> Pause
              </Button>
              <Button size="sm" variant="outline" onClick={() => setBulkAction('activate')}>
                <PlayCircle className="mr-1.5 h-4 w-4" /> Activate
              </Button>
              <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => setBulkAction('delete')}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedStudents(new Set())}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading students...</span>
        </div>
      ) : filteredStudents.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-16 text-center">
            <GraduationCap className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">
              {searchTerm ? 'No students match your search' : 'No students enrolled yet'}
            </h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              {searchTerm
                ? 'Try a different search term.'
                : "Click \"Enroll New Student\" to add your first student. They'll receive a unique link to access their dashboard."}
            </p>
            {!searchTerm && (
              <Button className="mt-6" onClick={() => setCreatingStudent(true)}>
                <UserPlus className="mr-2 h-4 w-4" /> Enroll Your First Student
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table View */}
          <Card className="shadow-sm hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-10">
                      <Checkbox checked={selectedStudents.size === filteredStudents.length && filteredStudents.length > 0} onCheckedChange={toggleSelectAll} />
                    </TableHead>
                    <TableHead className="font-semibold">Student</TableHead>
                    <TableHead className="font-semibold hidden sm:table-cell">Student ID</TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">Class</TableHead>
                    <TableHead className="font-semibold hidden lg:table-cell">Guardian</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold hidden sm:table-cell">Access Link</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student.id} className={`group ${selectedStudents.has(student.id) ? 'bg-primary/5' : ''}`}>
                      <TableCell>
                        <Checkbox checked={selectedStudents.has(student.id)} onCheckedChange={() => toggleStudentSelection(student.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                            {student.full_name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{student.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate sm:hidden">{student.student_code || '—'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <code className="text-xs font-mono bg-primary/5 text-primary px-2 py-1 rounded">{student.student_code || '—'}</code>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline">{student.grade_level}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="text-sm">{student.parent_name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{student.parent_phone || ''}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={student.account_status === 'active' ? 'default' : 'secondary'} className={student.account_status === 'active' ? 'bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20' : 'bg-amber-500/15 text-amber-700 border-amber-200 hover:bg-amber-500/20'}>
                          {student.account_status === 'active' ? '● Active' : '⏸ Paused'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => copyLink(student.access_token)}>
                            {linkCopied === student.access_token ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            {linkCopied === student.access_token ? 'Copied!' : 'Copy'}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowQrCode(student)} title="Show QR Code">
                            <QrCode className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingStudent(student)} title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(student)} title="Edit Student">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleStatus(student)} title={student.account_status === 'active' ? 'Pause Account' : 'Activate Account'}>
                            {student.account_status === 'active' ? <PauseCircle className="h-4 w-4 text-amber-600" /> : <PlayCircle className="h-4 w-4 text-emerald-600" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setConfirmDelete(student)} title="Delete Student">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filteredStudents.map((student) => (
              <Card key={student.id} className={`shadow-sm overflow-hidden border ${selectedStudents.has(student.id) ? 'border-primary/50 bg-primary/5' : ''}`}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        checked={selectedStudents.has(student.id)} 
                        onCheckedChange={() => toggleStudentSelection(student.id)} 
                        className="mt-1"
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-base">{student.full_name}</h3>
                          <Badge variant={student.account_status === 'active' ? 'default' : 'secondary'} className={`h-5 px-1.5 text-[10px] ${student.account_status === 'active' ? 'bg-emerald-500/15 text-emerald-700 border-emerald-200' : 'bg-amber-500/15 text-amber-700 border-amber-200'}`}>
                            {student.account_status === 'active' ? 'Active' : 'Paused'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <span className="font-mono bg-muted px-1.5 rounded text-xs">{student.student_code || 'No ID'}</span>
                          <span>•</span>
                          <span>{student.grade_level}</span>
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" onClick={() => setViewingStudent(student)}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {student.parent_name && (
                    <div className="bg-muted/30 p-2.5 rounded-md text-sm flex items-start gap-2">
                       <Phone className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                       <div>
                         <p className="font-medium text-xs text-muted-foreground">Guardian</p>
                         <p>{student.parent_name}</p>
                         {student.parent_phone && <p className="text-muted-foreground text-xs">{student.parent_phone}</p>}
                       </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={() => copyLink(student.access_token)}>
                      {linkCopied === student.access_token ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                      {linkCopied === student.access_token ? 'Copied' : 'Copy Link'}
                    </Button>
                    <div className="flex gap-1">
                       <Button variant="ghost" size="icon" className="h-9 w-9 border" onClick={() => setShowQrCode(student)}>
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 border" onClick={() => openEditDialog(student)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 border text-red-500" onClick={() => setConfirmDelete(student)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* â”€â”€ CREATE STUDENT DIALOG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Dialog open={creatingStudent} onOpenChange={setCreatingStudent}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
            <DialogTitle className="text-xl flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Enroll New Student
            </DialogTitle>
            <DialogDescription>
              Fill in the student's information below. Required fields are marked with <span className="text-red-500">*</span>.
              A unique access link will be generated automatically.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] px-6 py-4">
            <div className="space-y-4">
              {SECTIONS.map((section) => {
                const fields = FORM_FIELDS.filter((f) => f.section === section.id);
                const isExpanded = expandedSections[section.id];
                return (
                  <div key={section.id} className="border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">{section.icon}</div>
                        <div className="text-left">
                          <p className="font-semibold text-sm">{section.title}</p>
                          <p className="text-xs text-muted-foreground">{section.description}</p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t bg-background">
                        {fields.map(renderField)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setCreatingStudent(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleCreateStudent} disabled={isSaving} className="min-w-[140px]">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : <><UserPlus className="mr-2 h-4 w-4" /> Create Student</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â”€â”€ VIEW STUDENT DIALOG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {viewingStudent && (
        <Dialog open={!!viewingStudent} onOpenChange={(open) => { if (!open) setViewingStudent(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0">
            <DialogHeader className="p-6 pb-4 border-b">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                  {viewingStudent.full_name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <DialogTitle className="text-xl">{viewingStudent.full_name}</DialogTitle>
                  <DialogDescription className="flex items-center gap-2 mt-1 flex-wrap">
                    {viewingStudent.student_code && (
                      <code className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded font-semibold">
                        {viewingStudent.student_code}
                      </code>
                    )}
                    <Badge variant="outline">{viewingStudent.grade_level}</Badge>
                    <Badge variant={viewingStudent.account_status === 'active' ? 'default' : 'secondary'} className={viewingStudent.account_status === 'active' ? 'bg-emerald-500/15 text-emerald-700 border-emerald-200' : ''}>
                      {viewingStudent.account_status}
                    </Badge>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <ScrollArea className="max-h-[55vh] p-6">
              {/* Access Link */}
              <div className="mb-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <Label className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Link2 className="h-3.5 w-3.5" /> Student Access Link
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-background p-2.5 rounded border font-mono break-all">
                    {buildAccessLink(viewingStudent.access_token)}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => copyLink(viewingStudent.access_token)} className="shrink-0">
                    {linkCopied === viewingStudent.access_token ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Share this link with the parent or student. It will open their dashboard directly â€” no password needed.</p>
              </div>

              {/* Student Details Grid */}
              <div className="space-y-5">
                {SECTIONS.map((section) => {
                  const fields = FORM_FIELDS.filter((f) => f.section === section.id);
                  const hasData = fields.some((f) => (viewingStudent as any)[f.key]);
                  if (!hasData) return null;
                  return (
                    <div key={section.id}>
                      <h4 className="font-semibold text-sm flex items-center gap-2 mb-3 text-muted-foreground">
                        {section.icon} {section.title}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {fields.map((f) => {
                          const val = (viewingStudent as any)[f.key];
                          if (!val) return null;
                          return (
                            <div key={f.key} className={f.colSpan ? 'sm:col-span-2' : ''}>
                              <p className="text-xs text-muted-foreground">{f.label}</p>
                              <p className="text-sm font-medium">{val}</p>
                            </div>
                          );
                        })}
                      </div>
                      <Separator className="mt-4" />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 pt-4 border-t">
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 mr-auto" onClick={() => { setViewingStudent(null); setConfirmDelete(viewingStudent); }}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
              <Button variant="outline" onClick={() => { openEditDialog(viewingStudent); setViewingStudent(null); }}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Button>
              <Button variant="outline" onClick={() => { handleToggleStatus(viewingStudent); setViewingStudent(null); }}>
                {viewingStudent.account_status === 'active' ? <><PauseCircle className="mr-2 h-4 w-4" /> Pause</> : <><PlayCircle className="mr-2 h-4 w-4" /> Activate</>}
              </Button>
              <Button onClick={() => setViewingStudent(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* â”€â”€ DELETE CONFIRM DIALOG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {confirmDelete && (
        <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" /> Delete Student Account
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete <strong>{confirmDelete.full_name}</strong>&apos;s account? This action cannot be undone and all associated data (assignments, submissions) will be removed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteStudent}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── EDIT STUDENT DIALOG ─────────────────────────────── */}
      {editingStudent && (
        <Dialog open={!!editingStudent} onOpenChange={(open) => { if (!open) { setEditingStudent(null); setFormData({}); } }}>
          <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0">
            <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
              <DialogTitle className="text-xl flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary" />
                Edit Student: {editingStudent.full_name}
              </DialogTitle>
              <DialogDescription>
                Update the student's information below. Required fields are marked with <span className="text-red-500">*</span>.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[60vh] px-6 py-4">
              <div className="space-y-4">
                {SECTIONS.map((section) => {
                  const fields = FORM_FIELDS.filter((f) => f.section === section.id);
                  const isExpanded = expandedSections[section.id];
                  return (
                    <div key={section.id} className="border rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleSection(section.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">{section.icon}</div>
                          <div className="text-left">
                            <p className="font-semibold text-sm">{section.title}</p>
                            <p className="text-xs text-muted-foreground">{section.description}</p>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t bg-background">
                          {fields.map(renderField)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
              <Button variant="outline" onClick={() => { setEditingStudent(null); setFormData({}); }} disabled={isSaving}>Cancel</Button>
              <Button onClick={handleEditStudent} disabled={isSaving} className="min-w-[140px]">
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><CheckCircle2 className="mr-2 h-4 w-4" /> Save Changes</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── QR CODE DIALOG ─────────────────────────────────── */}
      {showQrCode && (
        <Dialog open={!!showQrCode} onOpenChange={(open) => { if (!open) setShowQrCode(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" /> Access QR Code
              </DialogTitle>
              <DialogDescription>
                Scan this code to open {showQrCode.full_name}'s dashboard
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-white p-4 rounded-lg border shadow-sm">
                <QRCodeSVG
                  value={buildAccessLink(showQrCode.access_token)}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground max-w-[250px]">
                Parents can scan this QR code with their phone camera to access the student dashboard instantly.
              </p>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1" onClick={() => copyLink(showQrCode.access_token)}>
                  <Copy className="mr-2 h-4 w-4" /> Copy Link
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    try {
                      const newToken = await regenerateAccessToken(showQrCode.id);
                      const updatedStudent = { ...showQrCode, access_token: newToken };
                      setShowQrCode(updatedStudent);
                      setStudents((prev) => prev.map((s) => s.id === showQrCode.id ? updatedStudent : s));
                      toast({ title: "Token Regenerated", description: "A new access link and QR code have been generated." });
                    } catch {
                      toast({ title: "Error", description: "Failed to regenerate token.", variant: "destructive" });
                    }
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> New Token
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── BULK ACTION CONFIRM DIALOG ─────────────────────── */}
      {bulkAction && (
        <Dialog open={!!bulkAction} onOpenChange={(open) => { if (!open) setBulkAction(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {bulkAction === 'delete' ? <AlertTriangle className="h-5 w-5 text-red-600" /> : bulkAction === 'pause' ? <PauseCircle className="h-5 w-5 text-amber-600" /> : <PlayCircle className="h-5 w-5 text-emerald-600" />}
                {bulkAction === 'delete' ? 'Delete' : bulkAction === 'pause' ? 'Pause' : 'Activate'} {selectedStudents.size} Student(s)?
              </DialogTitle>
              <DialogDescription>
                {bulkAction === 'delete' 
                  ? `This will permanently delete ${selectedStudents.size} student account(s) and all their data. This action cannot be undone.`
                  : bulkAction === 'pause'
                  ? `This will pause ${selectedStudents.size} student account(s). They will not be able to access their dashboards until reactivated.`
                  : `This will activate ${selectedStudents.size} student account(s). They will be able to access their dashboards.`
                }
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkAction(null)} disabled={isSaving}>Cancel</Button>
              <Button 
                variant={bulkAction === 'delete' ? 'destructive' : 'default'} 
                onClick={handleBulkAction}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {bulkAction === 'delete' ? 'Delete All' : bulkAction === 'pause' ? 'Pause All' : 'Activate All'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── BULK UPLOAD DIALOG ─────────────────────────────── */}
      <Dialog open={showBulkUpload} onOpenChange={(open) => { 
        if (!open) {
          setShowBulkUpload(false);
          setBulkUploadFile(null);
          setBulkUploadData([]);
          setBulkUploadErrors([]);
          setBulkUploadResults(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-primary" />
              Bulk Upload Students
            </DialogTitle>
            <DialogDescription>
              Upload an Excel file with multiple student records. Download the template to get started.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Step 1: Download Template */}
            <div className="flex items-start gap-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white font-bold text-sm">
                1
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Download Template</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Get the Excel template with all required fields. Fill it with your student data.
                </p>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Excel Template
                </Button>
              </div>
            </div>

            {/* Step 2: Upload File */}
            <div className="flex items-start gap-4 p-4 rounded-lg border">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white font-bold text-sm">
                2
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Upload Filled Template</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Upload your completed Excel file. We'll validate the data automatically.
                </p>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isBulkUploading}
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={isBulkUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {bulkUploadFile ? 'Change File' : 'Choose Excel File'}
                  </Button>
                </div>
                {bulkUploadFile && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    <span className="font-medium">{bulkUploadFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setBulkUploadFile(null);
                        setBulkUploadData([]);
                        setBulkUploadErrors([]);
                      }}
                      disabled={isBulkUploading}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Validation Results */}
            {bulkUploadErrors.length > 0 && (
              <div className="p-4 rounded-lg border border-red-200 bg-red-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 mb-2">Validation Errors</h3>
                    <ScrollArea className="max-h-40">
                      <ul className="space-y-1">
                        {bulkUploadErrors.map((error, idx) => (
                          <li key={idx} className="text-sm text-red-700">• {error}</li>
                        ))}
                      </ul>
                    </ScrollArea>
                    <p className="text-xs text-red-600 mt-2">
                      Fix these errors in your Excel file and upload again.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {bulkUploadData.length > 0 && bulkUploadErrors.length === 0 && !bulkUploadResults && (
              <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-emerald-900 mb-1">Ready to Import</h3>
                    <p className="text-sm text-emerald-700">
                      <span className="font-semibold">{bulkUploadData.length} students</span> validated and ready to be added to your account.
                    </p>
                    <div className="mt-3 space-y-1">
                      {bulkUploadData.slice(0, 3).map((student, idx) => (
                        <div key={idx} className="text-xs text-emerald-700 flex items-center gap-2">
                          <CheckCheck className="h-3 w-3" />
                          <span>{student.full_name} - {student.grade_level}</span>
                        </div>
                      ))}
                      {bulkUploadData.length > 3 && (
                        <p className="text-xs text-emerald-600 ml-5">
                          {`+ ${bulkUploadData.length - 3} more student(s)`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Import */}
            {bulkUploadData.length > 0 && bulkUploadErrors.length === 0 && (
              <div className="flex items-start gap-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white font-bold text-sm">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Create Student Accounts</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Click the button below to create all student accounts. Each will get a unique access link.
                  </p>
                  <Button
                    onClick={handleBulkUpload}
                    disabled={isBulkUploading}
                    className="shadow-md"
                  >
                    {isBulkUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Accounts...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Create {bulkUploadData.length} Student Account{bulkUploadData.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Upload Results */}
            {bulkUploadResults && (
              <div className={`p-4 rounded-lg border ${bulkUploadResults.failed === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-start gap-3">
                  {bulkUploadResults.failed === 0 ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                  )}
                  <div className="flex-1">
                    <h3 className={`font-semibold mb-2 ${bulkUploadResults.failed === 0 ? 'text-emerald-900' : 'text-amber-900'}`}>
                      {bulkUploadResults.failed === 0 ? 'Upload Complete!' : 'Upload Completed with Warnings'}
                    </h3>
                    <div className="space-y-1 text-sm">
                      <p className="text-emerald-700 font-medium">
                        ✓ {bulkUploadResults.success} student{bulkUploadResults.success !== 1 ? 's' : ''} created successfully
                      </p>
                      {bulkUploadResults.failed > 0 && (
                        <p className="text-amber-700 font-medium">
                          ✗ {bulkUploadResults.failed} student{bulkUploadResults.failed !== 1 ? 's' : ''} failed to create
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowBulkUpload(false);
                setBulkUploadFile(null);
                setBulkUploadData([]);
                setBulkUploadErrors([]);
                setBulkUploadResults(null);
              }}
              disabled={isBulkUploading}
            >
              {bulkUploadResults ? 'Close' : 'Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentAccountCreation;
