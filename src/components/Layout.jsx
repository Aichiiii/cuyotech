import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, CalendarDays, KeyRound, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../auth';
import { api } from '../api';
import { NAV, PAGE_TITLES } from '../nav';
import { initials } from '../utils';
import logo from '../assets/logo-crest.png';

export default function Layout() {
  const { user, logout, can } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [term, setTerm] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const userRef = useRef(null);

  // Poll unread notifications every 60 seconds
  useEffect(() => {
    let alive = true;
    const load = () => api.get('/notifications').then((d) => alive && setUnread(d.unread)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [location.pathname]);

  useEffect(() => {
    api.get('/terms').then((d) => setTerm(d.open_term)).catch(() => {});
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setUserOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const close = (e) => userRef.current && !userRef.current.contains(e.target) && setUserOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const sections = NAV.map((s) => ({ ...s, items: s.items.filter((i) => !i.perm || can(i.perm)) })).filter((s) => s.items.length);
  // Show section headings only when the user has more than one titled section (e.g. Registrar + Clearance)
  const showTitles = sections.filter((s) => s.section).length > 1;
  const allItems = sections.flatMap((s) => s.items);
  const current = allItems.filter((i) => (i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to))).sort((a, b) => b.to.length - a.to.length)[0];
  const pageTitle = current?.label || PAGE_TITLES[location.pathname] || '';
  const roleLabel = user.staff ? `${user.role_name} · ${user.staff.office_code}` : user.role_name;

  const doLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img className="brand-logo" src={logo} alt="CuyoTech University logo" />
          <div className="brand-name">CuyoTech SSIS</div>
        </div>
        <nav className="sidebar-nav">
          {sections.map((s) => (
            <div className="nav-section" key={s.section || 'main'}>
              {showTitles && s.section && <div className="nav-section-title">{s.section}</div>}
              {s.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <i.icon />
                  {i.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="btn btn-primary" onClick={doLogout}><LogOut /> Log out</button>
        </div>
      </aside>
      <div className={`sidebar-backdrop ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />

      <div className="app-main">
        <header className="topbar">
          <button className="icon-btn topbar-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu /></button>
          <div>
            <div className="topbar-title">{pageTitle}</div>
          </div>
          <div className="topbar-spacer" />
          {term && <div className="topbar-term"><CalendarDays size={14} /> {term.label}</div>}
          <button className="icon-btn" onClick={() => navigate('/notifications')} aria-label="Notifications">
            <Bell />
            {unread > 0 && <span className="dot-count">{unread > 99 ? '99+' : unread}</span>}
          </button>
          <div className="user-menu" ref={userRef}>
            <button className="topbar-user" onClick={() => setUserOpen((o) => !o)} aria-label="Account menu">
              <span className="topbar-user-name">{user.display_name}</span>
              <span className="avatar">{initials(user.display_name)}</span>
            </button>
            {userOpen && (
              <div className="dropdown">
                <div className="dropdown-header">
                  <div className="fw-600">{user.display_name}</div>
                  <div className="text-xs text-muted">{user.username} · {roleLabel}</div>
                </div>
                <button className="dropdown-item" onClick={() => navigate('/notifications')}><Bell /> Notifications {unread > 0 && `(${unread})`}</button>
                <button className="dropdown-item" onClick={() => navigate('/account')}><KeyRound /> Change password</button>
                <button className="dropdown-item" onClick={doLogout}><LogOut /> Log out</button>
              </div>
            )}
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
