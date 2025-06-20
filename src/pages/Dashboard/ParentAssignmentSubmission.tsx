import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { isParent } from "@/types";
import { Assignment, AssignmentSubmission } from "@/types";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, AlertTriangle, CheckCircle2, Clock, ChevronLeft } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { UserProfile } from "@/context/AuthContext";

// Mock students for the parent
const MOCK_CHILDREN: UserProfile[] = [
  {
    id: "student-1",
    email: "manka.c@example.com",
    role: "student",
    full_name: "Manka'a Che",
    school: "Springfield Elementary",
    created_at: "2024-01-15T10:30:00Z",
    teacher_id: "teacher-1",
    parent_ids: ["parent-1"],
    grade_level: "Primary 5",
    subjects: ["Math", "Science"]
  },
  {
    id: "student-2",
    email: "nfor.j@example.com",
    role: "student",
    full_name: "Nfor Junior",
    school: "Springfield Elementary",
    created_at: "2024-02-10T14:45:00Z",
    teacher_id: "teacher-1",
    parent_ids: ["parent-1"],
    grade_level: "Primary 3",
    subjects: ["Math", "English"]
  }
];

// Mock assignments for the children
const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: "assign-1",
    title: "Addition and Subtraction Practice",
    description: "Complete worksheet pages 10-12 with practice problems for addition and subtraction with regrouping.",
    due_date: "2025-06-05T23:59:59Z",
    created_at: "2025-05-25T14:30:00Z",
    teacher_id: "teacher-1",
    subject: "Math",
    grade_level: "Primary 5"
  },
  {
    id: "assign-2",
    title: "Multiplication Tables Quiz",
    description: "Study multiplication tables 1-12 and complete the online quiz.",
    due_date: "2025-06-10T23:59:59Z",
    created_at: "2025-05-28T10:15:00Z",
    teacher_id: "teacher-1",
    subject: "Math",
    grade_level: "Primary 5"
  },
  {
    id: "assign-3",
    title: "Basic Addition Worksheets",
    description: "Complete the basic addition worksheets with numbers 1-20.",
    due_date: "2025-06-12T23:59:59Z",
    created_at: "2025-05-27T11:30:00Z",
    teacher_id: "teacher-1",
    subject: "Math",
    grade_level: "Primary 3"
  }
];

// Mock submissions that have already been made
const MOCK_SUBMISSIONS: AssignmentSubmission[] = [
  {
    id: "submission-1",
    assignment_id: "assign-1",
    student_id: "student-1",
    submitted_at: "2025-06-01T15:45:00Z",
    status: "submitted",
    submission_file_url: "/uploads/student-1/assignment-1.pdf",
    student_notes: "Manka'a had some difficulty with regrouping in subtraction problems."
  }
];

const ParentAssignmentSubmission = () => {
  const { profile } = useAuth();
  const [children, setChildren] = useState<UserProfile[]>(MOCK_CHILDREN);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [assignments] = useState<Assignment[]>(MOCK_ASSIGNMENTS);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>(MOCK_SUBMISSIONS);
  const [activeTab, setActiveTab] = useState("pending");
  const [submittingAssignment, setSubmittingAssignment] = useState<Assignment | null>(null);
  const [studentNotes, setStudentNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Set default selected child if none is selected
  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);
  
  // Check if user is a parent
  if (!isParent(profile)) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Only parents can access this page.</p>
      </div>
    );
  }
  
  // Get current selected child
  const selectedChild = children.find(child => child.id === selectedChildId);
  
  // Get assignments for the selected child
  const childAssignments = selectedChild 
    ? assignments.filter(assignment => assignment.grade_level === selectedChild.grade_level)
    : [];
  
  // Get IDs of already submitted assignments for this child
  const submittedAssignmentIds = submissions
    .filter(sub => sub.student_id === selectedChildId)
    .map(sub => sub.assignment_id);
  
  // Filter assignments based on tab selection
  const filteredAssignments = childAssignments.filter(assignment => {
    const hasSubmitted = submittedAssignmentIds.includes(assignment.id);
    const isPastDue = new Date(assignment.due_date) < new Date();
    
    if (activeTab === "pending") {
      return !hasSubmitted && !isPastDue;
    } else if (activeTab === "submitted") {
      return hasSubmitted;
    } else if (activeTab === "late") {
      return !hasSubmitted && isPastDue;
    } else if (activeTab === "all") {
      return true;
    }
    
    return false;
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files[0]) {
      setSelectedFile(files[0]);
    }
  };
  
  const simulateUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate progress updates
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        const newProgress = prev + 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            submitAssignment();
          }, 500);
        }
        return newProgress;
      });
    }, 300);
  };
  
  const submitAssignment = () => {
    if (!submittingAssignment || !selectedFile || !selectedChildId) {
      toast({
        title: "Missing Information",
        description: "Please select a file to upload.",
        variant: "destructive"
      });
      return;
    }

    // Create new submission
    const newSubmission: AssignmentSubmission = {
      id: `submission-${Date.now()}`,
      assignment_id: submittingAssignment.id,
      student_id: selectedChildId,
      submitted_at: new Date().toISOString(),
      status: "submitted",
      submission_file_url: `/uploads/${selectedChildId}/${selectedFile.name}`,
      student_notes: studentNotes
    };
    
    // Add to submissions
    setSubmissions([...submissions, newSubmission]);
    
    // Reset state
    setSubmittingAssignment(null);
    setStudentNotes("");
    setSelectedFile(null);
    setIsUploading(false);
    setUploadProgress(0);
    
    toast({
      title: "Assignment Submitted",
      description: `Assignment has been submitted for ${selectedChild?.full_name}.`,
    });
  };
  
  // Get submission for a given assignment
  const getSubmissionForAssignment = (assignmentId: string) => {
    return submissions.find(sub => 
      sub.assignment_id === assignmentId && 
      sub.student_id === selectedChildId
    );
  };
  
  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <a href="/dashboard">
            <ChevronLeft className="h-5 w-5" />
          </a>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Child Assignments</h1>
      </div>
      
      {/* Child Selector */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
        <div className="flex-1">
          <p className="text-muted-foreground mb-2">
            Select a child to view and submit their assignments:
          </p>
          <Select
            value={selectedChildId || ""}
            onValueChange={setSelectedChildId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a child" />
            </SelectTrigger>
            <SelectContent>
              {children.map(child => (
                <SelectItem key={child.id} value={child.id}>
                  <div className="flex items-center">
                    <span>{child.full_name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({child.grade_level})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {selectedChild && (
          <Card className="w-full sm:w-auto">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-mama-purple text-white">
                    {selectedChild.full_name?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">{selectedChild.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedChild.grade_level}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {!selectedChild ? (
        <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg">
          <p className="text-muted-foreground">Please select a child to view their assignments</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-md gap-1 sm:gap-0">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="submitted">Submitted</TabsTrigger>
              <TabsTrigger value="late">Late</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
            
            {/* Assignment list */}
            <TabsContent value={activeTab} className="pt-4">
              {filteredAssignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg">
                  <p className="text-muted-foreground">No assignments found in this category</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredAssignments.map((assignment) => {
                    const submission = getSubmissionForAssignment(assignment.id);
                    const isPastDue = new Date(assignment.due_date) < new Date();
                    
                    return (
                      <Card key={assignment.id}>
                        <CardHeader>
                          <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                            <div>
                              <CardTitle className="text-base sm:text-lg">{assignment.title}</CardTitle>
                              <CardDescription>
                                Due: {format(new Date(assignment.due_date), "PPP")}
                              </CardDescription>
                            </div>
                            <div className="flex flex-row sm:flex-col items-start sm:items-end gap-1">
                              <Badge>{assignment.subject}</Badge>
                              {submission ? (
                                <Badge variant="outline" className="bg-green-50">
                                  Submitted
                                </Badge>
                              ) : isPastDue ? (
                                <Badge variant="outline" className="bg-red-50 text-red-500">
                                  Past Due
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-yellow-50">
                                  Pending
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm mb-4">{assignment.description}</p>
                          
                          {submission ? (
                            <Alert className="bg-green-50 border-green-200">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <AlertTitle>Submitted</AlertTitle>
                              <AlertDescription>
                                You submitted this assignment on {format(new Date(submission.submitted_at), "PPP")}
                              </AlertDescription>
                            </Alert>
                          ) : isPastDue ? (
                            <Alert className="bg-red-50 border-red-200">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                              <AlertTitle>Past Due</AlertTitle>
                              <AlertDescription>
                                This assignment is past due. Submit as soon as possible.
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <Alert className="bg-yellow-50 border-yellow-200">
                              <Clock className="h-4 w-4 text-yellow-500" />
                              <AlertTitle>Pending</AlertTitle>
                              <AlertDescription>
                                {Math.ceil(
                                  (new Date(assignment.due_date).getTime() - new Date().getTime()) / 
                                  (1000 * 60 * 60 * 24)
                                )} days remaining to submit
                              </AlertDescription>
                            </Alert>
                          )}
                        </CardContent>
                        <CardFooter className="flex justify-end">
                          {submission ? (
                            <Button variant="outline" size="sm" asChild>
                              <a href={submission.submission_file_url} target="_blank" rel="noopener noreferrer">
                                View Submission
                              </a>
                            </Button>
                          ) : (
                            <Dialog 
                              open={submittingAssignment?.id === assignment.id} 
                              onOpenChange={(open) => {
                                if (open) {
                                  setSubmittingAssignment(assignment);
                                } else {
                                  setSubmittingAssignment(null);
                                  setStudentNotes("");
                                  setSelectedFile(null);
                                  setIsUploading(false);
                                  setUploadProgress(0);
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button>
                                  <Upload className="mr-2 h-4 w-4" />
                                  Submit Work
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[600px]">
                                <DialogHeader>
                                  <DialogTitle>Submit Assignment for {selectedChild.full_name}</DialogTitle>
                                  <DialogDescription>
                                    Upload your child's completed work for {assignment.title}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                  <div className="grid gap-2">
                                    <label className="text-sm font-medium">Upload Work</label>
                                    <div className="border-2 border-dashed p-6 rounded-md text-center">
                                      <input
                                        type="file"
                                        id="file-upload"
                                        className="hidden"
                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                        onChange={handleFileChange}
                                      />
                                      <label 
                                        htmlFor="file-upload" 
                                        className="flex flex-col items-center justify-center cursor-pointer"
                                      >
                                        <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                                        <p className="text-sm font-medium">
                                          {selectedFile ? selectedFile.name : "Click to upload or drag and drop"}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          PDF, Word, or image files (max 10MB)
                                        </p>
                                      </label>
                                    </div>
                                  </div>
                                  {isUploading && (
                                    <div className="space-y-2">
                                      <div className="flex justify-between text-sm">
                                        <span>Uploading...</span>
                                        <span>{uploadProgress}%</span>
                                      </div>
                                      <Progress value={uploadProgress} />
                                    </div>
                                  )}
                                  <div className="grid gap-2">
                                    <label className="text-sm font-medium">Notes for Teacher (Optional)</label>
                                    <Textarea 
                                      placeholder="Add any comments about your child's work or difficulties they experienced..."
                                      value={studentNotes}
                                      onChange={(e) => setStudentNotes(e.target.value)}
                                      rows={3}
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button 
                                    variant="outline" 
                                    onClick={() => setSubmittingAssignment(null)}
                                    disabled={isUploading}
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    onClick={simulateUpload}
                                    disabled={!selectedFile || isUploading}
                                  >
                                    {isUploading ? "Uploading..." : "Submit Assignment"}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default ParentAssignmentSubmission;
