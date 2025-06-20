import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Index from "./pages/Index";
import Home from "./pages/Home";
import SignIn from "./pages/Auth/SignIn";
import SignUp from "./pages/Auth/SignUp";
import AuthSuccess from "./pages/Auth/AuthSuccess";
import DashboardLayout from "./components/DashboardLayout";
import StudentDashboardLayout from "./components/StudentDashboardLayout";
import Overview from "./pages/Dashboard/Overview";
import Statistics from "./pages/Dashboard/Statistics";
import LessonPlanGenerator from "./pages/Dashboard/LessonPlanGenerator";
import Upload from "./pages/Dashboard/Upload";
import Settings from "./pages/Dashboard/Settings";
import StudentManagement from "./pages/Dashboard/StudentManagement";
import AssignmentManagement from "./pages/Dashboard/AssignmentManagement";
import StudentAssignments from "./pages/Dashboard/StudentAssignments";
import StudentAccountCreation from "./pages/Dashboard/StudentAccountCreation";
import StudentDashboard from "./pages/Dashboard/StudentDashboard";
import StudentProgress from "./pages/Dashboard/StudentProgress";
import DetailedStudentAnalysis from "./pages/Dashboard/DetailedStudentAnalysis"; // Added new page import
import ParentDashboard from "./pages/Dashboard/ParentDashboard";
import ParentAssignmentSubmission from "./pages/Dashboard/ParentAssignmentSubmission";
import FeedbackView from "./pages/Dashboard/FeedbackView";
import StudentLogin from "./pages/StudentLogin";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/Auth/AuthCallback";

const queryClient = new QueryClient();

// AppContent component that will be rendered inside the AuthProvider
const AppContent = () => {
  // Access the authentication context safely inside the AuthProvider
  const { profile, isLoading } = useAuth();

  // Show a loading state while authentication is in progress
  if (isLoading) {
    return <div>Loading...</div>; // Replace with a proper loading component
  }

  // Determine the user's role
  const isTeacher = profile?.role === "teacher";
  const isStudent = profile?.role === "student";
  
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<Index />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/student-login" element={<StudentLogin />} />
        <Route path="/auth-success" element={<AuthSuccess />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Conditional Dashboard routes based on role */}
        {isTeacher && (
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Overview />} />
            <Route path="statistics" element={<Statistics />} />
            <Route path="lesson-plan" element={<LessonPlanGenerator />} />
            <Route path="upload" element={<Upload />} />
            <Route path="students" element={<StudentManagement />} />
            <Route path="students/:studentId" element={<FeedbackView />} />
            <Route path="student-accounts" element={<StudentAccountCreation />} />
            <Route path="assignments" element={<AssignmentManagement />} />
            <Route path="assignments/:assignmentId" element={<FeedbackView />} />
            <Route path="detailed-analysis" element={<DetailedStudentAnalysis />} /> {/* Added route for detailed analysis */}
            {/* Teacher specific routes that were placeholders */}
            <Route path="lessons" element={<LessonPlanGenerator />} /> {/* Re-using generator for now */}
            <Route path="settings" element={<Settings />} />
            {/* Redirect teachers from student paths is handled at the top level */}
          </Route>
        )}

        {isStudent && (
          <Route path="/student" element={<StudentDashboardLayout />}>
            <Route index element={<StudentDashboard />} />
            <Route path="assignments" element={<StudentAssignments />} />
            <Route path="upload" element={<Upload />} />
            <Route path="progress" element={<StudentProgress />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        )}

        {/* Handle authenticated but neither teacher nor student, or redirect unauthenticated users from protected routes */}
        {profile && !isTeacher && !isStudent && (
          <Route path="*" element={<div>Unauthorized Role</div>} /> 
        )}
        {!profile && (
          <Route path="dashboard/*" element={<Navigate to="/sign-in" replace />} />
        )}
        {!profile && (
          <Route path="student/*" element={<Navigate to="/student-login" replace />} />
        )}
        
        {/* Redirects between student and teacher areas */}
        {isTeacher && (
          <Route path="student/*" element={<Navigate to="/dashboard" replace />} />
        )}
        {isStudent && (
          <Route path="dashboard/*" element={<Navigate to="/student" replace />} />
        )}

        {/* Catch-all route for routes that don't match any authenticated/unauthenticated logic */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => {

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppContent />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
