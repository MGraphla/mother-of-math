import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import DashboardSidebar from './DashboardSidebar';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ParentDashboardLayout = () => {
  const { profile } = useAuth();
  const [isSidebarExpanded, setSidebarExpanded] = useState(true);
  const [isSheetOpen, setSheetOpen] = useState(false);

  if (!profile) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    );
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
          'flex flex-col transition-all duration-300 ease-in-out',
          isSidebarExpanded ? 'lg:ml-72' : 'lg:ml-20'
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
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ParentDashboardLayout;
