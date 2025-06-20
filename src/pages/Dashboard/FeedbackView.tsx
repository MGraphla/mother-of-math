import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isTeacher, PRIMARY_GRADE_LEVELS } from "@/types";
import { Assignment, AssignmentSubmission, FeedbackItem } from "@/types";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileText, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { UserProfile } from "@/context/AuthContext";

// Mock student
const MOCK_STUDENT: UserProfile = {
  id: "student-1",
  email: "manka.c@example.com",
  role: "student",
  full_name: "Manka'a Che",
  school: "Springfield Elementary",
  created_at: "2024-01-15T10:30:00Z",
  teacher_id: "mock-user-id",
  grade_level: "Primary 5",
  subjects: ["Math", "Science"]
};

// Mock assignment
const MOCK_ASSIGNMENT: Assignment = {
  id: "assign-1",
  title: "Addition and Subtraction Practice",
  description: "Complete worksheet pages 10-12 with practice problems for addition and subtraction with regrouping.",
  due_date: "2025-06-05T23:59:59Z",
  created_at: "2025-05-25T14:30:00Z",
  teacher_id: "mock-user-id",
  subject: "Math",
  grade_level: "Primary 5"
};

// Mock submission
const MOCK_SUBMISSION: AssignmentSubmission = {
  score: null, // Initialize score as null
  id: "submission-1",
  assignment_id: "assign-1",
  student_id: "student-1",
  submitted_at: "2025-06-01T15:45:00Z",
  status: "submitted",
  submission_file_url: "/uploads/student-1/assignment-1.pdf",
  student_notes: "I had some difficulty with regrouping in subtraction problems."
};

// Mock feedback items
const MOCK_FEEDBACK: FeedbackItem[] = [
  {
    id: "feedback-1",
    submission_id: "submission-1",
    created_at: "2025-06-02T09:30:00Z",
    error_description: "Incorrect carrying in addition problem #3",
    correction: "Remember to carry the 1 when the sum of digits exceeds 9.",
    location: "Page 1, problem 3",
    error_type: "calculation",
    severity: 2
  },
  {
    id: "feedback-2",
    submission_id: "submission-1",
    created_at: "2025-06-02T09:35:00Z",
    error_description: "Confusion with place value in problem #7",
    correction: "When subtracting, make sure you're aligning the numbers by their place values.",
    location: "Page 2, problem 7",
    error_type: "concept",
    severity: 3
  }
];

// Common error types for math
const ERROR_TYPES = [
  "calculation",
  "concept",
  "procedure",
  "notation",
  "logical",
  "arithmetic",
  "other"
];

const FeedbackView = () => {
  const { profile } = useAuth();
  const [student] = useState<UserProfile>(MOCK_STUDENT);
  const [assignment] = useState<Assignment>(MOCK_ASSIGNMENT);
  const [submission] = useState<AssignmentSubmission>(MOCK_SUBMISSION);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>(MOCK_FEEDBACK);
  
  const [addingFeedback, setAddingFeedback] = useState(false);
  const [newFeedback, setNewFeedback] = useState({
    error_description: "",
    correction: "",
    location: "",
    error_type: "calculation",
    severity: 2
  });
  
  const [activeTab, setActiveTab] = useState<"feedback" | "preview" | "notes">("feedback");
  const [currentScore, setCurrentScore] = useState<number | string>(submission.score?.toString() || ""); // Use string for input, can be number | null in type
  
  // Check if user is a teacher
  if (!isTeacher(profile)) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Only teachers can access this page.</p>
      </div>
    );
  }

  const handleAddFeedback = () => {
    // Validate form
    if (!newFeedback.error_description || !newFeedback.correction) {
      toast({
        title: "Missing Information",
        description: "Please provide both an error description and a correction.",
        variant: "destructive"
      });
      return;
    }

    // Create new feedback item
    const newFeedbackItem: FeedbackItem = {
      id: `feedback-${Date.now()}`,
      submission_id: submission.id,
      created_at: new Date().toISOString(),
      error_description: newFeedback.error_description,
      correction: newFeedback.correction,
      location: newFeedback.location,
      error_type: newFeedback.error_type,
      severity: newFeedback.severity
    };
    
    // Add to list
    setFeedbackItems([...feedbackItems, newFeedbackItem]);
    
    // Reset form
    setNewFeedback({
      error_description: "",
      correction: "",
      location: "",
      error_type: "calculation",
      severity: 2
    });
    
    setAddingFeedback(false);
    
    toast({
      title: "Feedback Added",
      description: "Your feedback has been added to this submission."
    });
  };
  
  const deleteFeedback = (feedbackId: string) => {
    setFeedbackItems(feedbackItems.filter(item => item.id !== feedbackId));
    toast({
      title: "Feedback Removed",
      description: "The feedback item has been deleted."
    });
  };
  
  const getErrorSeverityLabel = (severity: number): string => {
    switch (severity) {
      case 1: return "Minor";
      case 2: return "Low";
      case 3: return "Medium";
      case 4: return "High";
      case 5: return "Critical";
      default: return "Unknown";
    }
  };
  
  const getErrorSeverityColor = (severity: number): string => {
    switch (severity) {
      case 1: return "bg-blue-50 text-blue-700 border-blue-200";
      case 2: return "bg-green-50 text-green-700 border-green-200";
      case 3: return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case 4: return "bg-orange-50 text-orange-700 border-orange-200";
      case 5: return "bg-red-50 text-red-700 border-red-200";
      default: return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };
  
  const returnToStudent = () => {
    // TODO: API call to update submission with feedback, score, and status
    const updatedSubmission = {
      ...submission,
      status: 'graded' as 'graded', // Type assertion
      score: currentScore !== "" ? parseFloat(currentScore) : null,
    };
    // For now, just log and toast
    console.log("Returning to student with feedback and score:", feedbackItems, updatedSubmission);
    // Update the mock submission state if you want to see changes reflected in UI (not done here as it's complex with mock data)
    // setSubmission(updatedSubmission); 
    toast({
      title: "Feedback Returned",
      description: `Feedback has been returned to ${student.full_name}.`
    });
  };
  
  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Student Submission</h1>
        <p className="text-muted-foreground">
          Provide feedback on student work
        </p>
      </div>
      
      {/* Student and assignment info card */}
      <div className="flex flex-col md:flex-row gap-4">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Student Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src="" />
                <AvatarFallback className="bg-mama-purple text-white">
                  {student.full_name?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{student.full_name}</p>
                <p className="text-sm text-muted-foreground">{student.email}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Level:</span>
                <span className="text-sm">{student.grade_level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Subjects:</span>
                <div className="flex flex-wrap justify-end gap-1">
                  {student.subjects?.map((subject) => (
                    <Badge key={subject} variant="outline">{subject}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Assignment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <h3 className="font-medium">{assignment.title}</h3>
                <p className="text-sm text-muted-foreground">{assignment.description}</p>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Subject:</span>
                <Badge>{assignment.subject}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Due Date:</span>
                <span className="text-sm">{format(new Date(assignment.due_date), "PPP")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Submitted:</span>
                <span className="text-sm">{format(new Date(submission.submitted_at), "PPP")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge variant="outline" className="capitalize">{submission.status}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs for different views */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="preview">View Submission</TabsTrigger>
          <TabsTrigger value="notes">Student Notes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="feedback" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <h2 className="text-xl font-semibold">Error Feedback</h2>
            <Dialog open={addingFeedback} onOpenChange={setAddingFeedback}>
              <DialogTrigger asChild>
                <Button>Add Feedback</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Add Error Feedback</DialogTitle>
                  <DialogDescription>
                    Identify an error and provide constructive feedback.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="error_description">Error Description</Label>
                    <Input 
                      id="error_description" 
                      value={newFeedback.error_description}
                      onChange={(e) => setNewFeedback({...newFeedback, error_description: e.target.value})}
                      placeholder="Describe the specific error"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="correction">Correction/Guidance</Label>
                    <Textarea 
                      id="correction" 
                      rows={3}
                      value={newFeedback.correction}
                      onChange={(e) => setNewFeedback({...newFeedback, correction: e.target.value})}
                      placeholder="Provide detailed guidance on how to fix the error"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="location">Location</Label>
                      <Input 
                        id="location" 
                        value={newFeedback.location}
                        onChange={(e) => setNewFeedback({...newFeedback, location: e.target.value})}
                        placeholder="e.g., Page 1, Problem 3"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="error_type">Error Type</Label>
                      <Select 
                        value={newFeedback.error_type} 
                        onValueChange={(value) => setNewFeedback({...newFeedback, error_type: value})}
                      >
                        <SelectTrigger id="error_type">
                          <SelectValue placeholder="Select error type" />
                        </SelectTrigger>
                        <SelectContent>
                          {ERROR_TYPES.map((type) => (
                            <SelectItem key={type} value={type} className="capitalize">
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="severity">Severity (1-5)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={newFeedback.severity}
                        onChange={(e) => setNewFeedback({...newFeedback, severity: parseInt(e.target.value)})}
                        className="flex-1"
                      />
                      <span className="w-16 text-center">
                        {getErrorSeverityLabel(newFeedback.severity)}
                      </span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddingFeedback(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddFeedback}>Add Feedback</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          {/* Feedback list */}
          {feedbackItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg">
              <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No feedback has been provided yet</p>
              <Button 
                variant="link" 
                className="mt-2" 
                onClick={() => setAddingFeedback(true)}
              >
                Add your first feedback
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbackItems.map((item) => (
                <Card key={item.id} className={`border-l-4 ${getErrorSeverityColor(item.severity)}`}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{item.error_description}</CardTitle>
                        <CardDescription>
                          {item.location && (
                            <span className="mr-3">Location: {item.location}</span>
                          )}
                          <Badge variant="outline" className="capitalize">
                            {item.error_type}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={`ml-2 ${getErrorSeverityColor(item.severity)}`}
                          >
                            {getErrorSeverityLabel(item.severity)} Severity
                          </Badge>
                        </CardDescription>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => deleteFeedback(item.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive/90"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{item.correction}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="preview" className="space-y-4 pt-4">
          <div className="border rounded-lg p-4 flex flex-col items-center justify-center min-h-[400px]">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Assignment Submission Preview</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This is where the preview of the student's uploaded work would be displayed.
            </p>
            <Button variant="outline" asChild>
              <a href={submission.submission_file_url} target="_blank" rel="noopener noreferrer">
                Open Full Document
              </a>
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="notes" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Student Notes</CardTitle>
              <CardDescription>
                Notes provided by the student with their submission
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submission.student_notes ? (
                <p className="text-sm">{submission.student_notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No notes provided by the student.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Action buttons */}
      <div className="flex justify-end space-x-3">
        {/* Score Input Section */}
        <div className="my-6">
          <Card>
            <CardHeader>
              <CardTitle>Grade Submission</CardTitle>
              <CardDescription>Enter the score for this submission.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <Label htmlFor="score">Score</Label>
                <Input 
                  id="score" 
                  type="number" 
                  placeholder="Enter score (e.g., 85)" 
                  value={currentScore}
                  onChange={(e) => setCurrentScore(e.target.value)}
                  className="max-w-xs"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Button variant="outline">Save Draft</Button>
        <Button onClick={returnToStudent}>Return to Student & Save Score</Button>
      </div>
    </div>
  );
};

export default FeedbackView;
