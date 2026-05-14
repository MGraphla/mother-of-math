import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  Users,
  MessagesSquare,
  BookOpen,
  UploadCloud,
  AlertTriangle,
  Image as ImageIcon,
  ClipboardList,
  Building2,
  Sparkles,
  LogOut,
  Menu,
  X,
  Eye,
  Globe2,
} from 'lucide-react';
import { monitorLogout, getMonitorSession } from '../auth/monitorAuth';

const navItems = [
  { to: '/monitor/overview',       label: 'Overview',          icon: LayoutDashboard },
  { to: '/monitor/activity',       label: 'Activity Log',      icon: Activity },
  { to: '/monitor/teachers',       label: 'Teachers',          icon: Users },
  { to: '/monitor/chatbot',        label: 'Chatbot',           icon: MessagesSquare },
  { to: '/monitor/lesson-plans',   label: 'Lesson Plans',      icon: BookOpen },
  { to: '/monitor/uploads',        label: 'Student Uploads',   icon: UploadCloud },
  { to: '/monitor/error-analysis', label: 'Error Analysis',    icon: AlertTriangle },
  { to: '/monitor/images',         label: 'Image Generation',  icon: ImageIcon },
  { to: '/monitor/assignments',    label: 'Assignments',       icon: ClipboardList },
  { to: '/monitor/schools',        label: 'Schools & Geo',     icon: Building2 },
  { to: '/monitor/ai-insights',    label: 'AI Insights',       icon: Sparkles },
];

const MonitorLayout = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const session = getMonitorSession();

  const handleLogout = () => {
    monitorLogout();
    navigate('/monitor/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100">
      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-slate-800/80 bg-[#0b1020]/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-slate-300 hover:bg-slate-800"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-cyan-400" />
          <span className="text-sm font-semibold tracking-wide">MoM · Monitor</span>
        </div>
        <span className="w-9" />
      </div>

      <div className="flex">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex h-screen sticky top-0 w-72 flex-col border-r border-slate-800/70 bg-gradient-to-b from-[#0a0f1f] to-[#0b1020]">
          <SidebarBranding />
          <SidebarNav />
          <SidebarFooter session={session} onLogout={handleLogout} />
        </aside>

        {/* Sidebar — mobile drawer */}
        {mobileOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 flex"
            onClick={() => setMobileOpen(false)}
          >
            <div className="absolute inset-0 bg-black/60" />
            <aside
              className="relative w-72 max-w-[80vw] h-full flex flex-col border-r border-slate-800/70 bg-[#0a0f1f]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pt-5">
                <SidebarBranding compact />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
              <SidebarFooter session={session} onLogout={handleLogout} />
            </aside>
          </div>
        )}

        {/* Main */}
        <main className="flex-1 min-w-0">
          <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

const SidebarBranding = ({ compact = false }: { compact?: boolean }) => (
  <div className={compact ? '' : 'px-6 pt-7 pb-5'}>
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-lg shadow-cyan-500/20">
        <Eye className="h-5 w-5 text-white" />
      </div>
      <div>
        <div className="text-sm font-semibold tracking-wide text-white">Mother of Math</div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-400/80">Partner Monitor</div>
      </div>
    </div>
  </div>
);

const SidebarNav = ({ onNavigate }: { onNavigate?: () => void }) => (
  <nav className="flex-1 overflow-y-auto px-3 py-2">
    <ul className="space-y-1">
      {navItems.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all',
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/15 to-emerald-500/10 text-white border border-cyan-500/20'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
              ].join(' ')
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);

const SidebarFooter = ({
  session,
  onLogout,
}: {
  session: ReturnType<typeof getMonitorSession>;
  onLogout: () => void;
}) => (
  <div className="border-t border-slate-800/70 px-4 py-4">
    <div className="mb-3 rounded-lg bg-slate-800/40 px-3 py-2.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500">
        <Globe2 className="h-3 w-3" />
        <span>Signed in as</span>
      </div>
      <div className="mt-0.5 truncate text-sm text-slate-200">
        {session?.partnerLabel ?? 'Implementing Partner'}
      </div>
      <div className="text-[11px] text-slate-500">Read-only access</div>
    </div>
    <button
      onClick={onLogout}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white"
    >
      <LogOut className="h-4 w-4" /> Sign out
    </button>
  </div>
);

export default MonitorLayout;
