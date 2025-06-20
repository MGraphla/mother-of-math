import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isTeacher, PRIMARY_GRADE_LEVELS } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search } from "lucide-react";
import { UserProfile } from "@/context/AuthContext";
import { toast } from "@/components/ui/use-toast";

// Mock data for students
const MOCK_STUDENTS: UserProfile[] = [
  {
    id: "student-1",
    email: "manka.c@example.com",
    role: "student",
    full_name: "Manka'a Che",
    school: "Springfield Elementary",
    created_at: "2024-01-15T10:30:00Z",
    teacher_id: "mock-user-id",
    grade_level: "5th",
    subjects: ["Math", "Science"]
  },
  {
    id: "student-2",
    email: "nfor.j@example.com",
    role: "student",
    full_name: "Nfor Junior",
    school: "Springfield Elementary",
    created_at: "2024-02-10T14:45:00Z",
    teacher_id: "mock-user-id",
    grade_level: "5th",
    subjects: ["Math"]
  },
  {
    id: "student-3",
    email: "charlie@example.com",
    role: "student",
    full_name: "Charlie Brown",
    school: "Springfield Elementary",
    created_at: "2024-03-05T09:15:00Z",
    teacher_id: "mock-user-id",
    grade_level: "6th",
    subjects: ["Math", "Science", "English"]
  }
];

// Mock subjects
const SUBJECTS = ["Math", "Science", "English", "History", "Art"];

const StudentManagement = () => {
  const { profile } = useAuth();
  const [students, setStudents] = useState<UserProfile[]>(MOCK_STUDENTS);
  const [searchTerm, setSearchTerm] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({
    email: "",
    full_name: "",
    grade_level: "",
    subjects: [] as string[]
  });
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  
  // Check if user is a teacher
  if (!isTeacher(profile)) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Only teachers can access this page.</p>
      </div>
    );
  }
  
  // Filter students based on search term
  const filteredStudents = students.filter(student => 
    student.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.grade_level?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleAddStudent = () => {
    // Validate form
    if (!newStudent.email || !newStudent.full_name || !newStudent.grade_level) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    // Create new student
    const newStudentData: UserProfile = {
      id: `student-${Date.now()}`,
      email: newStudent.email,
      full_name: newStudent.full_name,
      role: "student",
      grade_level: newStudent.grade_level,
      subjects: newStudent.subjects,
      teacher_id: profile?.id || "",
      school: profile?.school || "",
      created_at: new Date().toISOString()
    };
    
    // Add to list
    setStudents([...students, newStudentData]);
    
    // Reset form
    setNewStudent({
      email: "",
      full_name: "",
      grade_level: "",
      subjects: []
    });
    
    setAddingStudent(false);
    
    toast({
      title: "Student Added",
      description: `${newStudent.full_name} has been added to your student list.`
    });
  };
  
  const removeStudent = (studentId: string) => {
    setStudents(students.filter(student => student.id !== studentId));
    toast({
      title: "Student Removed",
      description: "The student has been removed from your list."
    });
  };
  
  const handleAddSubject = (subject: string) => {
    if (subject && !newStudent.subjects.includes(subject)) {
      setNewStudent({
        ...newStudent,
        subjects: [...newStudent.subjects, subject]
      });
      setSelectedSubject(null);
    }
  };
  
  const removeSubject = (subject: string) => {
    setNewStudent({
      ...newStudent,
      subjects: newStudent.subjects.filter(s => s !== subject)
    });
  };
  
  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Management</h1>
          <p className="text-muted-foreground">Manage students and track their progress</p>
        </div>
        <Dialog open={addingStudent} onOpenChange={setAddingStudent}>
          <DialogTrigger asChild>
            <Button>Add Student</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
              <DialogDescription>
                Enter the student's information to add them to your class.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input 
                  id="full_name" 
                  value={newStudent.full_name}
                  onChange={(e) => setNewStudent({...newStudent, full_name: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="grade">Level</Label>
                <Select 
                  onValueChange={(value) => setNewStudent({...newStudent, grade_level: value})}
                  value={newStudent.grade_level}
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
              <div className="grid gap-2">
                <Label>Subjects</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {newStudent.subjects.map(subject => (
                    <Badge 
                      key={subject} 
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeSubject(subject)}
                    >
                      {subject} ×
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Select 
                    onValueChange={(value) => setSelectedSubject(value)}
                    value={selectedSubject || ""}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Subjects</SelectLabel>
                        {SUBJECTS.filter(subject => !newStudent.subjects.includes(subject)).map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => selectedSubject && handleAddSubject(selectedSubject)}
                    disabled={!selectedSubject}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddingStudent(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddStudent}>Add Student</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Search and filters */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {/* Student list */}
      {filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg">
          <p className="text-muted-foreground">No students found</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => (
            <Card key={student.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-mama-purple text-white">
                      {student.full_name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{student.full_name}</CardTitle>
                    <CardDescription>{student.email}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Level:</span>
                    <span className="font-medium">{student.grade_level}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Subjects:</span>
                    <div className="flex flex-wrap justify-end gap-1">
                      {student.subjects?.map((subject) => (
                        <Badge key={subject} variant="outline">{subject}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" size="sm" asChild>
                  <a href={`/dashboard/students/${student.id}`}>View Details</a>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-destructive hover:text-destructive/90"
                  onClick={() => removeStudent(student.id)}
                >
                  Remove
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentManagement;
