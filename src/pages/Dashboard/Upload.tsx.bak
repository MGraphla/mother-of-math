import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Upload as UploadIcon, 
  File, 
  X, 
  Check, 
  AlertCircle, 
  Brain, 
  Download, 
  Trash2, 
  Bug, 
  Lightbulb,
  Filter,
  Search,
  SortAsc,
  SortDesc,
  FileText,
  Image,
  FileSpreadsheet,
  FileArchive
} from "lucide-react";
import { fileToBase64, sendMessage } from "@/services/api";
import ReactMarkdown from 'react-markdown';
import AnimatedBorder from '@/components/ui/AnimatedBorder';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ChatResponse {
  text: string;
  errorType?: string;
  remediation?: string;
}

interface UploadedFile {
  id: string;
  file: File;
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
  studentName?: string;
  subject?: string;
  grade?: string;
}

const Upload = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");

  const extractErrorType = (text: string | ChatResponse): string | undefined => {
    if (typeof text === 'object' && text.errorType) {
      return text.errorType;
    }
    if (typeof text === 'string') {
      const errorMatch = text.match(/Error Type:?\s*([^\n]+)/i);
      return errorMatch ? errorMatch[1].trim() : undefined;
    }
    return undefined;
  };

  const extractRemediation = (text: string | ChatResponse): string | undefined => {
    if (typeof text === 'object' && text.remediation) {
      return text.remediation;
    }
    if (typeof text === 'string') {
      const remediationMatch = text.match(/Remediation:?\s*([^\n]+)/i);
      return remediationMatch ? remediationMatch[1].trim() : undefined;
    }
    return undefined;
  };

  const analyzeFile = async (fileObj: UploadedFile) => {
    try {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileObj.id ? { ...f, status: "analyzing" } : f
        )
      );

      const base64 = await fileToBase64(fileObj.file);
      const response = await sendMessage(
        `Analyze the student's math work. Your response must be direct and concise. Follow this format exactly:
Analysis: [Provide a brief analysis, maximum 4 lines.]
- Error Type: [Categorize the error. If none, write 'None Found'. Maximum 4 lines.]
- Grade of student's work in percentage. maximum 4 lines.
- Remediation: [Suggest a specific remediation step. Maximum 4 lines.]
Do not add any extra text, introductions, or explanations.`,
        base64
      );

      // Handle the response properly
      const responseText = typeof response === 'string' ? response : response.text;
      const analysis = {
        text: responseText,
        errorType: extractErrorType(response),
        remediation: extractRemediation(response)
      };

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileObj.id
            ? {
                ...f,
                status: "success",
                analysis,
                uploadDate: new Date()
              }
            : f
        )
      );

      toast.success("Analysis completed successfully");
    } catch (error) {
      console.error("Analysis error:", error);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileObj.id
            ? { ...f, status: "error", error: "Analysis failed" }
            : f
        )
      );
      toast.error("Failed to analyze student work");
    }
  };

  const analyzeAllFiles = async () => {
    const filesToAnalyze = files.filter(
      (f) => f.status === "success" && !f.analysis
    );
    
    if (filesToAnalyze.length === 0) {
      toast.info("No files need analysis");
      return;
    }

    for (const file of filesToAnalyze) {
      await analyzeFile(file);
    }
  };

  const downloadAnalysis = (file: UploadedFile) => {
    if (!file.analysis) return;

    const content = `
Student Work Analysis
====================
File: ${file.file.name}

Analysis:
${file.analysis.text}

${file.analysis.errorType ? `Error Type: ${file.analysis.errorType}` : ''}
${file.analysis.remediation ? `Remediation: ${file.analysis.remediation}` : ''}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.file.name}-analysis.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearAllFiles = () => {
    setFiles([]);
    setSelectedFiles([]);
    toast.success("All files cleared");
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setIsUploading(true);
    const newFiles = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      status: "uploading" as const,
      uploadDate: new Date()
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    // Process each file
    newFiles.forEach(async (fileObj) => {
      try {
        // Convert to base64 for preview if it's an image
        if (fileObj.file.type.startsWith("image/")) {
          const base64 = await fileToBase64(fileObj.file);
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileObj.id ? { ...f, preview: base64 } : f
            )
          );
        }

        // Simulate upload progress
        for (let i = 0; i <= 100; i += 10) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileObj.id ? { ...f, progress: i } : f
            )
          );
        }

        // Mark as success
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileObj.id ? { ...f, status: "success" } : f
          )
        );

        toast.success(`Successfully uploaded ${fileObj.file.name}`);
        
        // Start AI analysis
        await analyzeFile(fileObj);
      } catch (error) {
        console.error("Upload error:", error);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileObj.id
              ? { ...f, status: "error", error: "Upload failed" }
              : f
          )
        );
        toast.error(`Failed to upload ${fileObj.file.name}`);
      }
    });
    setIsUploading(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/plain": [".txt"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"]
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setSelectedFiles((prev) => prev.filter((fileId) => fileId !== id));
  };

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: (custom: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: custom * 0.1, duration: 0.5 },
    }),
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <Image className="h-6 w-6" />;
    if (file.type === "application/pdf") return <FileText className="h-6 w-6" />;
    if (file.type.includes("spreadsheet") || file.type.includes("excel")) return <FileSpreadsheet className="h-6 w-6" />;
    return <FileArchive className="h-6 w-6" />;
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         file.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         file.subject?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || file.status === filterStatus;
    const matchesTab = activeTab === "all" || 
                      (activeTab === "analyzed" && file.status === "success" && file.analysis) ||
                      (activeTab === "pending" && (file.status === "uploading" || file.status === "analyzing")) ||
                      (activeTab === "errors" && file.status === "error");
    return matchesSearch && matchesStatus && matchesTab;
  });

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    const dateA = new Date(a.uploadDate).getTime();
    const dateB = new Date(b.uploadDate).getTime();
    return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-6">
        <div className="flex-grow">
          <h1 className="text-3xl font-bold tracking-tight">Student Work Upload</h1>
          <p className="text-muted-foreground mt-1">Upload and analyze student work for detailed feedback and insights</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button 
            variant="outline" 
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="flex items-center gap-2"
          >
            {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            Sort by Date
          </Button>
          <Button 
            variant="outline" 
            onClick={clearAllFiles}
            className="flex items-center gap-2"
            disabled={files.length === 0}
          >
            <Trash2 className="h-4 w-4" />
            Clear All
          </Button>
        </div>
      </div>

      <Tabs 
        defaultValue="all" 
        className="space-y-4"
        onValueChange={setActiveTab}
      >
        <TabsList className="flex flex-wrap h-auto sm:grid sm:w-full sm:grid-cols-4">
          <TabsTrigger value="all">All Files</TabsTrigger>
          <TabsTrigger value="analyzed">Analyzed</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <AnimatedBorder>
            <div
              {...getRootProps()}
              className={cn(
                "relative p-8 text-center cursor-pointer transition-colors",
                isDragActive && "bg-green-50/50",
                isUploading && "opacity-50 cursor-not-allowed"
              )}
            >
              <input {...getInputProps()} disabled={isUploading} />
              <div className="flex flex-col items-center justify-center">
                <UploadIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">
                  {isDragActive ? "Drop files here" : "Drag & drop files here"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isUploading ? "Uploading..." : "Click to select files"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Supports images, PDFs, and documents up to 10MB.</p>
              </div>
            </div>
          </AnimatedBorder>

          <div className="flex flex-col md:flex-row items-center gap-4 my-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search files by name, student, or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="analyzing">Analyzing</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            {sortedFiles.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  {searchQuery || filterStatus !== "all" ? (
                    "No files match your search criteria"
                  ) : (
                    "No files uploaded yet. Drag and drop files to get started."
                  )}
                </CardContent>
              </Card>
            ) : (
              sortedFiles.map((file) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="relative"
                >
                  <div className="border rounded-lg p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-green-100/50">
                        {file.preview ? (
                          <img
                            src={file.preview}
                            alt={file.file.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          getFileIcon(file.file)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium truncate">{file.file.name}</h3>
                            <span className="text-sm text-muted-foreground">
                              {new Date(file.uploadDate).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={
                                file.status === "success" ? "default" : 
                                file.status === "error" ? "destructive" : 
                                file.status === "analyzing" ? "secondary" : "outline"
                              }
                            >
                              {file.status}
                            </Badge>
                            {file.status === "success" && file.analysis && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => downloadAnalysis(file)}
                                className="text-green-600 hover:text-green-700"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFile(file.id)}
                              className="text-destructive hover:text-destructive/80"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Progress value={file.progress} className="h-2" />
                          
                          {file.status === "success" && file.analysis && (
                            <div className="mt-4 space-y-2">
                              <div className="flex items-center gap-2">
                                <Brain className="h-4 w-4 text-green-600" />
                                <span className="font-medium">Analysis</span>
                              </div>
                              <div className="prose prose-sm max-w-none">
                                <ReactMarkdown>{file.analysis.text}</ReactMarkdown>
                              </div>
                              {file.analysis.errorType && (
                                <div className="flex items-center gap-2 text-destructive">
                                  <Bug className="h-4 w-4" />
                                  <span>{file.analysis.errorType}</span>
                                </div>
                              )}
                              {file.analysis.remediation && (
                                <div className="flex items-center gap-2 text-green-600">
                                  <Lightbulb className="h-4 w-4" />
                                  <span>{file.analysis.remediation}</span>
                                </div>
                              )}
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
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Upload; 