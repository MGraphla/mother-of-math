import {
  Activity,
  AlertTriangle,
  Award,
  Brain,
  BookCheck,
  BookOpen,
  Bot,
  Building2,
  ChartColumnBig,
  ClipboardList,
  Database,
  FileText,
  Globe,
  GraduationCap,
  HeartPulse,
  HelpCircle,
  Home,
  ImageIcon,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  School,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  UserCircle,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react-native";

export type DrawerRole = "teacher" | "student" | "admin" | "monitor" | "parent";

export interface NavItem {
  /** i18n key resolved at render time so the drawer follows the language switch. */
  labelKey: string;
  fallback: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  labelKey?: string;
  fallback?: string;
  items: NavItem[];
}

export interface RoleNav {
  /** Wordmark shown in the drawer header. */
  brandTitle: string;
  brandSubtitleKey?: string;
  brandSubtitleFallback?: string;
  /** `overlay` = translucent white highlight (web teacher sidebar); `pill` = white pill (web student sidebar). */
  activeStyle: "overlay" | "pill";
  showProfileCard: boolean;
  groups: NavGroup[];
}

/**
 * Mirrors src/components/DashboardSidebar.tsx (teacher branch) — same items, same order.
 * Enrollment requests stay reachable from Student Accounts; they are not on the web sidebar.
 */
const teacherNav: RoleNav = {
  brandTitle: "MAMA",
  brandSubtitleKey: "mobile.teacherPortal",
  brandSubtitleFallback: "Teacher portal",
  activeStyle: "overlay",
  showProfileCard: false,
  groups: [
    {
      items: [
        { labelKey: "sidebar.dashboard", fallback: "Dashboard", href: "/(roles)/teacher", icon: Home },
        {
          labelKey: "sidebar.studentAccounts",
          fallback: "Student Accounts",
          href: "/(roles)/teacher/students",
          icon: UserPlus,
        },
        {
          labelKey: "sidebar.assignments",
          fallback: "Assignments",
          href: "/(roles)/teacher/assignments",
          icon: ClipboardList,
        },
        {
          labelKey: "sidebar.lessonPlans",
          fallback: "Lesson Plans",
          href: "/(roles)/teacher/lesson-plan-generator",
          icon: BookOpen,
        },
        {
          labelKey: "sidebar.viewLessonPlans",
          fallback: "View Lesson Plans",
          href: "/(roles)/teacher/lesson-plans",
          icon: BookCheck,
        },
        {
          labelKey: "sidebar.chatBot",
          fallback: "Chat Bot",
          href: "/(roles)/teacher/chatbot",
          icon: MessageCircle,
        },
        {
          labelKey: "sidebar.uploadWork",
          fallback: "Upload Work",
          href: "/(roles)/teacher/uploads",
          icon: Upload,
        },
        {
          labelKey: "sidebar.announcements",
          fallback: "Announcements",
          href: "/(roles)/teacher/announcements",
          icon: Megaphone,
        },
        {
          labelKey: "sidebar.resources",
          fallback: "Resources",
          href: "/(roles)/teacher/resources",
          icon: BookOpen,
        },
        {
          labelKey: "sidebar.generateImages",
          fallback: "Generate Images",
          href: "/(roles)/teacher/generate-images",
          icon: ImageIcon,
        },
        {
          labelKey: "sidebar.support",
          fallback: "Support",
          href: "/(roles)/teacher/support",
          icon: HelpCircle,
        },
        {
          labelKey: "sidebar.settings",
          fallback: "Settings",
          href: "/(roles)/teacher/settings",
          icon: Settings,
        },
      ],
    },
  ],
};

/** Mirrors src/components/StudentSidebar.tsx — same items, same order. */
const studentNav: RoleNav = {
  brandTitle: "Math Mama",
  brandSubtitleKey: "student.portal",
  brandSubtitleFallback: "Student portal",
  activeStyle: "pill",
  showProfileCard: true,
  groups: [
    {
      labelKey: "student.menu",
      fallback: "Menu",
      items: [
        { labelKey: "sidebar.dashboard", fallback: "Dashboard", href: "/(roles)/student", icon: Home },
        {
          labelKey: "sidebar.assignments",
          fallback: "Assignments",
          href: "/(roles)/student/assignments",
          icon: BookCheck,
        },
        {
          labelKey: "common.progress",
          fallback: "Progress",
          href: "/(roles)/student/progress",
          icon: Award,
        },
        {
          labelKey: "sidebar.announcements",
          fallback: "Announcements",
          href: "/(roles)/student/announcements",
          icon: Megaphone,
        },
        {
          labelKey: "sidebar.myFeedback",
          fallback: "My AI Feedback",
          href: "/(roles)/student/analysis",
          icon: Brain,
        },
        {
          labelKey: "sidebar.resources",
          fallback: "Resources",
          href: "/(roles)/student/resources",
          icon: BookOpen,
        },
        {
          labelKey: "nav.profile",
          fallback: "Profile",
          href: "/(roles)/student/profile",
          icon: UserCircle,
        },
        {
          labelKey: "sidebar.settings",
          fallback: "Settings",
          href: "/(roles)/student/settings",
          icon: Settings,
        },
      ],
    },
  ],
};

/** Mirrors src/components/AdminSidebar.tsx — same sections, items, and order. */
const adminNav: RoleNav = {
  brandTitle: "MAMA",
  brandSubtitleKey: "mobile.adminPortal",
  brandSubtitleFallback: "Admin console",
  activeStyle: "overlay",
  showProfileCard: false,
  groups: [
    {
      labelKey: "admin.overview",
      fallback: "Overview",
      items: [
        { labelKey: "sidebar.dashboard", fallback: "Dashboard", href: "/(roles)/admin", icon: Home },
        { labelKey: "admin.analytics", fallback: "Analytics", href: "/(roles)/admin/analytics", icon: ChartColumnBig },
        { labelKey: "admin.activity", fallback: "User Activity", href: "/(roles)/admin/activity", icon: Activity },
      ],
    },
    {
      labelKey: "admin.users",
      fallback: "Users",
      items: [
        { labelKey: "admin.teachers", fallback: "Teachers", href: "/(roles)/admin/teachers", icon: Users },
        { labelKey: "admin.learners", fallback: "Learner", href: "/(roles)/admin/students", icon: GraduationCap },
        { labelKey: "admin.schools", fallback: "Schools", href: "/(roles)/admin/schools", icon: Building2 },
        {
          labelKey: "admin.teacherPerformance",
          fallback: "Teacher Performance",
          href: "/(roles)/admin/teacher-performance",
          icon: Award,
        },
        {
          labelKey: "admin.learnerPerformance",
          fallback: "Learner Performance",
          href: "/(roles)/admin/student-performance",
          icon: TrendingUp,
        },
        {
          labelKey: "admin.createTeacher",
          fallback: "Create Teacher",
          href: "/(roles)/admin/create-teacher",
          icon: UserPlus,
        },
      ],
    },
    {
      labelKey: "admin.content",
      fallback: "Content",
      items: [
        { labelKey: "sidebar.lessonPlans", fallback: "Lesson Plans", href: "/(roles)/admin/lesson-plans", icon: BookOpen },
        { labelKey: "sidebar.assignments", fallback: "Assignments", href: "/(roles)/admin/assignments", icon: ClipboardList },
        { labelKey: "admin.submissions", fallback: "Submissions", href: "/(roles)/admin/submissions", icon: FileText },
        { labelKey: "sidebar.resources", fallback: "Resources", href: "/(roles)/admin/resources", icon: BookOpen },
        { labelKey: "admin.images", fallback: "Images", href: "/(roles)/admin/images", icon: ImageIcon },
        { labelKey: "sidebar.uploadWork", fallback: "Uploads", href: "/(roles)/admin/uploads", icon: Upload },
      ],
    },
    {
      labelKey: "admin.aiAndComms",
      fallback: "AI & Communication",
      items: [
        { labelKey: "admin.aiUsage", fallback: "AI Usage", href: "/(roles)/admin/ai-usage", icon: Sparkles },
        { labelKey: "admin.chatbotActivity", fallback: "Chatbot Activity", href: "/(roles)/admin/chatbot", icon: MessagesSquare },
        {
          labelKey: "sidebar.announcements",
          fallback: "Announcements",
          href: "/(roles)/admin/announcements",
          icon: Megaphone,
        },
        { labelKey: "admin.comments", fallback: "Comments", href: "/(roles)/admin/comments", icon: MessageCircle },
        { labelKey: "admin.support", fallback: "Support Tickets", href: "/(roles)/admin/support", icon: HelpCircle },
      ],
    },
    {
      labelKey: "admin.insights",
      fallback: "Insights",
      items: [
        { labelKey: "admin.geographic", fallback: "Geographic", href: "/(roles)/admin/geographic", icon: Globe },
        { labelKey: "admin.reports", fallback: "Reports", href: "/(roles)/admin/reports", icon: FileText },
      ],
    },
    {
      labelKey: "admin.system",
      fallback: "System",
      items: [
        {
          labelKey: "admin.systemHealth",
          fallback: "System Health",
          href: "/(roles)/admin/system-health",
          icon: HeartPulse,
        },
        { labelKey: "admin.moderation", fallback: "Moderation", href: "/(roles)/admin/moderation", icon: ShieldCheck },
        { labelKey: "admin.data", fallback: "Data Management", href: "/(roles)/admin/data", icon: Database },
      ],
    },
  ],
};

/** Mirrors src/monitor/components/MonitorLayout.tsx — same flat list and order. */
const monitorNav: RoleNav = {
  brandTitle: "MAMA",
  brandSubtitleKey: "mobile.monitorPortal",
  brandSubtitleFallback: "Monitor console",
  activeStyle: "overlay",
  showProfileCard: false,
  groups: [
    {
      items: [
        { labelKey: "admin.overview", fallback: "Overview", href: "/(roles)/monitor", icon: Home },
        { labelKey: "monitor.activityLog", fallback: "Activity Log", href: "/(roles)/monitor/activity", icon: Activity },
        { labelKey: "admin.teachers", fallback: "Teachers", href: "/(roles)/monitor/teachers", icon: Users },
        {
          labelKey: "monitor.learnersParents",
          fallback: "Learners & parents",
          href: "/(roles)/monitor/learners",
          icon: UsersRound,
        },
        { labelKey: "sidebar.chatBot", fallback: "Chatbot", href: "/(roles)/monitor/chatbot", icon: Bot },
        {
          labelKey: "sidebar.lessonPlans",
          fallback: "Lesson Plans",
          href: "/(roles)/monitor/lesson-plans",
          icon: BookOpen,
        },
        {
          labelKey: "monitor.studentUploads",
          fallback: "Student Uploads",
          href: "/(roles)/monitor/uploads",
          icon: Upload,
        },
        {
          labelKey: "monitor.errorAnalysis",
          fallback: "Error Analysis",
          href: "/(roles)/monitor/error-analysis",
          icon: AlertTriangle,
        },
        {
          labelKey: "monitor.imageGeneration",
          fallback: "Image Generation",
          href: "/(roles)/monitor/images",
          icon: ImageIcon,
        },
        {
          labelKey: "sidebar.assignments",
          fallback: "Assignments",
          href: "/(roles)/monitor/assignments",
          icon: ClipboardList,
        },
        {
          labelKey: "monitor.schoolsGeo",
          fallback: "Schools & Geo",
          href: "/(roles)/monitor/schools",
          icon: Building2,
        },
      ],
    },
  ],
};

/** Mirrors src/components/DashboardSidebar.tsx (parent branch). */
const parentNav: RoleNav = {
  brandTitle: "Math Mama",
  brandSubtitleKey: "mobile.parentPortal",
  brandSubtitleFallback: "Parent portal",
  activeStyle: "pill",
  showProfileCard: true,
  groups: [
    {
      items: [
        { labelKey: "sidebar.dashboard", fallback: "Dashboard", href: "/(roles)/parent", icon: Home },
        {
          labelKey: "sidebar.uploadWork",
          fallback: "Upload Work",
          href: "/(roles)/parent/submissions",
          icon: Upload,
        },
        { labelKey: "sidebar.settings", fallback: "Settings", href: "/(roles)/parent/settings", icon: Settings },
      ],
    },
  ],
};

export const roleNav: Record<DrawerRole, RoleNav> = {
  teacher: teacherNav,
  student: studentNav,
  admin: adminNav,
  monitor: monitorNav,
  parent: parentNav,
};

/** Landing routes must match exactly so they don't stay lit on their sub-pages. */
export const roleLandingRoutes = Object.keys(roleNav).map((r) => `/${r}`);

export const isDrawerRole = (value?: string): value is DrawerRole =>
  !!value && value in roleNav;

/** Route path (as expo-router reports it) → nav item, built once at module load. */
const navItemsByPath = new Map<string, NavItem>(
  Object.values(roleNav).flatMap((nav) =>
    nav.groups.flatMap((group) =>
      group.items.map((item) => [item.href.replace("/(roles)", ""), item] as const),
    ),
  ),
);

export const navItemForPath = (pathname: string): NavItem | undefined =>
  navItemsByPath.get(pathname);
