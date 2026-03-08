import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Layouts
const DashboardLayout = lazy(() => import('@/components/DashboardLayout'));
const StudentDashboardLayout = lazy(() => import('@/components/StudentDashboardLayout'));
const ParentDashboardLayout = lazy(() => import('@/components/ParentDashboardLayout'));
const AdminDashboardLayout = lazy(() => import('@/components/AdminDashboardLayout'));

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
const ResetPassword = lazy(() => import('@/pages/Auth/ResetPassword'));
const VerifyEmail = lazy(() => import('@/pages/Auth/VerifyEmail'));
const CompleteProfile = lazy(() => import('@/pages/Auth/CompleteProfile'));

// Dashboard Pages
const Overview = lazy(() => import("@/pages/Dashboard/Overview.tsx"));
const LessonPlanGenerator = lazy(() => import("@/pages/Dashboard/LessonPlanGenerator"));
const ViewLessonPlans = lazy(() => import("@/pages/Dashboard/ViewLessonPlans"));
const Chatbot = lazy(() => import("@/pages/Dashboard/Chatbot"));
const Upload = lazy(() => import("@/pages/Dashboard/Upload"));
const Settings = lazy(() => import('@/pages/Dashboard/Settings'));
const TeacherTraining = lazy(() => import('@/pages/Dashboard/TeacherTraining'));
const InterviewPage = lazy(() => import('@/pages/Dashboard/teacher-training/InterviewPage'));
const InterviewResultsPage = lazy(() => import('@/pages/Dashboard/teacher-training/InterviewResultsPage'));
const AssignmentManagement = lazy(() => import("@/pages/Dashboard/AssignmentManagement"));
const StudentAssignments = lazy(() => import("@/pages/Dashboard/StudentAssignments"));
const StudentAccountCreation = lazy(() => import("@/pages/Dashboard/StudentAccountCreation"));
const StudentDashboard = lazy(() => import("@/pages/Dashboard/StudentDashboard"));
const StudentProgress = lazy(() => import("@/pages/Dashboard/StudentProgress"));
const StudentProfile = lazy(() => import("@/pages/Dashboard/StudentProfile"));
const DetailedStudentAnalysis = lazy(() => import("@/pages/Dashboard/DetailedStudentAnalysis"));

// Announcements & Resources
const StudentAnnouncements = lazy(() => import("@/pages/Dashboard/StudentAnnouncements"));
const StudentResources = lazy(() => import("@/pages/Dashboard/StudentResources"));
const TeacherAnnouncements = lazy(() => import("@/pages/Dashboard/TeacherAnnouncements"));
const TeacherResources = lazy(() => import("@/pages/Dashboard/TeacherResources"));
const TeacherSupport = lazy(() => import("@/pages/Dashboard/TeacherSupport"));

// Image Generation
const GenerateImages = lazy(() => import("@/pages/Dashboard/GenerateImages"));

// Public access pages
const StudentAccess = lazy(() => import("@/pages/StudentAccess"));
const ParentDashboard = lazy(() => import("@/pages/Dashboard/ParentDashboard"));
const ParentAssignmentSubmission = lazy(() => import("@/pages/Dashboard/ParentAssignmentSubmission"));
const FeedbackView = lazy(() => import("@/pages/Dashboard/FeedbackView"));

// Admin Pages
const AdminLogin = lazy(() => import("@/pages/Admin/AdminLogin"));
const AdminOverview = lazy(() => import("@/pages/Admin/AdminOverview"));
const TeachersManagement = lazy(() => import("@/pages/Admin/TeachersManagement"));
const StudentsManagement = lazy(() => import("@/pages/Admin/StudentsManagement"));
const LessonPlansManagement = lazy(() => import("@/pages/Admin/LessonPlansManagement"));
const ChatbotManagement = lazy(() => import("@/pages/Admin/ChatbotManagement"));
const AssignmentsManagement = lazy(() => import("@/pages/Admin/AssignmentsManagement"));
const SubmissionsManagement = lazy(() => import("@/pages/Admin/SubmissionsManagement"));
const ResourcesManagement = lazy(() => import("@/pages/Admin/ResourcesManagement"));
const AnnouncementsManagement = lazy(() => import("@/pages/Admin/AnnouncementsManagement"));
const CommentsManagement = lazy(() => import("@/pages/Admin/CommentsManagement"));
const ImagesManagement = lazy(() => import("@/pages/Admin/ImagesManagement"));
const UploadsManagement = lazy(() => import("@/pages/Admin/UploadsManagement"));
const AdminAnalytics = lazy(() => import("@/pages/Admin/AdminAnalytics"));
const UserActivity = lazy(() => import("@/pages/Admin/UserActivity"));
const CreateTeacher = lazy(() => import("@/pages/Admin/CreateTeacher"));
// New Admin Pages
const SupportTickets = lazy(() => import("@/pages/Admin/SupportTickets"));
const SystemHealth = lazy(() => import("@/pages/Admin/SystemHealth"));
const ContentModeration = lazy(() => import("@/pages/Admin/ContentModeration"));
const DataManagement = lazy(() => import("@/pages/Admin/DataManagement"));
const SchoolsManagement = lazy(() => import("@/pages/Admin/SchoolsManagement"));
const GeographicAnalytics = lazy(() => import("@/pages/Admin/GeographicAnalytics"));
const ReportsGenerator = lazy(() => import("@/pages/Admin/ReportsGenerator"));
const AIUsageAnalytics = lazy(() => import("@/pages/Admin/AIUsageAnalytics"));
const TeacherPerformance = lazy(() => import("@/pages/Admin/TeacherPerformance"));
const StudentPerformance = lazy(() => import("@/pages/Admin/StudentPerformance"));

const queryClient = new QueryClient();

const AppContent = () => {
  return (
    <Suspense fallback={<></>}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/student-login" element={<StudentLogin />} />
        <Route path="/student-access/:token" element={<StudentAccess />} />
        <Route path="/auth-success" element={<AuthSuccess />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Admin Routes (Public Login, Protected Dashboard) */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminDashboardLayout />}>
          <Route path="dashboard" element={<AdminOverview />} />
          <Route path="teachers" element={<TeachersManagement />} />
          <Route path="students" element={<StudentsManagement />} />
          <Route path="lesson-plans" element={<LessonPlansManagement />} />
          <Route path="chatbot" element={<ChatbotManagement />} />
          <Route path="assignments" element={<AssignmentsManagement />} />
          <Route path="submissions" element={<SubmissionsManagement />} />
          <Route path="resources" element={<ResourcesManagement />} />
          <Route path="announcements" element={<AnnouncementsManagement />} />
          <Route path="comments" element={<CommentsManagement />} />
          <Route path="images" element={<ImagesManagement />} />
          <Route path="uploads" element={<UploadsManagement />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="activity" element={<UserActivity />} />
          <Route path="create-teacher" element={<CreateTeacher />} />
          {/* New Admin Pages */}
          <Route path="schools" element={<SchoolsManagement />} />
          <Route path="support" element={<SupportTickets />} />
          <Route path="geographic" element={<GeographicAnalytics />} />
          <Route path="reports" element={<ReportsGenerator />} />
          <Route path="system-health" element={<SystemHealth />} />
          <Route path="moderation" element={<ContentModeration />} />
          <Route path="data" element={<DataManagement />} />
          <Route path="ai-usage" element={<AIUsageAnalytics />} />
          <Route path="teacher-performance" element={<TeacherPerformance />} />
          <Route path="student-performance" element={<StudentPerformance />} />
        </Route>

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard/*" element={<DashboardLayout />}>
            <Route index element={<Overview />} />
            <Route path="lesson-plan" element={<LessonPlanGenerator />} />
            <Route path="upload" element={<Upload />} />
            <Route path="students/:studentId" element={<FeedbackView />} />
            <Route path="student-accounts" element={<StudentAccountCreation />} />
            <Route path="assignments" element={<AssignmentManagement />} />
            <Route path="assignments/:assignmentId" element={<FeedbackView />} />
            <Route path="detailed-analysis" element={<DetailedStudentAnalysis />} />
            <Route path="lessons" element={<LessonPlanGenerator />} />
            <Route path="view-lesson-plans" element={<ViewLessonPlans />} />
            <Route path="chatbot" element={<Chatbot />} />
            <Route path="settings" element={<Settings />} />
            <Route path="teacher-training" element={<TeacherTraining />} />
            <Route path="teacher-training/:interviewId" element={<InterviewPage />} />
            <Route path="teacher-training/results/:interviewId" element={<InterviewResultsPage />} />
            <Route path="announcements" element={<TeacherAnnouncements />} />
            <Route path="resources" element={<TeacherResources />} />
            <Route path="support" element={<TeacherSupport />} />
            <Route path="generate-images" element={<GenerateImages />} />
          </Route>

          <Route path="/parent-dashboard/*" element={<ParentDashboardLayout />}>
            <Route index element={<ParentDashboard />} />
            <Route path="submissions" element={<ParentAssignmentSubmission />} />
          </Route>

        </Route>

        {/* Student routes — accessible via magic link (no auth required) */}
        <Route path="/student/*" element={<StudentDashboardLayout />}>
          <Route index element={<StudentDashboard />} />
          <Route path="assignments" element={<StudentAssignments />} />
          <Route path="progress" element={<StudentProgress />} />
          <Route path="profile" element={<StudentProfile />} />
          <Route path="announcements" element={<StudentAnnouncements />} />
          <Route path="resources" element={<StudentResources />} />
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
