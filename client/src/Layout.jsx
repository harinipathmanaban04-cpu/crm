import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, UsersRound, Target, ListChecks, Contact, GraduationCap, Receipt, BarChart3, History, UserCircle, PhoneCall, Menu, Search, LogOut, ChevronsLeft, ChevronsRight, Wifi, WifiOff, X } from 'lucide-react';
import { useAuth } from './auth.jsx';
import { useSocket } from './socket.jsx';
import { LookupProvider } from './lookups.jsx';
import { roleLabel, CardSelectionProvider } from './ui.jsx';
import api from './api';

const NAV = {
  superadmin: [['/', 'Dashboard', LayoutDashboard], ['/accounts', 'Accounts', Users], ['/teams', 'Teams', UsersRound], ['/leads', 'Leads', Target], ['/tasks', 'Tasks', ListChecks], ['/customers', 'All Customers', Contact], ['/admissions', 'Courses & Admissions', GraduationCap], ['/invoices', 'Invoices & Payments', Receipt], ['/reports', 'Reports', BarChart3], ['/activity', 'Activity History', History], ['/profile', 'My Profile', UserCircle]],
  admin: [['/', 'Dashboard', LayoutDashboard], ['/leads', 'Leads', Target], ['/teams', 'My Team', UsersRound], ['/tasks', 'Tasks', ListChecks], ['/customers', 'Customers', Contact], ['/admissions', 'Courses & Admissions', GraduationCap], ['/invoices', 'Invoices & Payments', Receipt], ['/reports', 'Team Reports', BarChart3], ['/activity', 'Activity History', History], ['/profile', 'My Profile', UserCircle]],
  sales: [['/', 'Dashboard', LayoutDashboard], ['/leads', 'My Leads', Target], ['/tasks', 'My Tasks', ListChecks], ['/customers', 'My Customers', Contact], ['/followups', 'Follow-ups', PhoneCall], ['/admissions', 'Courses & Admissions', GraduationCap], ['/invoices', 'Payment Updates', Receipt], ['/reports', 'My Performance', BarChart3], ['/profile', 'My Profile', UserCircle]],
};

function GlobalSearch() {
  const [q, setQ] = useState(''); const [res, setRes] = useState(null); const nav = useNavigate(); const box = useRef();
  useEffect(() => { if (q.trim().length < 2) { setRes(null); return; } const t = setTimeout(() => api.get('/search', { params: { q } }).then((r) => setRes(r.data)).catch(() => {}), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    const h = (e) => !box.current?.contains(e.target) && setRes(null);
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('touchstart', h);
    };
  }, []);
  const go = (p) => { setRes(null); setQ(''); nav(p); };
  return (
    <div className="relative flex-1 max-w-xs sm:max-w-md min-w-[120px]" ref={box}>
      <Search className="absolute left-2.5 sm:left-3 top-2.5 h-4 w-4 text-gray-400" />
      <input className="input pl-8 sm:pl-9 py-1.5 sm:py-2 text-xs sm:text-sm" placeholder="Search leads…" value={q} onChange={(e) => setQ(e.target.value)} />
      {res && (
        <div className="card absolute left-0 right-0 top-11 z-30 max-h-80 overflow-y-auto p-2 text-sm shadow-xl">
          {!res.leads.length && !res.customers.length && <p className="p-3 text-gray-400 text-xs">No results</p>}
          {res.leads.map((l) => <button key={l._id} className="block w-full rounded px-3 py-2 text-left hover:bg-gray-100 text-xs sm:text-sm" onClick={() => go('/leads')}><b>{l.name}</b> <span className="text-gray-400">{l.leadId} · lead</span></button>)}
          {res.customers.map((c) => <button key={c._id} className="block w-full rounded px-3 py-2 text-left hover:bg-gray-100 text-xs sm:text-sm" onClick={() => go('/customers')}><b>{c.name}</b> <span className="text-gray-400">{c.phone} · customer</span></button>)}
        </div>
      )}
    </div>
  );
}

function DesktopSidebar({ items }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const hoverTimeoutRef = useRef(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 120);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const isExpanded = isPinned || isHovered;

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocusCapture={handleMouseEnter}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsHovered(false);
        }
      }}
      className={`flex h-full flex-col border-r border-gray-200 bg-white transition-[width] duration-300 ease-in-out select-none shadow-sm ${
        isExpanded ? 'w-[268px]' : 'w-[72px]'
      }`}
    >
      {/* Header Logo & Brand */}
      <div className="flex h-16 items-center border-b border-gray-100 px-4 shrink-0 overflow-hidden">
        <img
          src="/logo-icon.png"
          alt="Eco Friendly Tech Solutions"
          className="h-10 w-10 object-contain shrink-0"
        />
        <div
          className={`leading-tight min-w-0 whitespace-nowrap transition-all duration-300 ease-in-out pl-3.5 ${
            isExpanded
              ? 'opacity-100 max-w-xs translate-x-0'
              : 'opacity-0 max-w-0 -translate-x-3 pointer-events-none overflow-hidden pl-0'
          }`}
        >
          <p className="text-base font-bold text-gray-900 leading-tight">Eco Friendly Tech</p>
          <p className="text-xs font-semibold tracking-wide" style={{ color: '#23AAA7' }}>
            Solutions CRM
          </p>
        </div>
      </div>

      {/* Nav items list */}
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2.5 py-3">
        {items.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `group flex items-center rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-coral-50 text-coral-600 font-semibold shadow-xs'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon className="h-6 w-6 shrink-0 transition-transform duration-200 group-hover:scale-105" />
            <span
              className={`whitespace-nowrap font-medium text-[14.5px] transition-all duration-300 ease-in-out pl-3.5 ${
                isExpanded
                  ? 'opacity-100 max-w-xs translate-x-0'
                  : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none overflow-hidden pl-0'
              }`}
            >
              {label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom Pin / Collapse Toggle */}
      <div className="border-t border-gray-100 p-2 shrink-0">
        <button
          type="button"
          onClick={() => setIsPinned(!isPinned)}
          title={isPinned ? 'Auto-collapse on hover' : 'Keep sidebar open'}
          className="flex w-full items-center rounded-lg px-2.5 py-2 text-xs font-medium text-gray-400 hover:bg-brand-50 hover:text-brand-600 transition-colors"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center">
            {isPinned ? <ChevronsLeft className="h-5 w-5" /> : <ChevronsRight className="h-5 w-5" />}
          </div>
          <span
            className={`whitespace-nowrap transition-all duration-300 ease-in-out pl-3.5 ${
              isExpanded
                ? 'opacity-100 max-w-xs translate-x-0'
                : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none overflow-hidden pl-0'
            }`}
          >
            {isPinned ? 'Auto-collapse on hover' : 'Keep sidebar open'}
          </span>
        </button>
      </div>
    </aside>
  );
}

export default function Layout() {
  const { user, logout } = useAuth(); const { connected } = useSocket(); const nav = useNavigate();
  const [mobile, setMobile] = useState(false); const [menu, setMenu] = useState(false);
  const userMenuRef = useRef(null);
  const items = NAV[user.role];

  // Close user dropdown on outside tap/click for mobile and tablet
  useEffect(() => {
    const handler = (e) => {
      if (menu && userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [menu]);

  return (
    <LookupProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop collapsible hover sidebar */}
        <div className="hidden lg:block h-full"><DesktopSidebar items={items} /></div>

        {/* Mobile & Tablet Drawer with clean sliding layout & backdrop */}
        {mobile && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={() => setMobile(false)} />
            <div className="relative flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl z-10">
              <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
                <div className="flex items-center gap-3">
                  <img src="/logo-icon.png" alt="Eco Friendly Tech Solutions" className="h-10 w-10 object-contain shrink-0" />
                  <div className="leading-tight min-w-0">
                    <p className="text-base font-bold truncate text-gray-900">Eco Friendly Tech</p>
                    <p className="text-xs font-semibold" style={{ color: '#23AAA7' }}>Solutions CRM</p>
                  </div>
                </div>
                <button className="icon-btn -mr-1" onClick={() => setMobile(false)} title="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {items.map(([to, label, Icon]) => (
                  <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobile(false)} title={label}
                    className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${isActive ? 'bg-coral-50 text-coral-600 font-semibold shadow-xs' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                    <Icon className="h-6 w-6 shrink-0" />
                    <span className="truncate text-[14.5px]">{label}</span>
                  </NavLink>
                ))}
              </nav>
              <div className="border-t border-gray-100 p-3 bg-gray-50/70">
                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-gray-200">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-full object-cover border border-brand-300 shrink-0" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-bold shrink-0" style={{ background: 'linear-gradient(135deg, #FD7B69 0%, #23AAA7 100%)' }}>{user.name[0]}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-900 truncate">{user.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{roleLabel(user.role)}</p>
                  </div>
                  <button className="icon-btn text-red-500 hover:text-red-700" onClick={logout} title="Logout">
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center gap-2.5 sm:gap-3 border-b border-gray-200 bg-white px-3 sm:px-4">
            <button className="icon-btn lg:hidden" onClick={() => setMobile(true)} aria-label="Open navigation menu"><Menu className="h-5 w-5" /></button>
            <GlobalSearch />
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:flex ${connected ? 'bg-brand-100 text-brand-700' : 'bg-amber-100 text-amber-700'}`}>
                {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{connected ? 'Live' : 'Reconnecting…'}
              </span>
              <div className="relative" ref={userMenuRef}>
                <button className="flex items-center gap-2 rounded-lg p-1 sm:p-1.5 hover:bg-gray-100 transition" onClick={() => setMenu(!menu)} aria-label="User profile menu">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full object-cover border border-brand-400 shadow-sm" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full text-white text-sm font-bold shadow-sm" style={{ background: 'linear-gradient(135deg, #FD7B69 0%, #23AAA7 100%)' }}>{user.name[0]}</div>
                  )}
                  <div className="hidden text-left leading-tight md:block"><p className="text-sm font-medium">{user.name}</p><p className="text-[11px] text-gray-500">{roleLabel(user.role)}</p></div>
                </button>
                {menu && (
                  <div className="card absolute right-0 top-12 z-30 w-48 p-1 text-sm shadow-xl animate-in fade-in-50 duration-150">
                    <div className="p-2 border-b border-gray-100 md:hidden">
                      <p className="font-semibold text-xs text-gray-900 truncate">{user.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{roleLabel(user.role)}</p>
                    </div>
                    <button className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-gray-100" onClick={() => { setMenu(false); nav('/profile'); }}><UserCircle className="h-4 w-4" />My Profile</button>
                    <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-red-600 hover:bg-gray-100" onClick={logout}><LogOut className="h-4 w-4" />Logout</button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6"><CardSelectionProvider><Outlet /></CardSelectionProvider></main>
        </div>
      </div>
    </LookupProvider>
  );
}
