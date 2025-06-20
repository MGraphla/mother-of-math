import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isTeacher, PRIMARY_GRADE_LEVELS } from "@/types";
import { UserProfile } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, UserPlus, Copy, Mail, Download, Printer, Eye, EyeOff } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Mock student accounts
const MOCK_STUDENTS: (UserProfile & { password?: string; parentEmail?: string })[] = [
  {
    id: "student-1",
    email: "manka.c@example.com",
    password: "student123", // This would be encrypted in a real system
    role: "student",
    full_name: "Manka'a Che",
    school: "Springfield Elementary",
    created_at: "2024-01-15T10:30:00Z",
    teacher_id: "mock-user-id",
    grade_level: "Primary 5",
    subjects: ["Mathematics"],
    parentEmail: "parent1@example.com"
  },
  {
    id: "student-2",
    email: "nfor.j@example.com",
    password: "student456", 
    role: "student",
    full_name: "Nfor Junior",
    school: "Springfield Elementary",
    created_at: "2024-02-10T14:45:00Z",
    teacher_id: "mock-user-id",
    grade_level: "Primary 3",
    subjects: ["Mathematics"],
    parentEmail: "parent2@example.com"
  }
];

// Subject is always mathematics
const SUBJECT = "Mathematics";

// Function to generate a random password
const generatePassword = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let password = "";
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const StudentAccountCreation = () => {
  const { profile } = useAuth();
  const [students, setStudents] = useState<(UserProfile & { password?: string; parentEmail?: string })[]>(MOCK_STUDENTS);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showPasswords, setShowPasswords] = useState(false);
  
  // New student account state
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({
    full_name: "",
    email: "",
    parentEmail: "",
    grade_level: "",
    subjects: [] as string[],
    generatePassword: true,
    password: generatePassword()
  });
  
  // Email credentials dialog state
  const [selectedStudent, setSelectedStudent] = useState<(UserProfile & { password?: string; parentEmail?: string }) | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  
  // Filter students based on search and active tab
  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.grade_level?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "all") {
      return matchesSearch;
    } else if (activeTab === "active") {
      // In a real system, you'd check the account status
      return matchesSearch && true;
    } else if (activeTab === "pending") {
      // In a real system, you'd check if the account is pending activation
      return matchesSearch && false;
    }
    
    return matchesSearch;
  });
  
  // Check if user is a teacher
  if (!isTeacher(profile)) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Only teachers can access this page.</p>
      </div>
    );
  }
  
  const handleCreateStudent = () => {
    // Validate form
    if (!newStudent.full_name || !newStudent.email || !newStudent.grade_level) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }
    
    // Create new student account
    const newStudentAccount = {
      id: `student-${Date.now()}`,
      email: newStudent.email,
      password: newStudent.generatePassword ? newStudent.password : "",
      role: "student" as const,
      full_name: newStudent.full_name,
      school: profile?.school || "Unknown School",
      created_at: new Date().toISOString(),
      teacher_id: profile?.id || "mock-user-id",
      grade_level: newStudent.grade_level,
      subjects: ["Mathematics"],
      parentEmail: newStudent.parentEmail
    };
    
    // Add to students list
    setStudents([...students, newStudentAccount]);
    
    // Reset form
    setNewStudent({
      full_name: "",
      email: "",
      parentEmail: "",
      grade_level: "",
      subjects: [],
      generatePassword: true,
      password: generatePassword()
    });
    
    setCreatingStudent(false);
    
    toast({
      title: "Student Account Created",
      description: `Account for ${newStudentAccount.full_name} has been created successfully.`
    });
    
    // In a real system, you would show options to send credentials here
    setSelectedStudent(newStudentAccount);
  };
  
  const copyCredentials = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: "Login credentials copied to clipboard."
    });
  };
  
  const sendCredentialsByEmail = () => {
    // In a real system, this would send an actual email
    setSendingEmail(true);
    
    // Simulate sending email
    setTimeout(() => {
      setSendingEmail(false);
      setSelectedStudent(null);
      
      toast({
        title: "Credentials Sent",
        description: "Login credentials have been sent to the student and parent."
      });
    }, 1500);
  };
  
  const generateCredentialsPDF = () => {
    // In a real system, this would generate a PDF
    toast({
      title: "PDF Generated",
      description: "Login credentials PDF has been generated and downloaded."
    });
  };
  
  const printCredentials = () => {
    // In a real system, this would open a print dialog
    toast({
      title: "Print Dialog",
      description: "Print dialog opened to print login credentials."
    });
  };
  
  // No need to toggle subjects since mathematics is the only subject
  
  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Accounts</h1>
          <p className="text-muted-foreground">
            Create and manage student accounts for your class
          </p>
        </div>
        <Dialog open={creatingStudent} onOpenChange={setCreatingStudent}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Create Student Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create Student Account</DialogTitle>
              <DialogDescription>
                Create a new student account and send login credentials to the student or parent.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="full_name">Student's Full Name</Label>
                <Input 
                  id="full_name" 
                  value={newStudent.full_name}
                  onChange={(e) => setNewStudent({...newStudent, full_name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Student's Email</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="parentEmail">Parent's Email (Optional)</Label>
                  <Input 
                    id="parentEmail" 
                    type="email"
                    value={newStudent.parentEmail}
                    onChange={(e) => setNewStudent({...newStudent, parentEmail: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="grade_level">Level</Label>
                  <Select 
                    value={newStudent.grade_level} 
                    onValueChange={(value) => setNewStudent({...newStudent, grade_level: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIMARY_GRADE_LEVELS.map((grade) => (
                        <SelectItem key={grade} value={grade}>
                          {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Subject</Label>
                  <div className="flex flex-wrap gap-2">
                    <div className="px-3 py-1 rounded-full text-xs bg-mama-purple text-white">
                      Mathematics
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="generatePassword"
                    checked={newStudent.generatePassword}
                    onCheckedChange={(checked) => 
                      setNewStudent({
                        ...newStudent, 
                        generatePassword: checked as boolean,
                        password: checked ? generatePassword() : ""
                      })
                    }
                  />
                  <Label htmlFor="generatePassword">Generate secure password</Label>
                </div>
                {newStudent.generatePassword && (
                  <div className="flex items-center mt-2">
                    <Input 
                      type={showPasswords ? "text" : "password"} 
                      value={newStudent.password}
                      readOnly
                      className="pr-10"
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      className="ml-[-40px]"
                      onClick={() => setShowPasswords(!showPasswords)}
                    >
                      {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      className="ml-2"
                      onClick={() => setNewStudent({...newStudent, password: generatePassword()})}
                    >
                      Regenerate
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreatingStudent(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateStudent}>Create Account</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="all">All Accounts</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search students..."
          className="pl-8"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {/* Students Table */}
      {filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg">
          <UserPlus className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No student accounts found</p>
          <Button 
            variant="link" 
            className="mt-2" 
            onClick={() => setCreatingStudent(true)}
          >
            Create your first student account
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden md:table-cell">Level</TableHead>
                  <TableHead className="hidden lg:table-cell">Subjects</TableHead>
                  <TableHead className="hidden sm:table-cell">Parent Email</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.full_name}</TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell className="hidden md:table-cell">{student.grade_level}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {student.subjects?.map((subject) => (
                          <Badge key={subject} variant="outline">{subject}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {student.parentEmail || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => setSelectedStudent(student)}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      {/* Send Credentials Dialog */}
      {selectedStudent && (
        <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Student Login Credentials</DialogTitle>
              <DialogDescription>
                Share login credentials for {selectedStudent.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Login Information</Label>
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">URL</Label>
                        <div className="flex items-center mt-1">
                          <p className="text-sm flex-1">https://mother-of-math.com/student-login</p>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => copyCredentials("https://mother-of-math.com/student-login")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Username/Email</Label>
                        <div className="flex items-center mt-1">
                          <p className="text-sm flex-1">{selectedStudent.email}</p>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => copyCredentials(selectedStudent.email)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Password</Label>
                        <div className="flex items-center mt-1">
                          <p className="text-sm flex-1">{showPasswords ? selectedStudent.password : "••••••••"}</p>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 mr-1"
                            onClick={() => setShowPasswords(!showPasswords)}
                          >
                            {showPasswords ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={() => copyCredentials(selectedStudent.password || "")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Share Options</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    onClick={sendCredentialsByEmail}
                    disabled={sendingEmail}
                    className="justify-start"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {sendingEmail ? "Sending..." : "Send Email"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={generateCredentialsPDF}
                    className="justify-start"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={printCredentials}
                    className="justify-start sm:col-span-2"
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print Credentials
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedStudent(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default StudentAccountCreation;
