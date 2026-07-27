import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  Users,
  UsersRound,
  MessagesSquare,
  BookOpen,
  UploadCloud,
  AlertTriangle,
  Image as ImageIcon,
  ClipboardList,
  Building2,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import { monitorLogout, getMonitorSession } from '../auth/monitorAuth';
import { QedaGlyph, QEDA_BRAND } from './QedaBrand';
import { MAMA_MATH_LOGO_URL } from '../branding';

const navItems = [
  { to: '/monitor/overview',       label: 'Overview',          icon: LayoutDashboard },
  { to: '/monitor/activity',       label: 'Activity Log',      icon: Activity },
  { to: '/monitor/teachers',       label: 'Teachers',          icon: Users },
  { to: '/monitor/learners',       label: 'Learners & parents', icon: UsersRound },
  { to: '/monitor/chatbot',        label: 'Chatbot',           icon: MessagesSquare },
  { to: '/monitor/lesson-plans',   label: 'Lesson Plans',      icon: BookOpen },
  { to: '/monitor/uploads',        label: 'Student Uploads',   icon: UploadCloud },
  { to: '/monitor/error-analysis', label: 'Error Analysis',    icon: AlertTriangle },
  { to: '/monitor/images',         label: 'Image Generation',  icon: ImageIcon },
  { to: '/monitor/assignments',    label: 'Assignments',       icon: ClipboardList },
  { to: '/monitor/schools',        label: 'Schools & Geo',     icon: Building2 },
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
    <div className="min-h-screen bg-[#0a1410] text-slate-100">
      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-emerald-900/40 bg-[#0a1410]/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-slate-300 hover:bg-emerald-900/30"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center px-2">
          <QedaGlyph
            size="md"
            src={MAMA_MATH_LOGO_URL}
            className="min-w-0 [&_img]:max-h-10 [&_img]:max-w-[min(220px,58vw)]"
          />
        </div>
        <span className="w-9" />
      </div>

      <div className="flex">
        {/* Sidebar — desktop */}
        <aside className="hidden lg:flex h-screen sticky top-0 w-72 flex-col border-r border-emerald-900/30 bg-gradient-to-b from-[#08120e] via-[#0a1612] to-[#0a1410]">
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
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <aside
              className="relative w-72 max-w-[82vw] h-full flex flex-col border-r border-emerald-900/30 bg-[#08120e]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 px-5 pt-5">
                <div className="min-w-0 flex-1">
                  <QedaGlyph size="md" src={MAMA_MATH_LOGO_URL} className="[&_img]:max-h-12 [&_img]:max-w-full" />
                  <div className="mt-2 text-[10px] font-semibold tracking-[0.12em] text-emerald-500/70">
                    {QEDA_BRAND.product}
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-emerald-900/30"
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

const SidebarBranding = () => (
  <div className="border-b border-emerald-900/20 px-6 pb-5 pt-7">
    <QedaGlyph
      size="lg"
      src={MAMA_MATH_LOGO_URL}
      className="w-full justify-start [&_img]:max-h-[4.5rem] [&_img]:w-auto [&_img]:max-w-full"
    />
    <div className="mt-3 text-[10px] font-semibold tracking-[0.12em] text-emerald-500/65">
      {QEDA_BRAND.product}
    </div>
  </div>
);

const SidebarNav = ({ onNavigate }: { onNavigate?: () => void }) => (
  <nav className="flex-1 overflow-y-auto px-3 py-3">
    <ul className="space-y-1">
      {navItems.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              [
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all',
                isActive
                  ? 'bg-gradient-to-r from-emerald-500/20 to-amber-400/5 text-white shadow-inner ring-1 ring-emerald-500/30'
                  : 'text-slate-400 hover:bg-emerald-900/20 hover:text-slate-100',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-to-b from-emerald-400 to-amber-400" />
                )}
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </>
            )}
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
  <div className="border-t border-emerald-900/30 px-4 py-4">
    <div className="mb-3 rounded-lg bg-emerald-900/15 px-3 py-2.5 ring-1 ring-emerald-500/10">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-emerald-300/70">
        <ShieldCheck className="h-3 w-3" />
        <span>Signed in as</span>
      </div>
      <div className="mt-0.5 truncate text-sm text-slate-100">
        {session?.partnerLabel ?? QEDA_BRAND.fullName}
      </div>
    </div>
    <button
      onClick={onLogout}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-900/40 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-emerald-900/30 hover:text-white"
    >
      <LogOut className="h-4 w-4" /> Sign out
    </button>
    <div className="mt-3 text-center text-[10px] text-slate-600">
      Powered by <span className="text-emerald-400">Mother of Math</span>
    </div>
  </div>
);

export default MonitorLayout;
