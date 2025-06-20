import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isTeacher, PRIMARY_GRADE_LEVELS } from "@/types";
import { Assignment } from "@/types";
import { format, roundToNearestMinutes } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsHeader, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Calendar as CalendarIcon, Plus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// Mock data for existing assignments
const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: "assign-1",
    title: "Addition and Subtraction Practice",
    description: "Complete worksheet pages 10-12 with practice problems for addition and subtraction with regrouping.",
    due_date: "2025-06-05T23:59:59Z",
    created_at: "2025-05-25T14:30:00Z",
    teacher_id: "mock-user-id",
    subject: "Math",
    grade_level: "5th"
  },
  {
    id: "assign-2",
    title: "Multiplication Tables Quiz",
    description: "Study multiplication tables 1-12 and complete the online quiz.",
    due_date: "2025-06-10T23:59:59Z",
    created_at: "2025-05-28T10:15:00Z",
    teacher_id: "mock-user-id",
    subject: "Math",
    grade_level: "5th"
  },
  {
    id: "assign-3",
    title: "Fractions Word Problems",
    description: "Solve the 10 word problems involving fractions on the provided worksheet.",
    due_date: "2025-06-15T23:59:59Z",
    created_at: "2025-05-29T09:00:00Z",
    teacher_id: "mock-user-id",
    subject: "Math",
    grade_level: "6th"
  }
];

// Subject is always mathematics
const SUBJECT = "Mathematics";
const SUBJECTS = [SUBJECT]; // Define SUBJECTS as an array containing the single subject

const AssignmentManagement = () => {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>(MOCK_ASSIGNMENTS);
  const [searchTerm, setSearchTerm] = useState("");
  // No subject filtering needed as everything is mathematics
  const [filterGrade, setFilterGrade] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");
  
  // New assignment state
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    title: "",
    description: "",
    due_date: "",
    subject: "",
    grade_level: ""
  });
  
  // Check if user is a teacher
  if (!isTeacher(profile)) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Only teachers can access this page.</p>
      </div>
    );
  }
  
  // Filter assignments based on search term and filters
  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = 
      assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.description.toLowerCase().includes(searchTerm.toLowerCase());
      
    // All assignments are mathematics
    const matchesGrade = filterGrade ? assignment.grade_level === filterGrade : true;
    
    if (activeTab === "all") {
      return matchesSearch && matchesGrade;
    } else if (activeTab === "upcoming") {
      return matchesSearch && matchesGrade && 
        new Date(assignment.due_date) > new Date();
    } else if (activeTab === "past") {
      return matchesSearch && matchesGrade && 
        new Date(assignment.due_date) < new Date();
    }
    
    return false;
  });
  
  const handleCreateAssignment = () => {
    // Validate form
    if (!newAssignment.title || !newAssignment.description || !newAssignment.due_date || 
        !newAssignment.subject || !newAssignment.grade_level) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    // Create new assignment
    const newAssignmentData: Assignment = {
      id: `assign-${Date.now()}`,
      title: newAssignment.title,
      description: newAssignment.description,
      due_date: newAssignment.due_date,
      created_at: new Date().toISOString(),
      teacher_id: profile?.id || "mock-user-id",
      subject: newAssignment.subject,
      grade_level: newAssignment.grade_level
    };
    
    // Add to list
    setAssignments([newAssignmentData, ...assignments]);
    
    // Reset form
    setNewAssignment({
      title: "",
      description: "",
      due_date: "",
      subject: "",
      grade_level: ""
    });
    
    setCreatingAssignment(false);
    
    toast({
      title: "Assignment Created",
      description: `"${newAssignment.title}" has been created and assigned to students.`
    });
  };
  
  const deleteAssignment = (assignmentId: string) => {
    setAssignments(assignments.filter(assignment => assignment.id !== assignmentId));
    toast({
      title: "Assignment Deleted",
      description: "The assignment has been removed."
    });
  };
  
  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground">Create and manage assignments for your students</p>
        </div>
        <Dialog open={creatingAssignment} onOpenChange={setCreatingAssignment}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Assignment</DialogTitle>
              <DialogDescription>
                Create a new assignment for your students.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Assignment Title</Label>
                <Input 
                  id="title" 
                  value={newAssignment.title}
                  onChange={(e) => setNewAssignment({...newAssignment, title: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  rows={4}
                  value={newAssignment.description}
                  onChange={(e) => setNewAssignment({...newAssignment, description: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Select 
                    onValueChange={(value) => setNewAssignment({...newAssignment, subject: value})}
                    value={newAssignment.subject}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Subjects</SelectLabel>
                        {SUBJECTS.map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>


                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="grade">Level</Label>
                  <Select 
                    onValueChange={(value) => setNewAssignment({...newAssignment, grade_level: value})}
                    value={newAssignment.grade_level}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Primary Levels</SelectLabel>
                        {PRIMARY_GRADE_LEVELS.map((grade) => (
                          <SelectItem key={grade} value={grade}>
                            {grade}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="due-date">Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !newAssignment.due_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newAssignment.due_date ? format(new Date(newAssignment.due_date), "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={newAssignment.due_date ? new Date(newAssignment.due_date) : undefined}
                      onSelect={(date) => setNewAssignment({...newAssignment, due_date: date ? date.toISOString() : ""})}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreatingAssignment(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAssignment}>Create Assignment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Search and filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assignments..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {/* No subject filter needed as everything is mathematics */}
        <Select
          value={filterGrade || "all"}
          onValueChange={(value) => setFilterGrade(value === "all" ? null : value)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {PRIMARY_GRADE_LEVELS.map((grade) => (
              <SelectItem key={grade} value={grade}>{grade}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Assignment list */}
      {filteredAssignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg">
          <p className="text-muted-foreground">No assignments found</p>
          <Button 
            variant="link" 
            className="mt-2" 
            onClick={() => setCreatingAssignment(true)}
          >
            Create your first assignment
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredAssignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardHeader>
                <div className="flex justify-between">
                  <div>
                    <CardTitle>{assignment.title}</CardTitle>
                    <CardDescription>
                      Due: {format(new Date(assignment.due_date), "PPP")}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge>{assignment.subject}</Badge>
                    <Badge variant="outline">{assignment.grade_level}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{assignment.description}</p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" size="sm" asChild>
                  <a href={`/dashboard/assignments/${assignment.id}`}>View Submissions</a>
                </Button>
                <div className="space-x-2">
                  <Button variant="outline" size="sm">Edit</Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-destructive hover:text-destructive/90"
                    onClick={() => deleteAssignment(assignment.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssignmentManagement;
