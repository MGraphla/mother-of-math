import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { isStudent } from "@/types";
import { Assignment, AssignmentSubmission } from "@/types";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfile } from "@/context/AuthContext";
import { Upload, AlertTriangle, CheckCircle2, Clock, GraduationCap, UserCircle2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";

// Mock student data
const MOCK_STUDENT: UserProfile = {
  id: "student-1",
  email: "manka.c@example.com",
  role: "student",
  full_name: "Manka'a Che",
  school: "Springfield Elementary",
  created_at: "2024-01-15T10:30:00Z",
  teacher_id: "teacher-1",
  grade_level: "Primary 5",
  subjects: ["Math", "Science"]
};

// Mock teacher data
const MOCK_TEACHER: UserProfile = {
  id: "teacher-1",
  email: "teacher@example.com",
  role: "teacher",
  full_name: "Ms. Thompson",
  school: "Springfield Elementary",
  created_at: "2023-08-15T09:00:00Z"
};

// Mock assignments for the student
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
    title: "Science Project: Plants",
    description: "Create a poster showing the parts of a plant and their functions.",
    due_date: "2025-06-15T23:59:59Z",
    created_at: "2025-05-29T09:00:00Z",
    teacher_id: "teacher-1",
    subject: "Science",
    grade_level: "Primary 5"
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
    student_notes: "I had some difficulty with regrouping in subtraction problems."
  }
];

// Mock feedback from teacher
const MOCK_FEEDBACK = [
  {
    id: "feedback-1",
    submission_id: "submission-1",
    created_at: "2025-06-02T10:30:00Z",
    teacher_id: "teacher-1",
    content: "Good work, Manka'a! I noticed you had some trouble with regrouping in problems 3 and 5. Let's review this together in class."
  }
];

const StudentDashboard = () => {
  const { profile } = useAuth();
  const [studentInfo, setStudentInfo] = useState<UserProfile>(MOCK_STUDENT);
  const [teacherInfo, setTeacherInfo] = useState<UserProfile>(MOCK_TEACHER);
  const [assignments, setAssignments] = useState<Assignment[]>(MOCK_ASSIGNMENTS);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>(MOCK_SUBMISSIONS);
  const [feedback, setFeedback] = useState(MOCK_FEEDBACK);
  const [activeTab, setActiveTab] = useState("assignments");
  
  // Assignment submission state
  const [submittingAssignment, setSubmittingAssignment] = useState<Assignment | null>(null);
  const [studentNotes, setStudentNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parentHelping, setParentHelping] = useState(false);
  
  // Get IDs of already submitted assignments
  const submittedAssignmentIds = submissions.map(sub => sub.assignment_id);
  
  // Filter assignments based on status
  const pendingAssignments = assignments.filter(assignment => 
    !submittedAssignmentIds.includes(assignment.id) && 
    new Date(assignment.due_date) > new Date()
  );
  
  const submittedAssignments = assignments.filter(assignment => 
    submittedAssignmentIds.includes(assignment.id)
  );
  
  const lateAssignments = assignments.filter(assignment => 
    !submittedAssignmentIds.includes(assignment.id) && 
    new Date(assignment.due_date) <= new Date()
  );
  
  // Check if student has submissions with feedback
  const hasSubmissionsWithFeedback = submissions.some(submission => 
    feedback.some(fb => fb.submission_id === submission.id)
  );
  
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
    if (!submittingAssignment || !selectedFile) {
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
      student_id: studentInfo.id,
      submitted_at: new Date().toISOString(),
      status: "submitted",
      submission_file_url: `/uploads/${studentInfo.id}/${selectedFile.name}`,
      student_notes: parentHelping 
        ? `[Submitted with parent help] ${studentNotes}` 
        : studentNotes
    };
    
    // Add to submissions
    setSubmissions([...submissions, newSubmission]);
    
    // Reset state
    setSubmittingAssignment(null);
    setStudentNotes("");
    setSelectedFile(null);
    setIsUploading(false);
    setUploadProgress(0);
    setParentHelping(false);
    
    toast({
      title: "Assignment Submitted",
      description: "Your work has been submitted successfully.",
    });
  };
  
  // Get submission for a given assignment
  const getSubmissionForAssignment = (assignmentId: string) => {
    return submissions.find(sub => sub.assignment_id === assignmentId);
  };
  
  // Get feedback for a submission
  const getFeedbackForSubmission = (submissionId: string) => {
    return feedback.filter(fb => fb.submission_id === submissionId);
  };
  
  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Dashboard</h1>
          <p className="text-muted-foreground">
            View your assignments and submit your work
          </p>
        </div>
      </div>
      
      {/* Student and Teacher Info */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Student Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-mama-purple text-white text-xl">
                  {studentInfo.full_name?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h3 className="font-medium text-lg">{studentInfo.full_name}</h3>
                <p className="text-sm text-muted-foreground">{studentInfo.email}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge>{studentInfo.grade_level}</Badge>
                  {studentInfo.subjects?.map(subject => (
                    <Badge key={subject} variant="outline">{subject}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Teacher Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-green-600 text-white text-xl">
                  {teacherInfo.full_name?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h3 className="font-medium text-lg">{teacherInfo.full_name}</h3>
                <p className="text-sm text-muted-foreground">{teacherInfo.email}</p>
                <p className="text-sm">{teacherInfo.school}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 max-w-md gap-1 sm:gap-0">
          <TabsTrigger value="assignments">
            <GraduationCap className="h-4 w-4 mr-2" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="submissions">
            <Upload className="h-4 w-4 mr-2" />
            Submissions
          </TabsTrigger>
          <TabsTrigger value="feedback">
            <UserCircle2 className="h-4 w-4 mr-2" />
            Teacher Feedback
          </TabsTrigger>
        </TabsList>
        
        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4 pt-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Pending Assignments</h2>
            
            {pendingAssignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg">
                <p className="text-muted-foreground">No pending assignments</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {pendingAssignments.map((assignment) => (
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
                          <Badge variant="outline" className="bg-yellow-50">
                            Pending
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm mb-4">{assignment.description}</p>
                      
                      <Alert className="bg-yellow-50 border-yellow-200">
                        <Clock className="h-4 w-4 text-yellow-500" />
                        <AlertTitle>Due Soon</AlertTitle>
                        <AlertDescription>
                          {Math.ceil(
                            (new Date(assignment.due_date).getTime() - new Date().getTime()) / 
                            (1000 * 60 * 60 * 24)
                          )} days remaining to submit
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                    <CardFooter className="flex justify-end">
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
                            setParentHelping(false);
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
                            <DialogTitle>Submit Assignment: {assignment.title}</DialogTitle>
                            <DialogDescription>
                              Upload your completed work for this assignment.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="parentHelp"
                                checked={parentHelping}
                                onChange={(e) => setParentHelping(e.target.checked)}
                                className="rounded border-gray-300"
                              />
                              <label htmlFor="parentHelp" className="text-sm font-medium">
                                Parent is helping with this submission
                              </label>
                            </div>
                            
                            <div className="grid gap-2">
                              <label className="text-sm font-medium">Upload Your Work</label>
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
                                placeholder="Add any comments or questions about your work..."
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
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </div>
          
          {lateAssignments.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-red-600">Late Assignments</h2>
              <div className="grid gap-4">
                {lateAssignments.map((assignment) => (
                  <Card key={assignment.id} className="border-red-200">
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
                          <Badge variant="outline" className="bg-red-50 text-red-500">
                            Past Due
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm mb-4">{assignment.description}</p>
                      
                      <Alert className="bg-red-50 border-red-200">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <AlertTitle>Past Due</AlertTitle>
                        <AlertDescription>
                          This assignment is overdue by {Math.ceil(
                            (new Date().getTime() - new Date(assignment.due_date).getTime()) / 
                            (1000 * 60 * 60 * 24)
                          )} days. Submit as soon as possible.
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                    <CardFooter className="flex justify-end">
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
                            setParentHelping(false);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button>
                            <Upload className="mr-2 h-4 w-4" />
                            Submit Late Work
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px]">
                          {/* Same content as above dialog */}
                          <DialogHeader>
                            <DialogTitle>Submit Assignment: {assignment.title}</DialogTitle>
                            <DialogDescription>
                              Upload your completed work for this assignment.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="parentHelp"
                                checked={parentHelping}
                                onChange={(e) => setParentHelping(e.target.checked)}
                                className="rounded border-gray-300"
                              />
                              <label htmlFor="parentHelp" className="text-sm font-medium">
                                Parent is helping with this submission
                              </label>
                            </div>
                            
                            <div className="grid gap-2">
                              <label className="text-sm font-medium">Upload Your Work</label>
                              <div className="border-2 border-dashed p-6 rounded-md text-center">
                                <input
                                  type="file"
                                  id="file-upload-late"
                                  className="hidden"
                                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                  onChange={handleFileChange}
                                />
                                <label 
                                  htmlFor="file-upload-late" 
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
                                placeholder="Add any comments or questions about your work..."
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
                              {isUploading ? "Uploading..." : "Submit Late Assignment"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
        
        {/* Submissions Tab */}
        <TabsContent value="submissions" className="space-y-4 pt-4">
          {submittedAssignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg">
              <p className="text-muted-foreground">No submissions yet</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {submittedAssignments.map((assignment) => {
                const submission = getSubmissionForAssignment(assignment.id);
                const submissionFeedback = submission ? getFeedbackForSubmission(submission.id) : [];
                
                return (
                  <Card key={assignment.id}>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                        <div>
                          <CardTitle className="text-base sm:text-lg">{assignment.title}</CardTitle>
                          <CardDescription>
                            Submitted: {submission && format(new Date(submission.submitted_at), "PPP")}
                          </CardDescription>
                        </div>
                        <div className="flex flex-row sm:flex-col items-start sm:items-end gap-1">
                          <Badge>{assignment.subject}</Badge>
                          <Badge variant="outline" className="bg-green-50">
                            Submitted
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm mb-4">{assignment.description}</p>
                      
                      <Alert className="bg-green-50 border-green-200">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <AlertTitle>Submission Complete</AlertTitle>
                        <AlertDescription>
                          Your work has been submitted. {submissionFeedback.length > 0 
                            ? "Your teacher has provided feedback."
                            : "Waiting for teacher feedback."}
                        </AlertDescription>
                      </Alert>
                      
                      {submission?.student_notes && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-md">
                          <h4 className="text-sm font-medium mb-1">Your Notes:</h4>
                          <p className="text-sm text-muted-foreground">{submission.student_notes}</p>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-end">
                      <Button variant="outline" size="sm" asChild>
                        <a href={submission?.submission_file_url || "#"} target="_blank" rel="noopener noreferrer">
                          View Submission
                        </a>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        
        {/* Feedback Tab */}
        <TabsContent value="feedback" className="space-y-4 pt-4">
          {!hasSubmissionsWithFeedback ? (
            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg">
              <p className="text-muted-foreground">No feedback yet</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {submissions.map(submission => {
                const assignment = assignments.find(a => a.id === submission.assignment_id);
                const submissionFeedback = getFeedbackForSubmission(submission.id);
                
                if (submissionFeedback.length === 0) return null;
                
                return (
                  <Card key={submission.id}>
                    <CardHeader>
                      <CardTitle className="text-base sm:text-lg">
                        {assignment?.title || "Unknown Assignment"}
                      </CardTitle>
                      <CardDescription>
                        Feedback received: {format(new Date(submissionFeedback[0].created_at), "PPP")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {submissionFeedback.map(fb => (
                          <div key={fb.id} className="p-4 bg-blue-50 rounded-md border border-blue-200">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-green-600 text-white">
                                  {teacherInfo.full_name?.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="text-sm font-medium">{teacherInfo.full_name}</h4>
                                <p className="text-sm mt-1">{fb.content}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                      <Button variant="outline" size="sm" asChild>
                        <a href={submission.submission_file_url} target="_blank" rel="noopener noreferrer">
                          View My Submission
                        </a>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentDashboard;
