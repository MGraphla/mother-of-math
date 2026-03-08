import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, User } from "lucide-react";

const StudentLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn } = useAuth();
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Missing Information",
        description: "Please enter both email and password.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoggingIn(true);
    setErrorMessage("");

    try {
      await signIn(email, password);
      toast({
        title: "Login Successful",
        description: "Welcome back to Mother of Math!",
      });
      // Navigate to student dashboard
      navigate("/student");
    } catch (error: any) {
      console.error("Student login error:", error);
      setErrorMessage(error.message || "Invalid email or password. Please try again.");
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password.",
        variant: "destructive"
      });
    } finally {
      setIsLoggingIn(false);
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
              M
            </div>
            <span className="font-bold text-xl text-foreground">Math Mama</span>
          </Link>
          <div className="space-x-2">
            <Button variant="outline" asChild>
              <Link to="/sign-in">Teacher Login</Link>
            </Button>
            <Button asChild>
              <Link to="/sign-up">Register</Link>
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 bg-gray-50">
        <div className="w-full max-w-md">
          <Tabs defaultValue="student" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="student">
                <GraduationCap className="mr-2 h-4 w-4" />
                Student
              </TabsTrigger>
              <TabsTrigger value="parent">
                <User className="mr-2 h-4 w-4" />
                Parent
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="student">
              <Card className="w-full">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl text-center">Student Login</CardTitle>
                  <CardDescription className="text-center">
                    Enter your login details to access your dashboard
                  </CardDescription>
                  {errorMessage && (
                    <p className="text-sm text-red-600 text-center bg-red-50 rounded-lg p-2">{errorMessage}</p>
                  )}
                </CardHeader>
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium">Email</label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="student@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="password" className="text-sm font-medium">Password</label>
                        <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                          Forgot password?
                        </Link>
                      </div>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>Your teacher should have provided you with login details.</p>
                      <p>If you don't have login details, please contact your teacher.</p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" type="submit" disabled={isLoggingIn}>
                      {isLoggingIn ? "Logging in..." : "Login to My Account"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
            
            <TabsContent value="parent">
              <Card className="w-full">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl text-center">Parent Access</CardTitle>
                  <CardDescription className="text-center">
                    Log in to help your child with assignments
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="parent-email" className="text-sm font-medium">Student's Email</label>
                      <Input
                        id="parent-email"
                        type="email"
                        placeholder="student@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="parent-password" className="text-sm font-medium">Password</label>
                        <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                          Forgot password?
                        </Link>
                      </div>
                      <Input
                        id="parent-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>Parents use the same login credentials as their child.</p>
                      <p>These should have been shared with you by your child's teacher.</p>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full" type="submit" disabled={isLoggingIn}>
                      {isLoggingIn ? "Logging in..." : "Access Child's Account"}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
          </Tabs>
          
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>Need help? Contact support at <a href="mailto:support@motherofmath.com" className="text-primary hover:underline">support@motherofmath.com</a></p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="border-t py-6 bg-white">
        <div className="container flex flex-col items-center justify-center space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Mother of Math. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default StudentLogin;
