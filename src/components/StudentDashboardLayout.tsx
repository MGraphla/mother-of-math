import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import StudentSidebar from "./StudentSidebar";
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getStudentSession, recordStudentPortalActivity } from "@/services/studentService";
import type { Learner } from "@/services/studentService";
import NotificationBell from "./NotificationBell";
import { OfflineBanner, OfflineStatusBadge } from "./OfflineIndicator";
import { LoadingAnimation } from "@/components/ui/LoadingAnimation";

const pageEase = [0.22, 1, 0.36, 1] as const;
const PORTAL_PING_MS = 30 * 60 * 1000;

const StudentDashboardLayout = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarExpanded, setSidebarExpanded] = useState(true);
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [studentSession, setStudentSession] = useState<Learner | null>(null);

  useEffect(() => {
    const session = getStudentSession();
    if (session) {
      setStudentSession(session);
    } else if (!profile) {
      // Neither a regular auth user nor a student session — redirect
      navigate("/student-login", { replace: true });
    }
  }, [profile, navigate]);

  useEffect(() => {
    const s = getStudentSession();
    if (!s?.access_token) return;
    const key = `portal_activity_ping_${s.id}`;
    const last = Number(sessionStorage.getItem(key) || "0");
    const now = Date.now();
    if (now - last < PORTAL_PING_MS) return;
    sessionStorage.setItem(key, String(now));
    recordStudentPortalActivity(s.id, s.access_token);
  }, [location.pathname]);

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
    return <LoadingAnimation fullScreen message="Loading dashboard..." />;
  }

  return (
    <div className="flex min-h-dvh overflow-x-hidden bg-muted/30">
      <div className="hidden lg:block">
        <StudentSidebar
          profile={displayProfile as any}
          isExpanded={isSidebarExpanded}
        />
      </div>

      <div
        className={cn(
          "flex min-h-dvh min-h-0 w-full min-w-0 max-w-[100vw] flex-1 flex-col transition-[margin] duration-300 ease-in-out",
          /* Sidebar is w-72 when expanded, w-[80px] when collapsed — margins must match or content sits under the rail */
          isSidebarExpanded ? "lg:ml-72" : "lg:ml-20",
          "lg:border-l lg:border-border/60 lg:bg-muted/25"
        )}
      >
        <header className="sticky top-0 z-30 flex min-h-[3.5rem] shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-background/95 px-2 pt-[max(0.35rem,env(safe-area-inset-top,0px))] pb-2 shadow-sm backdrop-blur-md sm:px-4 sm:py-3 lg:px-5 lg:pt-3">
          <div className="flex min-w-0 items-center">
            <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild className="lg:hidden mr-1">
                <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 touch-manipulation">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="h-dvh max-h-dvh w-[min(20rem,calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right)))] max-w-[min(20rem,92vw)] border-r-0 p-0 px-safe pt-safe"
              >
                <StudentSidebar
                  profile={displayProfile as any}
                  isExpanded={true}
                  embedded
                  onLinkClick={() => setSheetOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-11 w-11 shrink-0 lg:inline-flex"
              onClick={() => setSidebarExpanded(!isSidebarExpanded)}
            >
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle sidebar width</span>
            </Button>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <OfflineStatusBadge />
            <NotificationBell isTeacher={false} />
          </div>
        </header>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden px-safe py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] xs:px-3 sm:px-5 sm:py-6 lg:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: pageEase }}
              className="flex min-h-0 min-w-0 flex-1 flex-col"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
        <OfflineBanner />
      </div>
    </div>
  );
};

export default StudentDashboardLayout;