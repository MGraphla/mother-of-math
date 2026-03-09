import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home, BookCheck, LogOut, Award, UserCircle, Megaphone, BookOpen, ChevronRight, Brain
} from "lucide-react";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { clearStudentSession } from "@/services/studentService";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

interface StudentSidebarProps {
  profile: UserProfile;
  isExpanded: boolean;
  onLinkClick?: () => void;
}

const StudentSidebar = ({ profile, isExpanded, onLinkClick }: StudentSidebarProps) => {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const navItems = [
    { name: t('sidebar.dashboard'), href: "/student", icon: <Home className="h-5 w-5" />, description: t('student.desc.overview') },
    { name: t('sidebar.assignments'), href: "/student/assignments", icon: <BookCheck className="h-5 w-5" />, description: t('student.desc.homework') },
    { name: t('common.progress'), href: "/student/progress", icon: <Award className="h-5 w-5" />, description: t('student.desc.grades') },
    { name: t('sidebar.announcements'), href: "/student/announcements", icon: <Megaphone className="h-5 w-5" />, description: t('student.desc.updates') },
    { name: "My AI Feedback", href: "/student/analysis", icon: <Brain className="h-5 w-5" />, description: "View your AI-graded work" },
    { name: t('sidebar.resources'), href: "/student/resources", icon: <BookOpen className="h-5 w-5" />, description: t('student.desc.library') },
    { name: t('nav.profile'), href: "/student/profile", icon: <UserCircle className="h-5 w-5" />, description: t('student.desc.myInfo') },
  ];

  const NavLink = ({ item }: { item: typeof navItems[number] }) => {
    const isActive = location.pathname === item.href;
    
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={item.href}
              onClick={onLinkClick}
              className={cn(
                "group flex items-center h-12 px-3 mb-1.5 rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                isExpanded ? "justify-start gap-4" : "justify-center",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className={cn(
                "flex items-center justify-center transition-colors",
                isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
              )}>
                {item.icon}
              </div>
              
              <div className={cn(
                "overflow-hidden transition-all duration-300 flex-1", 
                !isExpanded && "w-0 opacity-0 hidden"
              )}>
                <div className="flex items-center justify-between">
                  <span className={cn("font-medium text-sm", isActive ? "font-semibold top-0" : "")}>
                    {item.name}
                  </span>
                  {isActive && <ChevronRight className="h-3 w-3 opacity-50" />}
                </div>
              </div>
            </Link>
          </TooltipTrigger>
          {!isExpanded && (
            <TooltipContent side="right" className="bg-popover text-popover-foreground border shadow-lg font-medium ml-2">
              <p>{item.name}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <aside className={cn(
      "fixed top-0 left-0 h-full border-r bg-card/50 backdrop-blur-xl flex flex-col transition-all duration-300 ease-in-out z-40 shadow-sm",
      isExpanded ? "w-72" : "w-[80px]"
    )}>
      {/* Logo Section */}
      <div className={cn(
        "flex items-center h-20 px-6 border-b bg-gradient-to-br from-primary/5 via-transparent to-transparent", 
        isExpanded ? "justify-between" : "justify-center"
      )}>
        <div className={cn("flex items-center gap-3 transition-all duration-300", !isExpanded && "scale-100")}>
          <div className="relative group">
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-primary to-primary/60 opacity-20 group-hover:opacity-40 blur transition duration-200" />
            <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold shadow-lg">
              M
            </div>
          </div>
          {isExpanded && (
            <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-300">
              <span className="font-bold text-lg leading-none tracking-tight">Math Mama</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 font-semibold">{t('student.portal')}</span>
            </div>
          )}
        </div>
      </div>

      {/* User Mini Profile */}
      <div className={cn(
        "mx-4 mt-6 mb-4 p-3 bg-gradient-to-br from-muted/50 to-muted/10 rounded-2xl border border-border/50 transition-all duration-300", 
        !isExpanded && "bg-transparent border-none p-0 mx-0 flex justify-center mb-6"
      )}>
        <div className={cn("flex items-center gap-3", !isExpanded && "justify-center")}>
          <div className={cn(
            "relative shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-background shadow-sm",
            isExpanded ? "w-10 h-10" : "w-10 h-10"
          )}>
            {profile?.full_name ? (
               <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {profile.full_name.substring(0, 2).toUpperCase()}
               </div>
            ) : (
              <UserCircle className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          
          {isExpanded && (
            <div className="flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-2">
              <span className="font-semibold text-sm truncate text-foreground">{profile?.full_name || t('common.student')}</span>
              <span className="text-xs text-muted-foreground truncate">{profile?.grade_levels || t('common.student')}</span>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-4 py-2 overflow-y-auto scrollbar-none">
        <div className={cn("text-xs font-semibold text-muted-foreground mb-2 px-2 uppercase tracking-wider", !isExpanded && "hidden")}>
          {t('student.menu')}
        </div>
        {navItems.map((item) => <NavLink key={item.href} item={item} />)}
      </nav>

      <div className="p-4 border-t bg-gradient-to-t from-muted/20 to-transparent">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={async () => { clearStudentSession(); await signOut(); navigate('/'); }}
                className={cn(
                  "w-full flex items-center h-11 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors rounded-xl",
                  isExpanded ? "justify-start gap-3 px-4" : "justify-center px-0"
                )}
              >
                <LogOut className="h-5 w-5" />
                {isExpanded && <span className="font-medium animate-in fade-in">Sign Out</span>}
              </Button>
            </TooltipTrigger>
            {!isExpanded && (
              <TooltipContent side="right" className="bg-destructive text-destructive-foreground border-destructive font-bold ml-2">
                Sign Out
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </aside>
  );
};

export default StudentSidebar;
