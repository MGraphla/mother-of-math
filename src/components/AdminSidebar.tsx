import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { adminLogout } from "@/services/adminAuth";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  MessageSquare,
  ClipboardList,
  FileText,
  BarChart3,
  Activity,
  Settings,
  LogOut,
  Shield,
  Bell,
  UserPlus,
  FolderOpen,
  Megaphone,
  MessageCircle,
  Image,
  Upload,
  HeartPulse,
  ShieldAlert,
  Database,
  Building2,
  Globe,
  FileBarChart,
  Headphones,
  Bot,
  Award,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: string;
}

const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navSections: NavSection[] = [
    {
      title: "Overview",
      items: [
        { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
        { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
        { name: "User Activity", href: "/admin/activity", icon: Activity },
      ],
    },
    {
      title: "Users",
      items: [
        { name: "Teachers", href: "/admin/teachers", icon: Users },
        { name: "Students", href: "/admin/students", icon: GraduationCap },
        { name: "Schools", href: "/admin/schools", icon: Building2 },
        { name: "Teacher Performance", href: "/admin/teacher-performance", icon: Award },
        { name: "Student Performance", href: "/admin/student-performance", icon: TrendingUp, badge: "New" },
        { name: "Create Teacher", href: "/admin/create-teacher", icon: UserPlus },
      ],
    },
    {
      title: "Content",
      items: [
        { name: "Lesson Plans", href: "/admin/lesson-plans", icon: BookOpen },
        { name: "Assignments", href: "/admin/assignments", icon: ClipboardList },
        { name: "Submissions", href: "/admin/submissions", icon: FileText },
        { name: "Resources", href: "/admin/resources", icon: FolderOpen },
        { name: "Images", href: "/admin/images", icon: Image },
        { name: "Uploads", href: "/admin/uploads", icon: Upload },
      ],
    },
    {
      title: "AI & Communication",
      items: [
        { name: "AI Usage", href: "/admin/ai-usage", icon: Sparkles, badge: "New" },
        { name: "Chatbot Activity", href: "/admin/chatbot", icon: MessageSquare },
        { name: "Announcements", href: "/admin/announcements", icon: Megaphone },
        { name: "Comments", href: "/admin/comments", icon: MessageCircle },
        { name: "Support Tickets", href: "/admin/support", icon: Headphones },
      ],
    },
    {
      title: "Insights",
      items: [
        { name: "Geographic", href: "/admin/geographic", icon: Globe },
        { name: "Reports", href: "/admin/reports", icon: FileBarChart },
      ],
    },
    {
      title: "System",
      items: [
        { name: "System Health", href: "/admin/system-health", icon: HeartPulse },
        { name: "Moderation", href: "/admin/moderation", icon: ShieldAlert },
        { name: "Data Management", href: "/admin/data", icon: Database },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === "/admin/dashboard") {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  const handleLogout = () => {
    adminLogout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <aside className="fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-40">
      {/* Logo/Header */}
      <div className="flex items-center gap-3 h-16 px-5 border-b border-gray-800">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg">Admin Portal</h1>
          <p className="text-gray-500 text-xs">Mother of Math</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                          isActive(item.href)
                            ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                            : "text-gray-400 hover:text-white hover:bg-gray-800"
                        )}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate flex-1">{item.name}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-400 rounded">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-gray-800 text-white border-gray-700">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-800 space-y-1">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
