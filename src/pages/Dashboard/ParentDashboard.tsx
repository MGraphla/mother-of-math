import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isParent } from "@/types";
import { UserProfile } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Search, UserPlus, Book, ArrowRight } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { PRIMARY_GRADE_LEVELS } from "@/types";

// Mock student data
const mockChildren: UserProfile[] = [
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

// Mock teachers
const MOCK_TEACHERS: UserProfile[] = [
  {
    id: "teacher-1",
    email: "mathteacher@school.com",
    role: "teacher",
    full_name: "Ms. Thompson",
    school: "Springfield Elementary",
    created_at: "2023-08-15T09:00:00Z",
    managed_student_ids: ["student-1", "student-2"]
  },
  {
    id: "teacher-2",
    email: "scienceteacher@school.com",
    role: "teacher",
    full_name: "Mr. Phillips",
    school: "Springfield Elementary",
    created_at: "2023-08-16T10:00:00Z",
    managed_student_ids: []
  }
];

const ParentDashboard = () => {
  const { profile } = useAuth();
  const [children, setChildren] = useState<UserProfile[]>(MOCK_STUDENTS);
  const [availableTeachers] = useState<UserProfile[]>(MOCK_TEACHERS);
  const [activeTab, setActiveTab] = useState("children");
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [newChild, setNewChild] = useState({
    full_name: "",
    email: "",
    teacher_id: "",
    grade_level: ""
  });

  // Check if user is a parent
  if (!isParent(profile)) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Only parents can access this page.</p>
      </div>
    );
  }

  // Filter children based on search
  const filteredChildren = children.filter(child => 
    child.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    child.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    child.grade_level?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddChild = () => {
    // Validate form
    if (!newChild.full_name || !newChild.email || !newChild.teacher_id || !newChild.grade_level) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    // Find the selected teacher
    const teacher = availableTeachers.find(t => t.id === newChild.teacher_id);

    // Create new child account
    const newChildData: UserProfile = {
      id: `student-${Date.now()}`,
      email: newChild.email,
      role: "student",
      full_name: newChild.full_name,
      school: teacher?.school || "Unknown School",
      created_at: new Date().toISOString(),
      teacher_id: newChild.teacher_id,
      parent_ids: [profile?.id || ""],
      grade_level: newChild.grade_level,
      subjects: ["Math"] // Default subject
    };

    // Add to children list
    setChildren([...children, newChildData]);
    
    // Reset form
    setNewChild({
      full_name: "",
      email: "",
      teacher_id: "",
      grade_level: ""
    });
    
    setIsAddingChild(false);
    
    toast({
      title: "Child Added",
      description: `${newChild.full_name} has been added to your account.`
    });
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Parent Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your children's accounts and submit assignments
          </p>
        </div>
        <Dialog open={isAddingChild} onOpenChange={setIsAddingChild}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Child
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Child Account</DialogTitle>
              <DialogDescription>
                Link your child's account to your profile for managing assignments.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="full_name">Child's Full Name</Label>
                <Input
                  id="full_name"
                  value={newChild.full_name}
                  onChange={(e) => setNewChild({...newChild, full_name: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Child's Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newChild.email}
                  onChange={(e) => setNewChild({...newChild, email: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="teacher">Teacher</Label>
                <select
                  id="teacher"
                  value={newChild.teacher_id}
                  onChange={(e) => setNewChild({...newChild, teacher_id: e.target.value})}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select a teacher</option>
                  {availableTeachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.full_name} ({teacher.school})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="grade_level">Level</Label>
                <select
                  id="grade_level"
                  value={newChild.grade_level}
                  onChange={(e) => setNewChild({...newChild, grade_level: e.target.value})}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select a level</option>
                  {PRIMARY_GRADE_LEVELS.map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddingChild(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddChild}>Add Child</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="children">My Children</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>
        
        <TabsContent value="children" className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search children..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Children List */}
          {filteredChildren.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg">
              <UserPlus className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No children found</p>
              <Button 
                variant="link" 
                className="mt-2" 
                onClick={() => setIsAddingChild(true)}
              >
                Add your first child
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredChildren.map(child => (
                <Card key={child.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-mama-purple text-white">
                          {child.full_name?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">{child.full_name}</CardTitle>
                        <CardDescription>{child.email}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Level:</span>
                        <span className="font-medium">{child.grade_level}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Teacher:</span>
                        <span className="font-medium">
                          {availableTeachers.find(t => t.id === child.teacher_id)?.full_name || "Unknown"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">School:</span>
                        <span className="font-medium">{child.school}</span>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/dashboard/child/${child.id}`}>View Profile</a>
                    </Button>
                    <Button size="sm" asChild>
                      <a href={`/dashboard/child/${child.id}/assignments`}>
                        Assignments
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex flex-col items-center justify-center p-8 text-center border rounded-lg">
            <Book className="h-8 w-8 text-muted-foreground mb-2" />
            <h3 className="text-lg font-medium mb-1">Manage Assignments</h3>
            <p className="text-muted-foreground mb-4">
              Select a child to view and submit their assignments
            </p>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 w-full max-w-3xl">
              {children.map(child => (
                <Button key={child.id} variant="outline" asChild className="h-auto py-4 justify-start">
                  <a href={`/dashboard/child/${child.id}/assignments`} className="flex items-center">
                    <Avatar className="h-8 w-8 mr-3">
                      <AvatarFallback className="bg-mama-purple text-white text-xs">
                        {child.full_name?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <div className="font-medium">{child.full_name}</div>
                      <div className="text-xs text-muted-foreground">{child.grade_level}</div>
                    </div>
                  </a>
                </Button>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ParentDashboard;
