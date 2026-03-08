import { useEffect } from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import { isAdminAuthenticated } from "@/services/adminAuth";
import AdminSidebar from "./AdminSidebar";
import AdminNotificationBell from "./admin/AdminNotificationBell";
import { AdminDateRangeProvider } from "@/context/AdminDateRangeContext";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const AdminDashboardLayout = () => {
  const navigate = useNavigate();

  // Check admin authentication
  useEffect(() => {
    if (!isAdminAuthenticated()) {
      navigate("/admin/login", { replace: true });
    }
  }, [navigate]);

  if (!isAdminAuthenticated()) {
    return null;
  }

  return (
    <AdminDateRangeProvider>
      <div className="min-h-screen bg-gray-950 flex">
        <AdminSidebar />
        <div className="flex-1 ml-64">
          {/* Top Header Bar */}
          <header className="sticky top-0 z-30 h-16 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-6 flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              {/* Search */}
              <div className="relative w-[300px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search..."
                  className="pl-9 bg-gray-800/50 border-gray-700 text-sm w-full focus:border-indigo-500/50"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Live indicator */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-gray-400">Live</span>
              </div>
              {/* Notification Bell */}
              <AdminNotificationBell />
            </div>
          </header>
          <main className="p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminDateRangeProvider>
  );
};

export default AdminDashboardLayout;
