import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Upload as UploadIcon,
  X,
  AlertCircle,
  Brain,
  Download,
  Trash2,
  Bug,
  Lightbulb,
  Search,
  SortAsc,
  SortDesc,
  FileText,
  Image,
  FileSpreadsheet,
  FileArchive,
  RefreshCw,
  Loader2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Pencil,
  Users,
  BookOpen,
  FolderOpen,
  Check,
  Copy,
  Eye,
  LayoutGrid,
  List,
  GripVertical,
  TrendingUp,
  FileDown,
  ZoomIn,
  Keyboard,
} from "lucide-react";
import { fileToBase64 } from "@/services/api";
import ReactMarkdown from "react-markdown";
import AnimatedBorder from "@/components/ui/AnimatedBorder";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  type StudentWork,
  uploadStudentWorkFile,
  createStudentWork,
  getStudentWorks,
  updateStudentWork,
  deleteStudentWork,
  deleteStudentWorkFile,
} from "@/lib/supabase";
import jsPDF from "jspdf";

/* ─── Direct API helper (uses fallback key for reliability) ─── */

const OPENROUTER_KEY =
  import.meta.env.VITE_OPENROUTER_API_KEY ||
  "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";
const OPENROUTER_URL =
  import.meta.env.VITE_OPENROUTER_API_URL ||
  "https://openrouter.ai/api/v1/chat/completions";

const analyzeStudentImage = async (
  prompt: string,
  imageBase64: string
): Promise<string> => {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "Mother of Mathematics",
    },
    body: JSON.stringify({
      model: "anthropic/claude-opus-4.6",
      messages: [
        {
          role: "system",
          content:
            "You are MAMA, an expert mathematics education specialist for Cameroon primary schools. When analyzing student work, pay extremely close attention to HOW each number and letter is written — not just whether the answer is numerically correct. Flag reversed, mirrored, inverted, or malformed characters. Describe exactly what each written character looks like. Use Markdown headings for clear formatting.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageBase64, detail: "high" } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 1500,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${res.status}`);
  }

  const data = await res.json();
  return (
    data.choices?.[0]?.message?.content?.trim() || "No analysis returned."
  );
};

/* ─── Types ─── */

interface UploadedFile {
  id: string;
  dbId?: string;
  file?: File;
  fileName: string;
  fileType: string;
  fileSize: number;
  preview?: string;
  progress: number;
  status: "uploading" | "success" | "error" | "analyzing";
  error?: string;
  analysis?: {
    text: string;
    errorType?: string;
    remediation?: string;
  };
  uploadDate: Date;
  studentName: string;
  subject: string;
  grade: string;
}

/* ─── Component ─── */

const Upload = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [historyFiles, setHistoryFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");

  /* ─── Analyzed History tab state ─── */
  const [batchNames, setBatchNames] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("mama-batch-names") || "{}");
    } catch {
      return {};
    }
  });
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(
    new Set()
  );
  const [historySearch, setHistorySearch] = useState("");
  const [editingBatch, setEditingBatch] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  /* ─── Feature state ─── */
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [expandedAnalyses, setExpandedAnalyses] = useState<Set<string>>(
    new Set()
  );
  const [lightboxFile, setLightboxFile] = useState<UploadedFile | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    null | "clearAll" | "deleteSelected"
  >(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showBatchMetadata, setShowBatchMetadata] = useState(false);
  const [batchMeta, setBatchMeta] = useState({
    studentName: "",
    subject: "",
    grade: "",
  });

  /* Drag-to-reorder refs */
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);

  /* ─── Load saved student works from DB on mount ─── */

  useEffect(() => {
    const loadWorks = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      try {
        const works = await getStudentWorks(user.id);
        const loaded: UploadedFile[] = works.map((sw) => ({
          id: sw.id,
          dbId: sw.id,
          fileName: sw.file_name || sw.student_name || "Unknown",
          fileType: sw.file_type || "image/*",
          fileSize: sw.file_size || 0,
          preview: sw.image_url || undefined,
          progress: 100,
          status: "success" as const,
          analysis: sw.feedback
            ? {
                text: sw.feedback,
                errorType: sw.error_type || undefined,
                remediation: sw.remediation || undefined,
              }
            : undefined,
          uploadDate: new Date(sw.created_at),
          studentName: sw.student_name || "",
          subject: sw.subject || "",
          grade: sw.grade || "",
        }));
        setHistoryFiles(loaded);
      } catch (e) {
        console.error("Failed to load student works:", e);
        toast.error("Failed to load saved uploads");
      } finally {
        setIsLoading(false);
      }
    };
    loadWorks();
  }, [user?.id]);

  /* ─── Feature 11: Keyboard shortcuts ─── */

  const shortcutRef = useRef<{
    selectAll: () => void;
    analyzeAll: () => void;
    deleteSelected: () => void;
    hasSelected: boolean;
  }>({
    selectAll: () => {},
    analyzeAll: () => {},
    deleteSelected: () => {},
    hasSelected: false,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        shortcutRef.current.analyzeAll();
      } else if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        shortcutRef.current.selectAll();
      } else if (e.key === "Delete" && shortcutRef.current.hasSelected) {
        e.preventDefault();
        setConfirmAction("deleteSelected");
      } else if (e.key === "Escape") {
        setSelectedFiles([]);
        setLightboxFile(null);
        setShowShortcuts(false);
      } else if (e.key === "?") {
        setShowShortcuts((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ─── Parsing helpers ─── */

  const extractErrorType = (text: string): string | undefined => {
    const m = text.match(/##\s*Error Type[\s\S]*?\n([\s\S]*?)(?=##\s|$)/i);
    return m ? m[1].trim() : undefined;
  };

  const extractRemediation = (text: string): string | undefined => {
    const m = text.match(/##\s*Remediation[\s\S]*?\n([\s\S]*?)(?=##\s|$)/i);
    return m ? m[1].trim() : undefined;
  };

  /* Strip markdown symbols from text */
  const stripMd = (text: string) =>
    text
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
      .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^#{1,6}\s*/gm, '')
      .trim();

  /* Parse AI feedback into structured sections */
  const parseAiFeedback = (text: string) => {
    const sections: { analysis: string; error_type: string; grade: string; remediation: string } = {
      analysis: '', error_type: '', grade: '', remediation: '',
    };
    const regex = /##\s*(Analysis|Error Type|Grade|Remediation)\s*\n([\s\S]*?)(?=##\s|$)/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const key = match[1].toLowerCase();
      const value = stripMd(match[2].trim());
      if (key === 'analysis') sections.analysis = value;
      else if (key === 'error type') sections.error_type = value;
      else if (key === 'grade') sections.grade = value;
      else if (key === 'remediation') sections.remediation = value;
    }
    return sections;
  };

  /* Feature 6: Extract grade percentage from analysis text */
  const extractGradeValue = (text: string): number | null => {
    const pctMatch = text.match(/(\d{1,3})\s*%/);
    if (pctMatch) {
      const val = parseInt(pctMatch[1]);
      if (val >= 0 && val <= 100) return val;
    }
    const fracMatch = text.match(/(\d{1,3})\s*\/\s*100/);
    if (fracMatch) {
      const val = parseInt(fracMatch[1]);
      if (val >= 0 && val <= 100) return val;
    }
    const outOfMatch = text.match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
    if (outOfMatch) {
      const num = parseInt(outOfMatch[1]);
      const den = parseInt(outOfMatch[2]);
      if (den > 0) return Math.round((num / den) * 100);
    }
    return null;
  };

  const getGradeBadgeClasses = (grade: number) => {
    if (grade >= 70) return "bg-primary/10 text-primary border-primary/20";
    if (grade >= 50) return "bg-primary/5 text-primary/80 border-primary/10";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  /* ─── AI Analysis ─── */

  const analyzeFile = useCallback(async (fileObj: UploadedFile) => {
    try {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileObj.id
            ? { ...f, status: "analyzing" as const, error: undefined }
            : f
        )
      );

      let base64: string;
      if (fileObj.file) {
        base64 = await fileToBase64(fileObj.file);
      } else if (fileObj.preview && fileObj.preview.startsWith("data:")) {
        base64 = fileObj.preview;
      } else if (fileObj.preview) {
        const resp = await fetch(fileObj.preview);
        const blob = await resp.blob();
        base64 = await fileToBase64(
          new window.File([blob], fileObj.fileName, { type: blob.type })
        );
      } else {
        throw new Error("No image data available for analysis");
      }

      const prompt = `Analyze this student's math work. Be very brief and direct. Follow this format exactly:

ABSOLUTE RULE — NO EXCEPTIONS:
Look at EVERY single digit the student wrote. If ANY digit is mirrored, reversed, inverted, backwards, flipped, poorly formed, or written in the wrong direction, that ENTIRE answer is WRONG (✗). This includes common cases like:
- A "4" written as a mirror image / facing the wrong direction → WRONG
- A "3" reversed or facing left instead of right → WRONG
- A "9" that looks like a "6" or vice versa → WRONG
- Digits joined together so "10" looks like "e" → WRONG
- Any digit that is ambiguous or could be misread → WRONG
The ONLY way an answer gets ✓ is if the number value is correct AND every digit is clearly and correctly formed. Do NOT give ✓ to a mirrored or reversed digit.

## Analysis
[One sentence per question. Mark ✓ ONLY if correct value AND correct writing. Mark ✗ if wrong value OR any digit is mirrored/reversed/malformed, then state what is wrong. Example: "Q1: 2+2=? Wrote '4' ✗ — the 4 is mirrored/reversed." Maximum 1 line per question, 6 lines total.]

## Error Type
[Name each specific error with question number and digit. Example: "Mirrored '4' in Q1, reversed '3' in Q3." Choose from: Mirroring, Reversal, Number formation, Number recognition, Number discrimination, Place value, Simple operations, Patterns and sequencing. If none: 'None Found'. Maximum 2 lines.]

## Grade
[Just the percentage, e.g. "25%". No explanation.]

## Remediation
[2-3 brief bullet points addressing the specific errors found. Include handwriting practice for each mirrored/reversed digit. Maximum 3 lines.]

No extra text or introductions. Use simple language for primary school teachers.
`;

      const responseText = await analyzeStudentImage(prompt, base64);
      const analysis = {
        text: responseText,
        errorType: extractErrorType(responseText),
        remediation: extractRemediation(responseText),
      };

      if (fileObj.dbId) {
        try {
          await updateStudentWork(fileObj.dbId, {
            feedback: analysis.text,
            error_type: analysis.errorType || undefined,
            remediation: analysis.remediation || undefined,
            status: "analyzed",
          });
        } catch (e) {
          console.error("DB analysis save failed:", e);
        }
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileObj.id
            ? { ...f, status: "success" as const, analysis }
            : f
        )
      );
      toast.success("Analysis completed successfully");
    } catch (error) {
      console.error("Analysis error:", error);
      const errMsg =
        error instanceof Error ? error.message : "Analysis failed";
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileObj.id
            ? { ...f, status: "error" as const, error: errMsg }
            : f
        )
      );
      if (fileObj.dbId) {
        try {
          await updateStudentWork(fileObj.dbId, { status: "error" });
        } catch {}
      }
      toast.error("Failed to analyze student work");
    }
  }, []);

  const analyzeAllFiles = useCallback(async () => {
    const toAnalyze = files.filter(
      (f) =>
        (f.status === "success" && !f.analysis) || f.status === "error"
    );
    if (toAnalyze.length === 0) {
      toast.info("No files need analysis");
      return;
    }
    toast.info(`Analyzing ${toAnalyze.length} file(s)…`);
    for (const file of toAnalyze) {
      await analyzeFile(file);
    }
  }, [files, analyzeFile]);

  /* ─── Download analysis (text) ─── */

  const downloadAnalysis = (file: UploadedFile) => {
    if (!file.analysis) return;
    const content = [
      "Student Work Analysis",
      "====================",
      `File: ${file.fileName}`,
      `Student: ${file.studentName || "N/A"}`,
      `Subject: ${file.subject || "N/A"}`,
      `Grade Level: ${file.grade || "N/A"}`,
      `Date: ${file.uploadDate.toLocaleDateString()}`,
      "",
      "Analysis:",
      file.analysis.text,
      "",
      file.analysis.errorType
        ? `Error Type: ${file.analysis.errorType}`
        : "",
      file.analysis.remediation
        ? `Remediation: ${file.analysis.remediation}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file.fileName}-analysis.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* Feature 7: Copy analysis to clipboard */
  const copyAnalysis = async (file: UploadedFile) => {
    if (!file.analysis) return;
    try {
      await navigator.clipboard.writeText(file.analysis.text);
      toast.success("Analysis copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  /* Feature 5: Export all analyses as PDF report */
  const exportPDF = useCallback(() => {
    const allCombined = [...files, ...historyFiles];
    const analyzed = allCombined.filter((f) => f.analysis);
    if (analyzed.length === 0) {
      toast.info("No analyzed files to export");
      return;
    }

    const doc = new jsPDF();
    let y = 20;

    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Student Work Analysis Report", 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, y);
    y += 5;
    doc.text(`Total analyzed files: ${analyzed.length}`, 20, y);
    y += 5;

    // Average grade
    const grades = analyzed
      .map((f) => extractGradeValue(f.analysis!.text))
      .filter((g): g is number => g !== null);
    if (grades.length > 0) {
      const avg = Math.round(
        grades.reduce((a, b) => a + b, 0) / grades.length
      );
      doc.text(`Average grade: ${avg}%`, 20, y);
      y += 5;
    }

    y += 5;
    doc.setDrawColor(200);
    doc.line(20, y, 190, y);
    y += 10;

    for (const file of analyzed) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(file.fileName, 20, y);
      y += 7;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const meta = [
        `Student: ${file.studentName || "N/A"}`,
        `Subject: ${file.subject || "N/A"}`,
        `Grade Level: ${file.grade || "N/A"}`,
        `Date: ${file.uploadDate.toLocaleDateString()}`,
      ].join("  |  ");
      doc.text(meta, 20, y);
      y += 6;

      const gradeVal = extractGradeValue(file.analysis!.text);
      if (gradeVal !== null) {
        doc.setFont("helvetica", "bold");
        doc.text(`Score: ${gradeVal}%`, 20, y);
        doc.setFont("helvetica", "normal");
        y += 6;
      }

      // Analysis text (strip markdown)
      const cleanText = file
        .analysis!.text.replace(/#{1,6}\s*/g, "")
        .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
        .replace(/`([^`]+)`/g, "$1");
      const lines = doc.splitTextToSize(cleanText, 170);
      for (const line of lines) {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += 4.5;
      }

      y += 5;
      doc.setDrawColor(230);
      doc.line(20, y, 190, y);
      y += 8;
    }

    doc.save("student-work-report.pdf");
    toast.success("PDF report exported successfully");
  }, [files, historyFiles]);

  /* ─── Delete helpers ─── */

  const removeFile = useCallback(
    async (id: string) => {
      const file = files.find((f) => f.id === id);
      if (file?.dbId) {
        try {
          if (file.preview && !file.preview.startsWith("data:")) {
            await deleteStudentWorkFile(file.preview);
          }
          await deleteStudentWork(file.dbId);
        } catch (e) {
          console.error("DB delete error:", e);
        }
      }
      setFiles((prev) => prev.filter((f) => f.id !== id));
      setSelectedFiles((prev) => prev.filter((fId) => fId !== id));
      toast.success("File removed");
    },
    [files]
  );

  const clearAllFiles = useCallback(async () => {
    if (files.length === 0) return;
    toast.info("Clearing all files…");
    for (const file of files) {
      if (file.dbId) {
        try {
          if (file.preview && !file.preview.startsWith("data:")) {
            await deleteStudentWorkFile(file.preview);
          }
          await deleteStudentWork(file.dbId);
        } catch (e) {
          console.error("DB delete error:", e);
        }
      }
    }
    setFiles([]);
    setSelectedFiles([]);
    toast.success("All files cleared");
  }, [files]);

  /* ─── Bulk actions ─── */

  const deleteSelected = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    const count = selectedFiles.length;
    for (const id of [...selectedFiles]) {
      await removeFile(id);
    }
    setSelectedFiles([]);
    toast.success(`Deleted ${count} file(s)`);
  }, [selectedFiles, removeFile]);

  const analyzeSelected = useCallback(async () => {
    const toAnalyze = files.filter(
      (f) =>
        selectedFiles.includes(f.id) &&
        ((f.status === "success" && !f.analysis) || f.status === "error")
    );
    if (toAnalyze.length === 0) {
      toast.info("Selected files are already analyzed");
      return;
    }
    toast.info(`Analyzing ${toAnalyze.length} file(s)…`);
    for (const file of toAnalyze) {
      await analyzeFile(file);
    }
    setSelectedFiles([]);
  }, [selectedFiles, files, analyzeFile]);

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  };

  /* ─── Metadata helpers ─── */

  const updateFieldLocal = (
    id: string,
    field: "studentName" | "subject" | "grade",
    value: string
  ) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  const saveFieldToDb = async (
    dbId: string | undefined,
    field: "studentName" | "subject" | "grade",
    value: string
  ) => {
    if (!dbId) return;
    const dbField =
      field === "studentName"
        ? "student_name"
        : field === "grade"
        ? "grade"
        : "subject";
    try {
      await updateStudentWork(dbId, { [dbField]: value });
    } catch (e) {
      console.error("Metadata save error:", e);
    }
  };

  /* Feature 9: Batch metadata apply */
  const applyBatchMetadata = async () => {
    if (selectedFiles.length === 0) return;
    for (const id of selectedFiles) {
      const file = files.find((f) => f.id === id);
      if (!file) continue;
      if (batchMeta.studentName.trim()) {
        updateFieldLocal(id, "studentName", batchMeta.studentName.trim());
        if (file.dbId)
          await saveFieldToDb(
            file.dbId,
            "studentName",
            batchMeta.studentName.trim()
          );
      }
      if (batchMeta.subject.trim()) {
        updateFieldLocal(id, "subject", batchMeta.subject.trim());
        if (file.dbId)
          await saveFieldToDb(
            file.dbId,
            "subject",
            batchMeta.subject.trim()
          );
      }
      if (batchMeta.grade.trim()) {
        updateFieldLocal(id, "grade", batchMeta.grade.trim());
        if (file.dbId)
          await saveFieldToDb(file.dbId, "grade", batchMeta.grade.trim());
      }
    }
    setShowBatchMetadata(false);
    setBatchMeta({ studentName: "", subject: "", grade: "" });
    toast.success(`Metadata applied to ${selectedFiles.length} file(s)`);
  };

  /* ─── File drop / upload ─── */

  const processUpload = useCallback(
    async (file: File) => {
      if (!user?.id) {
        toast.error("Please sign in to upload files");
        return;
      }

      const clientId = Math.random().toString(36).substring(2, 10);

      const newFile: UploadedFile = {
        id: clientId,
        file,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        progress: 0,
        status: "uploading",
        uploadDate: new Date(),
        studentName: "",
        subject: "",
        grade: "",
      };

      setFiles((prev) => [...prev, newFile]);

      try {
        // 1. Generate base64 preview for images
        let base64Preview: string | undefined;
        if (file.type.startsWith("image/")) {
          base64Preview = await fileToBase64(file);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === clientId
                ? { ...f, preview: base64Preview, progress: 20 }
                : f
            )
          );
        } else {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === clientId ? { ...f, progress: 20 } : f
            )
          );
        }

        // 2. Upload file to Supabase Storage (with base64 fallback)
        let imageUrl: string;
        try {
          imageUrl = await uploadStudentWorkFile(user.id, file);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === clientId
                ? {
                    ...f,
                    progress: 60,
                    preview: file.type.startsWith("image/")
                      ? base64Preview || imageUrl
                      : undefined,
                  }
                : f
            )
          );
        } catch (storageErr) {
          console.warn(
            "Storage upload failed, using base64 fallback:",
            storageErr
          );
          imageUrl = base64Preview || (await fileToBase64(file));
          setFiles((prev) =>
            prev.map((f) =>
              f.id === clientId ? { ...f, progress: 60 } : f
            )
          );
        }

        // 3. Save record to database
        let dbRecord: StudentWork | null = null;
        try {
          dbRecord = await createStudentWork({
            student_name: "",
            subject: "",
            image_url: imageUrl,
            parent_id: user.id,
            teacher_id: user.id,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            status: "uploaded",
          });
        } catch (dbErr) {
          console.warn("DB save failed:", dbErr);
        }

        // 4. Mark upload complete
        const dbId = dbRecord?.id;
        setFiles((prev) =>
          prev.map((f) =>
            f.id === clientId
              ? {
                  ...f,
                  progress: 100,
                  status: "success" as const,
                  dbId,
                }
              : f
          )
        );
        toast.success(`Uploaded ${file.name}`);

        // 5. Auto-analyze images
        if (file.type.startsWith("image/")) {
          const forAnalysis: UploadedFile = {
            ...newFile,
            dbId,
            preview: base64Preview || imageUrl,
            progress: 100,
            status: "success",
          };
          await analyzeFile(forAnalysis);
        }
      } catch (error) {
        console.error("Upload error:", error);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === clientId
              ? {
                  ...f,
                  status: "error" as const,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Upload failed",
                }
              : f
          )
        );
        toast.error(`Failed to upload ${file.name}`);
      }
    },
    [user?.id, analyzeFile]
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!user?.id) {
        toast.error("Please sign in to upload files");
        return;
      }
      setIsUploading(true);
      for (const file of acceptedFiles) {
        await processUpload(file);
      }
      setIsUploading(false);
    },
    [user?.id, processUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
      "text/plain": [".txt"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
  });

  /* ─── Helpers ─── */

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/"))
      return <Image className="h-6 w-6" />;
    if (fileType === "application/pdf")
      return <FileText className="h-6 w-6" />;
    if (fileType.includes("spreadsheet") || fileType.includes("excel"))
      return <FileSpreadsheet className="h-6 w-6" />;
    return <FileArchive className="h-6 w-6" />;
  };

  /* ─── Collapsible analysis toggle ─── */
  const toggleAnalysis = (fileId: string) => {
    setExpandedAnalyses((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  /* Feature 10: Drag-to-reorder */
  const handleDragStart = (fileId: string) => {
    dragItem.current = fileId;
  };

  const handleDragOver = (e: React.DragEvent, fileId: string) => {
    e.preventDefault();
    dragOverItem.current = fileId;
  };

  const handleDragEnd = () => {
    if (
      dragItem.current &&
      dragOverItem.current &&
      dragItem.current !== dragOverItem.current
    ) {
      setFiles((prev) => {
        const arr = [...prev];
        const fromIdx = arr.findIndex((f) => f.id === dragItem.current);
        const toIdx = arr.findIndex((f) => f.id === dragOverItem.current);
        if (fromIdx < 0 || toIdx < 0) return prev;
        const [item] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, item);
        return arr;
      });
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  /* ─── All files = current session uploads + history combined for stats ─── */
  const allFiles = [...files, ...historyFiles];

  /* ─── Filtering & sorting (current session files only for All Files tab) ─── */

  const filteredFiles = files.filter((file) => {
    const matchesSearch =
      file.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.studentName
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      file.subject?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || file.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    const dateA = new Date(a.uploadDate).getTime();
    const dateB = new Date(b.uploadDate).getTime();
    return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
  });

  /* ─── Stats (use allFiles for totals) ─── */

  const totalFiles = allFiles.length;
  const analyzedCount = allFiles.filter(
    (f) => f.status === "success" && f.analysis
  ).length;
  const pendingCount = files.filter(
    (f) => f.status === "uploading" || f.status === "analyzing"
  ).length;
  const errorCount = allFiles.filter((f) => f.status === "error").length;
  const needsAnalysis = files.filter(
    (f) =>
      (f.status === "success" && !f.analysis) || f.status === "error"
  ).length;
  const currentSessionCount = files.length;

  /* Feature 1: Average grade */
  const avgGrade = (() => {
    const grades = allFiles
      .filter((f) => f.analysis)
      .map((f) => extractGradeValue(f.analysis!.text))
      .filter((g): g is number => g !== null);
    if (grades.length === 0) return null;
    return Math.round(grades.reduce((a, b) => a + b, 0) / grades.length);
  })();

  const selectAll = () => {
    if (selectedFiles.length === sortedFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(sortedFiles.map((f) => f.id));
    }
  };

  /* Keep keyboard shortcut ref up to date */
  shortcutRef.current = {
    selectAll,
    analyzeAll: analyzeAllFiles,
    deleteSelected,
    hasSelected: selectedFiles.length > 0,
  };

  /* ─── Batch helpers for Analyzed History tab ─── */
  /* History = DB-loaded files + current session analyzed files */

  const analyzedFiles = [
    ...historyFiles.filter((f) => f.status === "success" && f.analysis),
    ...files.filter((f) => f.status === "success" && f.analysis),
  ];

  /** Group analyzed files by upload date (YYYY-MM-DD) */
  const getBatches = () => {
    const groups: Record<string, UploadedFile[]> = {};
    for (const f of analyzedFiles) {
      const key = f.uploadDate.toISOString().slice(0, 10); // YYYY-MM-DD
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    }
    // Sort batches newest first
    return Object.entries(groups).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );
  };

  const allBatches = getBatches();

  /** Filter batches by history search */
  const filteredBatches = allBatches.filter(([dateKey, batchFiles]) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    const batchLabel = batchNames[dateKey]?.toLowerCase() || "";
    const dateLabel = new Date(dateKey + "T00:00:00")
      .toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
      .toLowerCase();
    if (batchLabel.includes(q)) return true;
    if (dateLabel.includes(q)) return true;
    if (dateKey.includes(q)) return true;
    return batchFiles.some(
      (f) =>
        f.studentName.toLowerCase().includes(q) ||
        f.subject.toLowerCase().includes(q) ||
        f.fileName.toLowerCase().includes(q)
    );
  });

  const toggleBatch = (key: string) => {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const saveBatchName = (dateKey: string) => {
    const updated = { ...batchNames, [dateKey]: editingName.trim() };
    if (!editingName.trim()) delete updated[dateKey];
    setBatchNames(updated);
    localStorage.setItem("mama-batch-names", JSON.stringify(updated));
    setEditingBatch(null);
    setEditingName("");
  };

  const startEditBatch = (dateKey: string) => {
    setEditingBatch(dateKey);
    setEditingName(batchNames[dateKey] || "");
  };

  const formatBatchDate = (dateKey: string) =>
    new Date(dateKey + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const getUniqueValues = (
    batchFiles: UploadedFile[],
    field: "studentName" | "subject"
  ) => {
    const vals = batchFiles.map((f) => f[field]).filter(Boolean);
    return [...new Set(vals)];
  };

  /* ─── Render a single file card (LIST view) ─── */

  const renderFileCard = (file: UploadedFile) => {
    const gradeVal = file.analysis
      ? extractGradeValue(file.analysis.text)
      : null;
    const isAnalysisExpanded = expandedAnalyses.has(file.id);

    return (
      <motion.div
        key={file.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="relative"
        draggable
        onDragStart={() => handleDragStart(file.id)}
        onDragOver={(e) => handleDragOver(e, file.id)}
        onDragEnd={handleDragEnd}
      >
        <div className="border rounded-lg p-3 sm:p-6 hover:shadow-sm transition-shadow">
          <div className="flex items-start gap-2 sm:gap-4">
            {/* Drag handle — hidden on mobile */}
            <div className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors hidden sm:block">
              <GripVertical className="h-5 w-5" />
            </div>

            {/* Checkbox */}
            <button
              onClick={() => toggleFileSelection(file.id)}
              className="mt-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {selectedFiles.includes(file.id) ? (
                <CheckSquare className="h-5 w-5 text-primary" />
              ) : (
                <Square className="h-5 w-5" />
              )}
            </button>

            {/* Thumbnail with lightbox trigger */}
            <div className="relative p-2 rounded-lg bg-primary/10 group/thumb">
              {file.preview && file.fileType.startsWith("image/") ? (
                <>
                  <img
                    src={file.preview}
                    alt={file.fileName}
                    className="w-12 h-12 object-cover rounded"
                  />
                  <button
                    onClick={() => setLightboxFile(file)}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity rounded-lg"
                  >
                    <ZoomIn className="h-5 w-5 text-white" />
                  </button>
                </>
              ) : (
                getFileIcon(file.fileType)
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Top row: name, date, badges, actions */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h3 className="font-medium truncate max-w-[140px] sm:max-w-[200px] text-sm sm:text-base">
                    {file.fileName}
                  </h3>
                  <span className="text-xs sm:text-sm text-muted-foreground">
                    {file.uploadDate.toLocaleDateString()}
                  </span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                    ({(file.fileSize / 1024).toFixed(1)} KB)
                  </span>
                  {/* Feature 6: AI Grade Badge */}
                  {gradeVal !== null && (
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border",
                        getGradeBadgeClasses(gradeVal)
                      )}
                    >
                      {gradeVal}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Badge
                    variant={
                      file.status === "success"
                        ? "default"
                        : file.status === "error"
                        ? "destructive"
                        : file.status === "analyzing"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {file.status === "analyzing" && (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    )}
                    {file.status}
                  </Badge>

                  {/* Re-analyze */}
                  {file.status !== "uploading" &&
                    file.status !== "analyzing" &&
                    file.fileType.startsWith("image") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => analyzeFile(file)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Re-analyze"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}

                  {/* Feature 7: Copy analysis */}
                  {file.analysis && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyAnalysis(file)}
                      className="text-muted-foreground hover:text-foreground"
                      title="Copy analysis"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}

                  {/* Download analysis */}
                  {file.status === "success" && file.analysis && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => downloadAnalysis(file)}
                      className="text-green-600 hover:text-green-700"
                      title="Download analysis"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}

                  {/* Remove */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(file.id)}
                    className="text-destructive hover:text-destructive/80"
                    title="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Metadata inputs */}
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2">
                <Input
                  placeholder="Student name"
                  value={file.studentName}
                  onChange={(e) =>
                    updateFieldLocal(
                      file.id,
                      "studentName",
                      e.target.value
                    )
                  }
                  onBlur={(e) =>
                    saveFieldToDb(
                      file.dbId,
                      "studentName",
                      e.target.value
                    )
                  }
                  className="h-7 text-xs w-28 sm:w-36"
                />
                <Input
                  placeholder="Subject"
                  value={file.subject}
                  onChange={(e) =>
                    updateFieldLocal(file.id, "subject", e.target.value)
                  }
                  onBlur={(e) =>
                    saveFieldToDb(file.dbId, "subject", e.target.value)
                  }
                  className="h-7 text-xs w-24 sm:w-32"
                />
                <Input
                  placeholder="Grade"
                  value={file.grade}
                  onChange={(e) =>
                    updateFieldLocal(file.id, "grade", e.target.value)
                  }
                  onBlur={(e) =>
                    saveFieldToDb(file.dbId, "grade", e.target.value)
                  }
                  className="h-7 text-xs w-20 sm:w-28"
                />
              </div>

              {/* Progress / Analysis / Error */}
              <div className="space-y-2">
                {file.progress < 100 && (
                  <Progress value={file.progress} className="h-2" />
                )}

                {file.status === "analyzing" && (
                  <div className="flex items-center gap-2 text-muted-foreground mt-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">
                      Analyzing student work…
                    </span>
                  </div>
                )}

                {/* Feature 3: Collapsible analysis */}
                {file.status === "success" && file.analysis && (
                  <div className="mt-3">
                    <button
                      onClick={() => toggleAnalysis(file.id)}
                      className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isAnalysisExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      <Brain className="h-4 w-4 text-green-600" />
                      <span>
                        {isAnalysisExpanded
                          ? "Hide Analysis"
                          : "Show Analysis"}
                      </span>
                    </button>
                    <AnimatePresence>
                      {isAnalysisExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 pl-6">
                            {(() => {
                              const s = parseAiFeedback(file.analysis!.text);
                              const gradeVal = extractGradeValue(file.analysis!.text);
                              const pctColor = 'text-primary';
                              return (
                                <div className="space-y-2">
                                  {gradeVal !== null && (
                                    <div className={`text-2xl font-extrabold ${pctColor}`}>{gradeVal}%</div>
                                  )}
                                  {s.analysis && (
                                    <div className="rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 p-3">
                                      <p className="text-[10px] font-extrabold text-primary uppercase tracking-widest mb-1">Analysis</p>
                                      <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{s.analysis}</p>
                                    </div>
                                  )}
                                  {s.error_type && (
                                    <div className="rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 p-3">
                                      <p className="text-[10px] font-extrabold text-primary uppercase tracking-widest mb-1">Error Type</p>
                                      <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{s.error_type}</p>
                                    </div>
                                  )}
                                  {s.grade && (
                                    <div className="rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 p-3">
                                      <p className="text-[10px] font-extrabold text-primary uppercase tracking-widest mb-1">Grade</p>
                                      <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{s.grade}</p>
                                    </div>
                                  )}
                                  {s.remediation && (
                                    <div className="rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 p-3">
                                      <p className="text-[10px] font-extrabold text-primary uppercase tracking-widest mb-1">Remediation</p>
                                      <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{s.remediation}</p>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {file.status === "error" && (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>{file.error}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  /* ─── Render a single file card (GRID view) ─── */

  const renderGridCard = (file: UploadedFile) => {
    const gradeVal = file.analysis
      ? extractGradeValue(file.analysis.text)
      : null;

    return (
      <motion.div
        key={file.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative group/card"
        draggable
        onDragStart={() => handleDragStart(file.id)}
        onDragOver={(e) => handleDragOver(e, file.id)}
        onDragEnd={handleDragEnd}
      >
        <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
          {/* Thumbnail */}
          <div className="relative aspect-square bg-muted flex items-center justify-center">
            {file.preview && file.fileType.startsWith("image/") ? (
              <img
                src={file.preview}
                alt={file.fileName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-muted-foreground">
                {getFileIcon(file.fileType)}
              </div>
            )}
            {/* Overlay actions */}
            <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover/card:opacity-100">
              {file.preview && file.fileType.startsWith("image/") && (
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8"
                  onClick={() => setLightboxFile(file)}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8"
                onClick={() => removeFile(file.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {/* Select checkbox */}
            <button
              onClick={() => toggleFileSelection(file.id)}
              className="absolute top-2 left-2 z-10"
            >
              {selectedFiles.includes(file.id) ? (
                <CheckSquare className="h-5 w-5 text-green-600 drop-shadow" />
              ) : (
                <Square className="h-5 w-5 text-white/70 drop-shadow group-hover/card:text-white" />
              )}
            </button>
            {/* Status badge */}
            <div className="absolute top-2 right-2">
              <Badge
                variant={
                  file.status === "success"
                    ? "default"
                    : file.status === "error"
                    ? "destructive"
                    : "secondary"
                }
                className="text-[10px] px-1.5 py-0"
              >
                {file.status === "analyzing" && (
                  <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
                )}
                {file.status}
              </Badge>
            </div>
            {/* Grade badge */}
            {gradeVal !== null && (
              <div className="absolute bottom-2 right-2">
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border shadow-sm",
                    getGradeBadgeClasses(gradeVal)
                  )}
                >
                  {gradeVal}%
                </span>
              </div>
            )}
          </div>
          {/* Info */}
          <div className="p-3 space-y-1">
            <p
              className="text-sm font-medium truncate"
              title={file.fileName}
            >
              {file.fileName}
            </p>
            <p className="text-xs text-muted-foreground">
              {file.uploadDate.toLocaleDateString()} ·{" "}
              {(file.fileSize / 1024).toFixed(0)} KB
            </p>
            {file.studentName && (
              <p className="text-xs text-muted-foreground truncate">
                {file.studentName}
                {file.subject ? ` · ${file.subject}` : ""}
              </p>
            )}
            {file.progress < 100 && (
              <Progress value={file.progress} className="h-1.5" />
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  /* ─── Render file list (supports grid/list) ─── */

  const renderFileList = (
    fileList: UploadedFile[],
    emptyMessage: string
  ) => (
    <div
      className={cn(
        viewMode === "grid"
          ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
          : "grid gap-3 sm:gap-4"
      )}
    >
      {fileList.length === 0 ? (
        <Card className={viewMode === "grid" ? "col-span-full" : ""}>
          <CardContent className="p-6 text-center text-muted-foreground">
            {emptyMessage}
          </CardContent>
        </Card>
      ) : (
        <AnimatePresence>
          {fileList.map((file) =>
            viewMode === "grid"
              ? renderGridCard(file)
              : renderFileCard(file)
          )}
        </AnimatePresence>
      )}
    </div>
  );

  /* ─── Loading state ─── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  /* ─── Render ─── */

  return (
    <div className="space-y-4 sm:space-y-6 px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Student Work Upload
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            Upload and analyze student work for detailed feedback
          </p>
        </div>

        {/* Action bar — scrollable on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {/* View toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden shrink-0">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-none h-8 px-2"
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="rounded-none h-8 px-2"
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>

          {/* Keyboard shortcuts */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowShortcuts(true)}
            title="Keyboard shortcuts (?)"
            className="h-8 w-8 shrink-0 hidden sm:flex"
          >
            <Keyboard className="h-4 w-4" />
          </Button>

          {/* PDF Export */}
          {analyzedCount > 0 && (
            <Button
              size="sm"
              onClick={exportPDF}
              className="flex items-center gap-1.5 shrink-0 bg-primary/90 hover:bg-primary text-primary-foreground"
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span> PDF
            </Button>
          )}

          {/* Analyze All */}
          {needsAnalysis > 0 && (
            <Button
              size="sm"
              onClick={analyzeAllFiles}
              className="flex items-center gap-1.5 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">Analyze All</span>
              <span className="sm:hidden">Analyze</span>
              <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[10px] bg-white/20 text-white border-0">
                {needsAnalysis}
              </Badge>
            </Button>
          )}

          {/* Sort */}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setSortOrder(sortOrder === "asc" ? "desc" : "asc")
            }
            className="flex items-center gap-1.5 shrink-0"
          >
            {sortOrder === "asc" ? (
              <SortAsc className="h-4 w-4" />
            ) : (
              <SortDesc className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Sort</span>
          </Button>

          {/* Bulk actions */}
          {selectedFiles.length > 0 && (
            <>
              <Button
                size="sm"
                onClick={() => setShowBatchMetadata(true)}
                className="flex items-center gap-1.5 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Apply Info</span>
                <span className="sm:hidden">Info</span>
                ({selectedFiles.length})
              </Button>

              <Button
                size="sm"
                onClick={analyzeSelected}
                className="flex items-center gap-1.5 shrink-0 bg-primary/80 hover:bg-primary/90 text-primary-foreground"
              >
                <Brain className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Analyze</span> ({selectedFiles.length})
              </Button>

              <Button
                size="sm"
                onClick={() => setConfirmAction("deleteSelected")}
                className="flex items-center gap-1.5 shrink-0 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Delete</span> ({selectedFiles.length})
              </Button>
            </>
          )}

          {/* Clear All */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmAction("clearAll")}
            className="flex items-center gap-1.5 shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={files.length === 0}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clear All</span>
            <span className="sm:hidden">Clear</span>
          </Button>
        </div>
      </div>

      {/* Feature 1: Stats Summary Cards */}
      {totalFiles > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 rounded-lg bg-primary/10 shrink-0">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Total Files</p>
                <p className="text-xl sm:text-2xl font-bold">{totalFiles}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 rounded-lg bg-primary/10 shrink-0">
                <Brain className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Analyzed</p>
                <p className="text-xl sm:text-2xl font-bold">{analyzedCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 rounded-lg bg-destructive/10 shrink-0">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Errors</p>
                <p className="text-xl sm:text-2xl font-bold">{errorCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <div
                className={cn(
                  "p-2 sm:p-2.5 rounded-lg shrink-0",
                  avgGrade !== null && avgGrade >= 70
                    ? "bg-primary/10"
                    : avgGrade !== null && avgGrade >= 50
                    ? "bg-primary/5"
                    : "bg-muted"
                )}
              >
                <TrendingUp
                  className={cn(
                    "h-4 w-4 sm:h-5 sm:w-5",
                    avgGrade !== null && avgGrade >= 70
                      ? "text-primary"
                      : avgGrade !== null && avgGrade >= 50
                      ? "text-primary/70"
                      : "text-muted-foreground"
                  )}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Avg Grade</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {avgGrade !== null ? `${avgGrade}%` : "—"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs
        defaultValue="all"
        className="space-y-4"
        onValueChange={setActiveTab}
      >
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="all" className="text-xs sm:text-sm px-1 sm:px-3">
            <span className="hidden sm:inline">Upload</span>
            <span className="sm:hidden">Upload</span>
            {currentSessionCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-4 sm:h-5 px-1 sm:px-1.5 text-[9px] sm:text-[10px]"
              >
                {currentSessionCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analyzed" className="text-xs sm:text-sm px-1 sm:px-3">
            <span className="hidden sm:inline">Analyzed</span>
            <span className="sm:hidden">History</span>
            {analyzedCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-4 sm:h-5 px-1 sm:px-1.5 text-[9px] sm:text-[10px]"
              >
                {analyzedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-xs sm:text-sm px-1 sm:px-3">
            Pending
            {pendingCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-4 sm:h-5 px-1 sm:px-1.5 text-[9px] sm:text-[10px]"
              >
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="errors" className="text-xs sm:text-sm px-1 sm:px-3">
            Errors
            {errorCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-1 h-4 sm:h-5 px-1 sm:px-1.5 text-[9px] sm:text-[10px]"
              >
                {errorCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Upload Tab (current session only) ─── */}
        <TabsContent value="all" className="space-y-4">
          {/* Dropzone */}
          <AnimatedBorder>
            <div
              {...getRootProps()}
              className={cn(
                "relative p-5 sm:p-8 text-center cursor-pointer transition-colors",
                isDragActive && "bg-primary/5",
                isUploading && "opacity-50 cursor-not-allowed"
              )}
            >
              <input {...getInputProps()} disabled={isUploading} />
              <div className="flex flex-col items-center justify-center">
                {isUploading ? (
                  <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-primary animate-spin" />
                ) : (
                  <UploadIcon className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
                )}
                <p className="text-base sm:text-lg font-medium mb-1 sm:mb-2">
                  {isDragActive
                    ? "Drop files here"
                    : isUploading
                    ? "Uploading…"
                    : "Drag & drop files here"}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {isUploading
                    ? "Please wait…"
                    : "Click to select files"}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 sm:mt-2">
                  Images, PDFs, docs up to 10MB
                </p>
              </div>
            </div>
          </AnimatedBorder>

          {/* Search & filter (only show if there are current session files) */}
          {currentSessionCount > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 my-2 sm:my-4">
              {sortedFiles.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="flex items-center gap-2 shrink-0 self-start"
                >
                  {selectedFiles.length === sortedFiles.length &&
                  sortedFiles.length > 0 ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {selectedFiles.length === sortedFiles.length &&
                  sortedFiles.length > 0
                    ? "Deselect"
                    : "Select All"}
                </Button>
              )}
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
              <Select
                value={filterStatus}
                onValueChange={setFilterStatus}
              >
                <SelectTrigger className="w-full sm:w-[160px] h-9">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="analyzing">Analyzing</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {currentSessionCount > 0 &&
            renderFileList(
              sortedFiles,
              searchQuery || filterStatus !== "all"
                ? "No files match your search criteria"
                : "No files yet. Upload some files above."
            )}

          {currentSessionCount === 0 && !isUploading && (
            <p className="text-center text-sm text-muted-foreground py-4">
              Upload files above — they'll appear here. Previous uploads are in the <strong>Analyzed</strong> tab.
            </p>
          )}
        </TabsContent>

        {/* ─── Analyzed History Tab ─── */}
        <TabsContent value="analyzed" className="space-y-4">
          {analyzedFiles.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
                <p className="font-medium text-muted-foreground mb-1">
                  No analysis history yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Upload student work in the "All Files" tab — analyzed
                  files will appear here, organized by date.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* History search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by date, batch name, student, or subject…"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Summary strip */}
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FolderOpen className="h-4 w-4" />
                  <span>
                    <strong className="text-foreground">
                      {allBatches.length}
                    </strong>{" "}
                    batch{allBatches.length !== 1 ? "es" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Brain className="h-4 w-4" />
                  <span>
                    <strong className="text-foreground">
                      {analyzedFiles.length}
                    </strong>{" "}
                    total analyses
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    <strong className="text-foreground">
                      {
                        getUniqueValues(analyzedFiles, "studentName")
                          .length
                      }
                    </strong>{" "}
                    students
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  <span>
                    <strong className="text-foreground">
                      {getUniqueValues(analyzedFiles, "subject").length}
                    </strong>{" "}
                    subjects
                  </span>
                </div>
              </div>

              {/* Batch list */}
              {filteredBatches.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No batches match &ldquo;{historySearch}&rdquo;
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredBatches.map(([dateKey, batchFiles]) => {
                    const isExpanded = expandedBatches.has(dateKey);
                    const students = getUniqueValues(
                      batchFiles,
                      "studentName"
                    );
                    const subjects = getUniqueValues(
                      batchFiles,
                      "subject"
                    );
                    const batchName = batchNames[dateKey];

                    return (
                      <motion.div
                        key={dateKey}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="border rounded-xl overflow-hidden"
                      >
                        {/* Batch header — always visible */}
                        <button
                          onClick={() => toggleBatch(dateKey)}
                          className={cn(
                            "group/batch w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-4 text-left transition-colors hover:bg-muted/50",
                            isExpanded && "bg-muted/30 border-b"
                          )}
                        >
                          {/* Chevron */}
                          <div className="text-muted-foreground">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                          </div>

                          {/* Folder icon */}
                          <div
                            className={cn(
                              "p-2 rounded-lg",
                              isExpanded
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <FolderOpen className="h-5 w-5" />
                          </div>

                          {/* Name + date */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {editingBatch === dateKey ? (
                                <div
                                  className="flex items-center gap-1"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Input
                                    value={editingName}
                                    onChange={(e) =>
                                      setEditingName(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        saveBatchName(dateKey);
                                      if (e.key === "Escape")
                                        setEditingBatch(null);
                                    }}
                                    placeholder="Batch name…"
                                    className="h-7 text-sm w-48"
                                    autoFocus
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() =>
                                      saveBatchName(dateKey)
                                    }
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() =>
                                      setEditingBatch(null)
                                    }
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <span className="font-semibold truncate">
                                    {batchName ||
                                      formatBatchDate(dateKey)}
                                  </span>
                                  {batchName && (
                                    <span className="text-xs text-muted-foreground">
                                      {formatBatchDate(dateKey)}
                                    </span>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 opacity-0 group-hover/batch:opacity-100 hover:opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditBatch(dateKey);
                                    }}
                                    title="Rename batch"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                            {/* Meta chips */}
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Brain className="h-3 w-3" />
                                {batchFiles.length} file
                                {batchFiles.length !== 1 ? "s" : ""}
                              </span>
                              {students.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {students.length <= 3
                                    ? students.join(", ")
                                    : `${students.length} students`}
                                </span>
                              )}
                              {subjects.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <BookOpen className="h-3 w-3" />
                                  {subjects.length <= 3
                                    ? subjects.join(", ")
                                    : `${subjects.length} subjects`}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* File count badge */}
                          <Badge
                            variant="secondary"
                            className="shrink-0"
                          >
                            {batchFiles.length}
                          </Badge>
                        </button>

                        {/* Expanded content — the file cards */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{
                                height: "auto",
                                opacity: 1,
                              }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 space-y-3 bg-muted/10">
                                {batchFiles.map((file) =>
                                  renderFileCard(file)
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ─── Pending Tab ─── */}
        <TabsContent value="pending" className="space-y-4">
          {renderFileList(
            sortedFiles.filter(
              (f) => f.status === "uploading" || f.status === "analyzing"
            ),
            "No files pending analysis."
          )}
        </TabsContent>

        {/* ─── Errors Tab ─── */}
        <TabsContent value="errors" className="space-y-4">
          {renderFileList(
            sortedFiles.filter((f) => f.status === "error"),
            "No errors. All files processed successfully!"
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Feature 2: Image Preview Lightbox ─── */}
      <Dialog
        open={!!lightboxFile}
        onOpenChange={(open) => {
          if (!open) setLightboxFile(null);
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-hidden mx-2 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {lightboxFile?.fileName}
            </DialogTitle>
            <DialogDescription>
              {lightboxFile?.studentName &&
                `Student: ${lightboxFile.studentName}`}
              {lightboxFile?.subject &&
                ` · Subject: ${lightboxFile.subject}`}
              {lightboxFile?.grade &&
                ` · Grade: ${lightboxFile.grade}`}
              {!lightboxFile?.studentName &&
                !lightboxFile?.subject &&
                !lightboxFile?.grade &&
                "Full image preview and analysis"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-h-[70vh] sm:max-h-[75vh] pr-1 sm:pr-2">
            {/* Image */}
            <div className="flex items-center justify-center bg-muted/30 rounded-lg p-2 max-h-[35vh] md:max-h-[70vh] overflow-hidden">
              {lightboxFile?.preview ? (
                <img
                  src={lightboxFile.preview}
                  alt={lightboxFile.fileName}
                  className="max-w-full max-h-[33vh] md:max-h-[65vh] object-contain rounded"
                />
              ) : (
                <div className="text-muted-foreground p-12">
                  <FileText className="h-16 w-16 mx-auto" />
                  <p className="text-sm mt-2">Preview not available</p>
                </div>
              )}
            </div>
            {/* Analysis */}
            <div className="space-y-3 overflow-y-auto max-h-[35vh] md:max-h-[70vh] pr-1">
              {lightboxFile?.analysis ? (
                <>
                  {(() => {
                    const s = parseAiFeedback(lightboxFile.analysis!.text);
                    const g = extractGradeValue(lightboxFile.analysis!.text);
                    const pctColor = 'text-primary';
                    const barColor = 'bg-primary';
                    return (
                      <div className="space-y-3">
                        {/* Grade header */}
                        {g !== null && (
                          <div className="flex items-center gap-3">
                            <span className={`text-3xl font-extrabold ${pctColor}`}>{g}%</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${g}%` }} />
                            </div>
                          </div>
                        )}
                        {s.analysis && (
                          <div className="rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 p-3">
                            <p className="text-[10px] font-extrabold text-primary uppercase tracking-widest mb-1">Analysis</p>
                            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{s.analysis}</p>
                          </div>
                        )}
                        {s.error_type && (
                          <div className="rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 p-3">
                            <p className="text-[10px] font-extrabold text-primary uppercase tracking-widest mb-1">Error Type</p>
                            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{s.error_type}</p>
                          </div>
                        )}
                        {s.grade && (
                          <div className="rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 p-3">
                            <p className="text-[10px] font-extrabold text-primary uppercase tracking-widest mb-1">Grade</p>
                            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{s.grade}</p>
                          </div>
                        )}
                        {s.remediation && (
                          <div className="rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20 p-3">
                            <p className="text-[10px] font-extrabold text-primary uppercase tracking-widest mb-1">Remediation</p>
                            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{s.remediation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        lightboxFile && copyAnalysis(lightboxFile)
                      }
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      <Copy className="h-4 w-4 mr-2" /> Copy
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        lightboxFile && downloadAnalysis(lightboxFile)
                      }
                      className="bg-primary/80 hover:bg-primary/90 text-primary-foreground"
                    >
                      <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>No analysis available for this file.</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Feature 4: Confirmation Dialogs ─── */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "clearAll"
                ? "Clear all files?"
                : `Delete ${selectedFiles.length} selected file(s)?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "clearAll"
                ? `This will permanently remove all ${files.length} uploaded file(s) and their analyses from the database. This action cannot be undone.`
                : `This will permanently remove the ${selectedFiles.length} selected file(s) and their analyses. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction === "clearAll") clearAllFiles();
                else deleteSelected();
                setConfirmAction(null);
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {confirmAction === "clearAll"
                ? "Clear All"
                : "Delete Selected"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Feature 9: Batch Metadata Dialog ─── */}
      <Dialog
        open={showBatchMetadata}
        onOpenChange={setShowBatchMetadata}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Metadata to Selected Files</DialogTitle>
            <DialogDescription>
              Fill in the fields below. Only non-empty fields will be
              applied to the {selectedFiles.length} selected file(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Student Name
              </label>
              <Input
                placeholder="e.g. Jean-Pierre"
                value={batchMeta.studentName}
                onChange={(e) =>
                  setBatchMeta((prev) => ({
                    ...prev,
                    studentName: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Subject
              </label>
              <Input
                placeholder="e.g. Mathematics"
                value={batchMeta.subject}
                onChange={(e) =>
                  setBatchMeta((prev) => ({
                    ...prev,
                    subject: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Grade Level
              </label>
              <Input
                placeholder="e.g. CM1"
                value={batchMeta.grade}
                onChange={(e) =>
                  setBatchMeta((prev) => ({
                    ...prev,
                    grade: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowBatchMetadata(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={applyBatchMetadata}
              className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
            >
              Apply to {selectedFiles.length} File(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Feature 11: Keyboard Shortcuts Help ─── */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" /> Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Use these shortcuts to work faster with your uploads.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {[
              {
                keys: "Ctrl + A",
                desc: "Select / deselect all visible files",
              },
              {
                keys: "Ctrl + Shift + A",
                desc: "Analyze all pending files",
              },
              { keys: "Delete", desc: "Delete selected files" },
              {
                keys: "Escape",
                desc: "Deselect all / close dialogs",
              },
              { keys: "?", desc: "Toggle this shortcuts panel" },
            ].map(({ keys, desc }) => (
              <div
                key={keys}
                className="flex items-center justify-between"
              >
                <span className="text-sm text-muted-foreground">
                  {desc}
                </span>
                <kbd className="px-2 py-1 rounded bg-muted border text-xs font-mono shrink-0 ml-4">
                  {keys}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Upload;
