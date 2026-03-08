import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home, BookOpen, Upload, Settings, LogOut, Users, ClipboardList, UserPlus, BookCheck, UserCircle, UsersRound, ChevronsLeft, ChevronsRight, BrainCircuit, Sparkles, MessageCircle, BarChart, Megaphone, ImageIcon, HelpCircle
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfile } from "@/context/AuthContext";
import { LanguageToggle } from "@/components/LanguageSwitcher";

interface DashboardSidebarProps {
  profile: UserProfile;
  isExpanded: boolean;
  setExpanded: (v: boolean) => void;
  onLinkClick?: () => void;
}

const DashboardSidebar = ({ profile, isExpanded, setExpanded, onLinkClick }: DashboardSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isTeacher = profile?.role === "teacher";
  const isParent = profile?.role === "parent";
  const { signOut } = useAuth();
  const { t } = useLanguage();

  const navItems = [
    ...(isTeacher ? [
      { name: t('sidebar.dashboard'), href: "/dashboard", icon: <Home className="h-5 w-5" /> },
      { name: t('sidebar.studentAccounts'), href: "/dashboard/student-accounts", icon: <UserPlus className="h-5 w-5" /> },
      { name: t('sidebar.assignments'), href: "/dashboard/assignments", icon: <ClipboardList className="h-5 w-5" /> },
      { name: t('sidebar.lessonPlans'), href: "/dashboard/lessons", icon: <BookOpen className="h-5 w-5" /> },
      { name: t('sidebar.viewLessonPlans'), href: "/dashboard/view-lesson-plans", icon: <BookCheck className="h-5 w-5" /> },
      { name: t('sidebar.chatBot'), href: "/dashboard/chatbot", icon: <MessageCircle className="h-5 w-5" /> },
      { name: t('sidebar.uploadWork'), href: "/dashboard/upload", icon: <Upload className="h-5 w-5" /> },
      { name: t('sidebar.teacherTraining'), href: "/dashboard/teacher-training", icon: <BrainCircuit className="h-5 w-5" /> },
      { name: t('sidebar.announcements'), href: "/dashboard/announcements", icon: <Megaphone className="h-5 w-5" /> },
      { name: t('sidebar.resources'), href: "/dashboard/resources", icon: <BookOpen className="h-5 w-5" /> },
      { name: t('sidebar.generateImages'), href: "/dashboard/generate-images", icon: <ImageIcon className="h-5 w-5" /> },
      { name: t('sidebar.support'), href: "/dashboard/support", icon: <HelpCircle className="h-5 w-5" /> },
    ] : isParent ? [
      { name: t('sidebar.dashboard'), href: "/parent-dashboard", icon: <Home className="h-5 w-5" /> },
      { name: t('sidebar.uploadWork'), href: "/parent-dashboard/submissions", icon: <Upload className="h-5 w-5" /> },
    ] : [
      { name: t('sidebar.dashboard'), href: "/student", icon: <Home className="h-5 w-5" /> },
      { name: t('sidebar.myAssignments'), href: "/student/assignments", icon: <BookCheck className="h-5 w-5" /> },
      { name: t('sidebar.uploadWork'), href: "/student/upload", icon: <Upload className="h-5 w-5" /> },
    ]),
    { name: t('sidebar.settings'), href: isTeacher ? "/dashboard/settings" : isParent ? "/parent-dashboard" : "/student/settings", icon: <Settings className="h-5 w-5" /> }
  ];

  // Check if a nav item is active (supports nested routes)
  const isActive = (href: string) => {
    if (href === "/dashboard" || href === "/parent-dashboard" || href === "/student") {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  const NavLink = ({ item }: { item: { name: string; href: string; icon: React.ReactNode } }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={item.href}
          onClick={onLinkClick}
          className={cn(
            "flex items-center h-10 px-3 rounded-lg text-white/80 transition-colors",
            isExpanded ? "justify-start gap-3" : "justify-center",
            isActive(item.href) ? "bg-white/20" : "hover:bg-white/10"
          )}
        >
          {item.icon}
          <span className={cn("truncate transition-all duration-200", !isExpanded && "w-0")}>
            {item.name}
          </span>
        </Link>
      </TooltipTrigger>
      {!isExpanded && (
        <TooltipContent side="right" className="bg-primary text-white border-0">
          {item.name}
        </TooltipContent>
      )}
    </Tooltip>
  );

  return (
    <aside className={cn(
      "fixed top-0 left-0 h-full bg-primary text-primary-foreground flex flex-col transition-all duration-300 ease-in-out z-40",
      isExpanded ? "w-72" : "w-20"
    )}>
      <div className={cn("flex items-center h-16 px-4", isExpanded ? "justify-between" : "justify-center")}>
        <Link to="/" className={cn("flex items-center gap-2", !isExpanded && "hidden")}>
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-primary font-bold text-lg shadow-inner">
            M
          </div>
          <span className="font-extrabold text-xl tracking-wider">MAMA</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setExpanded(!isExpanded)} className="hidden lg:flex hover:bg-white/20">
          {isExpanded ? <ChevronsLeft /> : <ChevronsRight />}
        </Button>
      </div>

      <nav className="flex-1 flex flex-col gap-2 p-2">
        {navItems.map((item) => <NavLink key={item.href} item={item} />)}
      </nav>

      <div className="p-2 border-t border-white/10">
        {/* Language Toggle */}
        {isExpanded && (
          <div className="pb-2">
            <LanguageToggle />
          </div>
        )}
        
        <div className={cn("flex items-center p-2", !isExpanded && "justify-center")}>
          <Avatar className="h-10 w-10 border-2 border-white/20">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-white text-primary font-bold text-lg">
              {profile?.full_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className={cn("ml-3 overflow-hidden transition-all duration-200", !isExpanded && "w-0")}>
            <div className="font-bold text-sm truncate">{profile?.full_name?.split(' ')[0] || "User"}</div>
            <div className="text-xs text-gray-300 truncate">{profile?.email || ""}</div>
          </div>
        </div>


        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={async () => { await signOut(); navigate('/sign-in'); }} className={cn('w-full flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-primary/20', isExpanded ? "justify-start gap-3" : "justify-center")}>
              <LogOut className="h-5 w-5" />
              <span className={cn("truncate transition-all duration-200", !isExpanded && "w-0")}>{t('nav.logout')}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">{t('nav.logout')}</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
};


export default DashboardSidebar;
