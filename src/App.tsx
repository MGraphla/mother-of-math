import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Layouts
const DashboardLayout = lazy(() => import('@/components/DashboardLayout'));
const StudentDashboardLayout = lazy(() => import('@/components/StudentDashboardLayout'));
const ParentDashboardLayout = lazy(() => import('@/components/ParentDashboardLayout'));

// General Pages
const Home = lazy(() => import('@/pages/Home'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const StudentLogin = lazy(() => import('@/pages/StudentLogin'));

// Auth Pages
const AuthCallback = lazy(() => import('@/pages/Auth/AuthCallback'));
const AuthSuccess = lazy(() => import('@/pages/Auth/AuthSuccess'));
const SignIn = lazy(() => import('@/pages/Auth/SignIn'));
const SignUp = lazy(() => import('@/pages/Auth/SignUp'));
const ForgotPassword = lazy(() => import('@/pages/Auth/ForgotPassword'));

// Dashboard Pages
const Overview = lazy(() => import("@/pages/Dashboard/Overview.tsx"));
const Statistics = lazy(() => import("@/pages/Dashboard/Statistics"));
const LessonPlanGenerator = lazy(() => import("@/pages/Dashboard/LessonPlanGenerator"));
const ViewLessonPlans = lazy(() => import("@/pages/Dashboard/ViewLessonPlans"));
const StoryLessonPlan = lazy(() => import("@/pages/Dashboard/StoryLessonPlan"));
const Chatbot = lazy(() => import("@/pages/Dashboard/Chatbot"));
const Upload = lazy(() => import("@/pages/Dashboard/Upload"));
const Settings = lazy(() => import('@/pages/Dashboard/Settings'));
const TeacherTraining = lazy(() => import('@/pages/Dashboard/TeacherTraining'));
const InterviewPage = lazy(() => import('@/pages/Dashboard/teacher-training/InterviewPage'));
const InterviewResultsPage = lazy(() => import('@/pages/Dashboard/teacher-training/InterviewResultsPage'));
const StudentManagement = lazy(() => import("@/pages/Dashboard/StudentManagement"));
const AssignmentManagement = lazy(() => import("@/pages/Dashboard/AssignmentManagement"));
const StudentAssignments = lazy(() => import("@/pages/Dashboard/StudentAssignments"));
const StudentAccountCreation = lazy(() => import("@/pages/Dashboard/StudentAccountCreation"));
const StudentDashboard = lazy(() => import("@/pages/Dashboard/StudentDashboard"));
const StudentProgress = lazy(() => import("@/pages/Dashboard/StudentProgress"));
const DetailedStudentAnalysis = lazy(() => import("@/pages/Dashboard/DetailedStudentAnalysis"));
const ParentDashboard = lazy(() => import("@/pages/Dashboard/ParentDashboard"));
const ParentAssignmentSubmission = lazy(() => import("@/pages/Dashboard/ParentAssignmentSubmission"));
const FeedbackView = lazy(() => import("@/pages/Dashboard/FeedbackView"));

const queryClient = new QueryClient();

const AppContent = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center">Loading...</div>;
  }

  return (
    <Suspense fallback={<></>}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
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
            <Route path="view-lesson-plans" element={<ViewLessonPlans />} />
            <Route path="story-lessons" element={<StoryLessonPlan />} />
            <Route path="chatbot" element={<Chatbot />} />
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
    </Suspense>
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
