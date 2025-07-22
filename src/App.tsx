import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Layouts
import DashboardLayout from '@/components/DashboardLayout';
import StudentDashboardLayout from '@/components/StudentDashboardLayout';
import ParentDashboardLayout from '@/components/ParentDashboardLayout';

// General Pages
import Home from '@/pages/Home';
import Index from '@/pages/Index';
import NotFound from '@/pages/NotFound';
import StudentLogin from '@/pages/StudentLogin';

// Auth Pages
import AuthCallback from '@/pages/Auth/AuthCallback';
import AuthSuccess from '@/pages/Auth/AuthSuccess';
import SignIn from '@/pages/Auth/SignIn';
import SignUp from '@/pages/Auth/SignUp';

// Dashboard Pages
import Overview from "@/pages/dashboard/Overview";
import Statistics from "@/pages/dashboard/Statistics";
import LessonPlanGenerator from "@/pages/dashboard/LessonPlanGenerator";
import StoryLessonPlan from "@/pages/dashboard/StoryLessonPlan";
import Upload from "@/pages/dashboard/Upload";
import Settings from '@/pages/dashboard/Settings';
import TeacherTraining from '@/pages/dashboard/TeacherTraining';
import InterviewPage from '@/pages/dashboard/teacher-training/InterviewPage';
import InterviewResultsPage from '@/pages/dashboard/teacher-training/InterviewResultsPage';
import StudentManagement from "@/pages/dashboard/StudentManagement";
import AssignmentManagement from "@/pages/dashboard/AssignmentManagement";
import StudentAssignments from "@/pages/dashboard/StudentAssignments";
import StudentAccountCreation from "@/pages/dashboard/StudentAccountCreation";
import StudentDashboard from "@/pages/dashboard/StudentDashboard";
import StudentProgress from "@/pages/dashboard/StudentProgress";
import DetailedStudentAnalysis from "@/pages/dashboard/DetailedStudentAnalysis";
import ParentDashboard from "@/pages/dashboard/ParentDashboard";
import ParentAssignmentSubmission from "@/pages/dashboard/ParentAssignmentSubmission";
import FeedbackView from "@/pages/dashboard/FeedbackView";

const queryClient = new QueryClient();

const AppContent = () => {
  const { profile, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/sign-up" element={<SignUp />} />
      <Route path="/student-login" element={<StudentLogin />} />
      <Route path="/auth-success" element={<AuthSuccess />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard/*" element={<DashboardLayout />}>
          <Route index element={<Overview />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="lesson-plan" element={<LessonPlanGenerator />} />
          <Route path="upload" element={<Upload />} />
          <Route path="students" element={<StudentManagement />} />
          <Route path="students/:studentId" element={<FeedbackView />} />
          <Route path="student-accounts" element={<StudentAccountCreation />} />
          <Route path="assignments" element={<AssignmentManagement />} />
          <Route path="assignments/:assignmentId" element={<FeedbackView />} />
          <Route path="detailed-analysis" element={<DetailedStudentAnalysis />} />
          <Route path="lessons" element={<LessonPlanGenerator />} />
          <Route path="story-lessons" element={<StoryLessonPlan />} />
          <Route path="settings" element={<Settings />} />
          <Route path="teacher-training" element={<TeacherTraining />} />
          <Route path="teacher-training/:interviewId" element={<InterviewPage />} />
          <Route path="teacher-training/results/:interviewId" element={<InterviewResultsPage />} />
        </Route>

        <Route path="/parent-dashboard/*" element={<ParentDashboardLayout />}>
          <Route index element={<ParentDashboard />} />
          <Route path="submissions" element={<ParentAssignmentSubmission />} />
        </Route>

        <Route path="/student/*" element={<StudentDashboardLayout />}>
          <Route index element={<StudentDashboard />} />
          <Route path="assignments" element={<StudentAssignments />} />
          <Route path="upload" element={<Upload />} />
          <Route path="progress" element={<StudentProgress />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Fallback Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      
        
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppContent />
          </TooltipProvider>
        
      
    </QueryClientProvider>
  );
};

export default App;
