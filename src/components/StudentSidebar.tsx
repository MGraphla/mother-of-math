import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Home, BookCheck, LogOut, Award, UserCircle, Megaphone, BookOpen, ChevronRight, Brain
} from "lucide-react";
import { useAuth, UserProfile } from "@/context/AuthContext";
import { clearStudentSession } from "@/services/studentService";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

const MotionLink = motion(Link);

interface StudentSidebarProps {
  profile: UserProfile;
  isExpanded: boolean;
  onLinkClick?: () => void;
  /** When true (e.g. inside mobile Sheet), skip fixed positioning so the panel scrolls correctly */
  embedded?: boolean;
}

const StudentSidebar = ({ profile, isExpanded, onLinkClick, embedded }: StudentSidebarProps) => {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const navItems = [
    { name: t('sidebar.dashboard'), href: "/student", icon: <Home className="h-5 w-5 shrink-0" />, description: t('student.desc.overview') },
    { name: t('sidebar.assignments'), href: "/student/assignments", icon: <BookCheck className="h-5 w-5 shrink-0" />, description: t('student.desc.homework') },
    { name: t('common.progress'), href: "/student/progress", icon: <Award className="h-5 w-5 shrink-0" />, description: t('student.desc.grades') },
    { name: t('sidebar.announcements'), href: "/student/announcements", icon: <Megaphone className="h-5 w-5 shrink-0" />, description: t('student.desc.updates') },
    { name: "My AI Feedback", href: "/student/analysis", icon: <Brain className="h-5 w-5 shrink-0" />, description: "View your AI-graded work" },
    { name: t('sidebar.resources'), href: "/student/resources", icon: <BookOpen className="h-5 w-5 shrink-0" />, description: t('student.desc.library') },
    { name: t('nav.profile'), href: "/student/profile", icon: <UserCircle className="h-5 w-5 shrink-0" />, description: t('student.desc.myInfo') },
  ];

  const NavLink = ({ item }: { item: typeof navItems[number] }) => {
    const isActive = location.pathname === item.href;

    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <MotionLink
              to={item.href}
              onClick={onLinkClick}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 520, damping: 28 }}
              className={cn(
                "group mb-1 flex h-12 min-h-[44px] items-center rounded-xl px-3 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white/40 touch-manipulation active:opacity-90",
                isExpanded ? "justify-start gap-3" : "justify-center",
                isActive
                  ? "bg-white font-semibold text-primary shadow-md"
                  : "text-primary-foreground/90 hover:bg-white/15"
              )}
            >
              <div className={cn(
                "flex items-center justify-center transition-colors",
                isActive ? "text-primary" : "text-primary-foreground"
              )}>
                {item.icon}
              </div>

              <div className={cn(
                "overflow-hidden transition-all duration-300 flex-1",
                !isExpanded && "w-0 opacity-0 hidden"
              )}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm leading-tight">{item.name}</span>
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 0.6, x: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="inline-flex"
                    >
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    </motion.span>
                  )}
                </div>
              </div>
            </MotionLink>
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
    <aside
      className={cn(
        "flex min-h-0 flex-col bg-primary text-primary-foreground shadow-xl transition-all duration-300 ease-in-out",
        embedded
          ? "h-full w-full"
          : cn(
              "fixed left-0 top-0 z-40 h-dvh max-h-dvh lg:h-screen",
              isExpanded ? "w-72" : "w-[80px]"
            )
      )}
    >
      <div
        className={cn(
          "flex items-center h-20 px-4 border-b border-white/15 shrink-0",
          isExpanded ? "justify-between" : "justify-center"
        )}
      >
        <div className={cn("flex items-center gap-3 min-w-0", !isExpanded && "justify-center")}>
          <motion.div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/20 text-lg font-bold text-primary-foreground shadow-inner"
            initial={{ scale: 0.85, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
          >
            M
          </motion.div>
          {isExpanded && (
            <div className="flex flex-col min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
              <span className="font-bold text-lg leading-tight tracking-tight truncate">Math Mama</span>
              <span className="text-[10px] text-primary-foreground/70 uppercase tracking-widest mt-0.5 font-semibold">{t('student.portal')}</span>
            </div>
          )}
        </div>
      </div>

      <div
        className={cn(
          "mx-3 mt-5 mb-4 p-3 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm transition-all duration-300",
          !isExpanded && "bg-transparent border-none p-0 mx-2 flex justify-center mb-5"
        )}
      >
        <div className={cn("flex items-center gap-3", !isExpanded && "justify-center")}>
          <div
            className={cn(
              "relative shrink-0 rounded-full flex items-center justify-center overflow-hidden border-2 border-white/25 shadow-sm",
              isExpanded ? "w-10 h-10" : "w-10 h-10"
            )}
          >
            {profile?.full_name ? (
              <div className="w-full h-full bg-white/20 flex items-center justify-center text-primary-foreground font-bold text-sm">
                {profile.full_name.substring(0, 2).toUpperCase()}
              </div>
            ) : (
              <UserCircle className="h-6 w-6 text-primary-foreground/80" />
            )}
          </div>

          {isExpanded && (
            <div className="flex flex-col overflow-hidden min-w-0 animate-in fade-in slide-in-from-left-2">
              <span className="font-semibold text-sm truncate">{profile?.full_name || t('common.student')}</span>
              <span className="text-xs text-primary-foreground/70 truncate">{profile?.grade_levels || t('common.student')}</span>
            </div>
          )}
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-y-contain px-3 py-2 scrollbar-none pb-safe">
        {isExpanded && (
          <div className="text-[10px] font-semibold text-primary-foreground/55 mb-2 px-2 uppercase tracking-wider">
            {t('student.menu')}
          </div>
        )}
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/15 bg-black/5 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div whileTap={{ scale: 0.98 }} className="w-full">
              <Button
                variant="ghost"
                onClick={async () => { clearStudentSession(); await signOut(); navigate('/'); }}
                className={cn(
                  "flex h-11 min-h-[44px] w-full items-center text-primary-foreground/95 transition-colors hover:bg-white/15 hover:text-primary-foreground rounded-xl touch-manipulation",
                  isExpanded ? "justify-start gap-3 px-4" : "justify-center px-0"
                )}
              >
                <LogOut className="h-5 w-5 shrink-0" />
                {isExpanded && <span className="font-medium animate-in fade-in">Sign Out</span>}
              </Button>
              </motion.div>
            </TooltipTrigger>
            {!isExpanded && (
              <TooltipContent side="right" className="bg-popover text-popover-foreground border font-medium ml-2">
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
