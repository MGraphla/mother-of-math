import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import StudentSidebar from "./StudentSidebar";
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const StudentDashboardLayout = () => {
  const { profile, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isSidebarExpanded, setSidebarExpanded] = useState(true);
  const [isSheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/student-login");
    } else if (profile && profile.role !== 'student') {
      navigate("/dashboard");
    }
  }, [isAuthenticated, profile, navigate]);

  if (!profile) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="hidden lg:block">
        <StudentSidebar
          profile={profile}
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
                  profile={profile}
                  isExpanded={true}
                  onLinkClick={() => setSheetOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={() => setSidebarExpanded(!isSidebarExpanded)}>
              <Menu className="h-6 w-6" />
            </Button>
          </div>
          {/* Header content can be added here if needed */}
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default StudentDashboardLayout;