import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home, BookCheck, Upload, Settings, LogOut, Award, FileText, ChevronsLeft, ChevronsRight
} from "lucide-react";
import { UserProfile } from "@/context/AuthContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface StudentSidebarProps {
  profile: UserProfile;
  isExpanded: boolean;
  onLinkClick?: () => void;
}

const StudentSidebar = ({ profile, isExpanded, onLinkClick }: StudentSidebarProps) => {
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", href: "/student", icon: <Home className="h-5 w-5" />, description: "Your personal dashboard" },
    { name: "My Assignments", href: "/student/assignments", icon: <BookCheck className="h-5 w-5" />, description: "View and complete assignments" },
    { name: "Submit Work", href: "/student/upload", icon: <Upload className="h-5 w-5" />, description: "Upload your completed work" },
    { name: "My Progress", href: "/student/progress", icon: <Award className="h-5 w-5" />, description: "View your learning progress" },
    { name: "Settings", href: "/student/settings", icon: <Settings className="h-5 w-5" />, description: "Manage your account" }
  ];

  const NavLink = ({ item }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={item.href}
          onClick={onLinkClick}
          className={cn(
            "flex items-center h-12 px-3 rounded-lg text-slate-700 transition-colors",
            isExpanded ? "justify-start gap-4" : "justify-center",
            location.pathname === item.href ? "bg-indigo-100 text-indigo-900" : "hover:bg-indigo-50"
          )}
        >
          <div className={cn(
            "p-2 rounded-md",
            location.pathname === item.href ? "bg-indigo-200 text-indigo-700" : "bg-slate-100 text-slate-500"
          )}>
            {item.icon}
          </div>
          <div className={cn("overflow-hidden transition-all duration-200", !isExpanded && "w-0")}>
            <div className="font-medium text-sm truncate">{item.name}</div>
            <div className="text-xs text-slate-500 truncate">{item.description}</div>
          </div>
        </Link>
      </TooltipTrigger>
      {!isExpanded && (
        <TooltipContent side="right" className="bg-slate-800 text-white border-0">
          <p>{item.name}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );

  return (
    <aside className={cn(
      "fixed top-0 left-0 h-full border-r bg-white flex flex-col transition-all duration-300 ease-in-out z-40",
      isExpanded ? "w-64" : "w-20"
    )}>
      <div className={cn("flex items-center h-16 px-4", isExpanded ? "justify-between" : "justify-center")}>
        <div className={cn("flex items-center gap-2", !isExpanded && "hidden")}>
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
            M
          </div>
          <div>
            <span className="font-bold text-lg text-indigo-900">Math Mama</span>
            <div className="text-xs text-indigo-700">Student Portal</div>
          </div>
        </div>
      </div>

      <div className={cn("mx-2 mb-4 p-3 bg-white rounded-lg shadow-sm border", !isExpanded && "hidden")}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-medium">
            {profile?.full_name?.substring(0, 2).toUpperCase() || "ST"}
          </div>
          <div>
            <div className="font-medium text-sm truncate">{profile?.full_name || "Student"}</div>
            <div className="text-xs text-muted-foreground truncate">{profile?.grade_level || "Grade Level"}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-1 p-2">
        {navItems.map((item) => <NavLink key={item.href} item={item} />)}
      </nav>

      <div className="p-2 border-t">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/dashboard/help"
              className={cn(
                "w-full flex items-center h-10 px-3 rounded-lg text-slate-600 hover:bg-gray-100",
                isExpanded ? "justify-start gap-3" : "justify-center"
              )}
            >
              <FileText className="h-5 w-5" />
              <span className={cn("truncate transition-all duration-200", !isExpanded && "w-0")}>Help & Support</span>
            </Link>
          </TooltipTrigger>
          {!isExpanded && (
            <TooltipContent side="right" className="bg-slate-800 text-white border-0">
              Help & Support
            </TooltipContent>
          )}
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/sign-out"
              className={cn(
                "w-full flex items-center h-10 px-3 rounded-lg text-slate-600 hover:bg-gray-100",
                isExpanded ? "justify-start gap-3" : "justify-center"
              )}
            >
              <LogOut className="h-5 w-5" />
              <span className={cn("truncate transition-all duration-200", !isExpanded && "w-0")}>Sign Out</span>
            </Link>
          </TooltipTrigger>
          {!isExpanded && (
            <TooltipContent side="right" className="bg-slate-800 text-white border-0">
              Sign Out
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  );
};

export default StudentSidebar;
