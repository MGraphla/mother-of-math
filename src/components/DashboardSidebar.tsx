import { useAuth } from "@/context/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home, BookOpen, Upload, Settings, LogOut, Users, ClipboardList, UserPlus, BookCheck, UserCircle, UsersRound, ChevronsLeft, ChevronsRight, BrainCircuit, Sparkles
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

const DashboardSidebar = ({ profile, isExpanded, setExpanded, onLinkClick }) => {
  const location = useLocation();
  const isTeacher = profile?.role === "teacher";
  const isParent = profile?.role === "parent";
  const { signOut } = useAuth();

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: <Home className="h-5 w-5" /> },
    ...(isTeacher ? [
      { name: "Student Management", href: "/dashboard/students", icon: <Users className="h-5 w-5" /> },
      { name: "Student Accounts", href: "/dashboard/student-accounts", icon: <UserPlus className="h-5 w-5" /> },
      { name: "Assignments", href: "/dashboard/assignments", icon: <ClipboardList className="h-5 w-5" /> },
      { name: "Lesson Plans", href: "/dashboard/lessons", icon: <BookOpen className="h-5 w-5" /> },
      { name: "Story Lesson Plans", href: "/dashboard/story-lessons", icon: <Sparkles className="h-5 w-5" /> },
      { name: "Upload Work", href: "/dashboard/upload", icon: <Upload className="h-5 w-5" /> },
      { name: "Teacher Training", href: "/dashboard/teacher-training", icon: <BrainCircuit className="h-5 w-5" /> }
    ] : isParent ? [
      { name: "Parent Dashboard", href: "/dashboard/parent", icon: <UserCircle className="h-5 w-5" /> },
      { name: "Children", href: "/dashboard/parent/children", icon: <UsersRound className="h-5 w-5" /> }
    ] : [
      { name: "My Assignments", href: "/dashboard/my-assignments", icon: <BookCheck className="h-5 w-5" /> },
      { name: "Upload Work", href: "/dashboard/upload", icon: <Upload className="h-5 w-5" /> }
    ]),
    { name: "Settings", href: "/dashboard/settings", icon: <Settings className="h-5 w-5" /> }
  ];

  const NavLink = ({ item }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={item.href}
          onClick={onLinkClick}
          className={cn(
            "flex items-center h-10 px-3 rounded-lg text-white/80 transition-colors",
            isExpanded ? "justify-start gap-3" : "justify-center",
            location.pathname === item.href ? "bg-white/20" : "hover:bg-white/10"
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
      "fixed top-0 left-0 h-full bg-gradient-to-b from-primary to-green-700 text-white flex flex-col transition-all duration-300 ease-in-out z-40",
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
        <div className={cn("flex items-center p-2", !isExpanded && "justify-center")}>
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-primary font-bold text-lg flex-shrink-0">
            {profile?.fullName?.charAt(0) || 'U'}
          </div>
          <div className={cn("ml-3 overflow-hidden transition-all duration-200", !isExpanded && "w-0")}>
            <div className="font-bold text-sm truncate">{profile?.fullName?.split(' ')[0] || "User"}</div>
            <div className="text-xs text-gray-300 truncate">{profile?.email || ""}</div>
          </div>
        </div>


        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={signOut} className={cn('w-full flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-primary/20', isExpanded ? "justify-start gap-3" : "justify-center")}>
              <LogOut className="h-5 w-5" />
              <span className={cn("truncate transition-all duration-200", !isExpanded && "w-0")}>Logout</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Logout</TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
};


export default DashboardSidebar;
