import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import DashboardSidebar from "./DashboardSidebar";
import { Search, Bell, User, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DashboardLayout = () => {
  const { profile, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isSidebarExpanded, setSidebarExpanded] = useState(true);
  const [isSheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/sign-in");
    }
  }, [isAuthenticated, navigate]);

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="hidden lg:block">
        <DashboardSidebar
          profile={profile}
          isExpanded={isSidebarExpanded}
          setExpanded={setSidebarExpanded}
        />
      </div>

      <div
        className={cn(
          "flex flex-col transition-all duration-300 ease-in-out",
          isSidebarExpanded ? "lg:ml-72" : "lg:ml-20"
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
                <DashboardSidebar
                  profile={profile}
                  isExpanded={true}
                  setExpanded={() => {}}
                  onLinkClick={() => setSheetOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={() => setSidebarExpanded(!isSidebarExpanded)}>
              <Menu className="h-6 w-6" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                className="pl-10 pr-4 py-2 w-full text-md bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50"
                type="search"
                placeholder="Search..."
              />
            </div>
            <Button variant="ghost" size="icon">
              <Bell className="text-gray-600 w-6 h-6 hover:text-primary transition-colors" />
            </Button>
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                <User className="w-6 h-6" />
              </div>
              <div className="ml-3 hidden md:block">
                <p className="text-sm font-semibold text-gray-800">{profile.full_name}</p>
                <p className="text-xs text-gray-500">{profile.email}</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
