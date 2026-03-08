import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import StudentSidebar from "./StudentSidebar";
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getStudentSession } from "@/services/studentService";
import type { Student } from "@/services/studentService";
import NotificationBell from "./NotificationBell";
import { OfflineBanner, OfflineStatusBadge } from "./OfflineIndicator";

const StudentDashboardLayout = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [isSidebarExpanded, setSidebarExpanded] = useState(true);
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [studentSession, setStudentSession] = useState<Student | null>(null);

  useEffect(() => {
    const session = getStudentSession();
    if (session) {
      setStudentSession(session);
    } else if (!profile) {
      // Neither a regular auth user nor a student session — redirect
      navigate("/student-login", { replace: true });
    }
  }, [profile, navigate]);

  // Build a minimal profile-like object for the sidebar
  const displayProfile = profile || (studentSession ? {
    id: studentSession.id,
    full_name: studentSession.full_name,
    role: 'student' as const,
    email: studentSession.parent_email || '',
    grade_levels: studentSession.grade_level,
    created_at: studentSession.created_at,
  } : null);

  if (!displayProfile) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="hidden lg:block">
        <StudentSidebar
          profile={displayProfile as any}
          isExpanded={isSidebarExpanded}
        />
      </div>

      <div
        className={cn(
          "flex flex-col transition-all duration-300 ease-in-out",
          isSidebarExpanded ? "lg:ml-64" : "lg:ml-20"
        )}
      >
        <header className="flex justify-between items-center h-16 px-4 sm:px-6 bg-white/80 backdrop-blur-sm border-b sticky top-0 z-30">
          <div className="flex items-center">
            <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild className="lg:hidden mr-2">
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 border-r-0">
                <StudentSidebar
                  profile={displayProfile as any}
                  isExpanded={true}
                  onLinkClick={() => setSheetOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={() => setSidebarExpanded(!isSidebarExpanded)}>
              <Menu className="h-6 w-6" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <OfflineStatusBadge />
            <NotificationBell isTeacher={false} />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
        <OfflineBanner />
      </div>
    </div>
  );
};

export default StudentDashboardLayout;