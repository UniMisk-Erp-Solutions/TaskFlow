import React from 'react';
import { LayoutDashboard, CheckSquare, Mail, LogOut, Zap, Users, CalendarDays, FolderKanban, Bell, Columns, Timer, UserRound } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { ThemeToggle } from '../ThemeContext';

const ADMIN_NAV = [
  { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
  { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
  { id: 'kanban', icon: Columns, label: 'Kanban Board' },
  { id: 'timer', icon: Timer, label: 'Timer' },
  { id: 'calender', icon: CalendarDays, label: 'Calendar' },
  { id: 'projects', icon: FolderKanban, label: 'Projects' },
  { id: 'users', icon: Users, label: 'Users' },
  { id: 'notifications', icon: Bell, label: 'Notifications' },
  { id: 'email', icon: Mail, label: 'Reminders' },
  { id: 'profile', icon: UserRound, label: 'Profile' },
];

const EMPLOYEE_NAV = [
  { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
  { id: 'kanban', icon: Columns, label: 'Kanban Board' },
  { id: 'timer', icon: Timer, label: 'Timer' },
  { id: 'calender', icon: CalendarDays, label: 'Calendar' },
  { id: 'projects', icon: FolderKanban, label: 'Projects' },
  { id: 'notifications', icon: Bell, label: 'Notifications' },
  { id: 'profile', icon: UserRound, label: 'Profile' },
];

export default function Sidebar({ active, onNav, role = 'admin' }) {
  const { profile, signOut } = useAuth();
  const isEmployee = role === 'employee';
  const navItems = isEmployee ? EMPLOYEE_NAV : ADMIN_NAV;

  return (
    <aside
      className="taskflow-sidebar"
      style={{
        width: 220,
        flexShrink: 0,
        background: 'var(--tf-panel)',
        borderRight: '1px solid var(--tf-border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      <div
        style={{
          padding: '17px 16px',
          borderBottom: '1px solid var(--tf-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Zap size={16} color="var(--color-primary)" strokeWidth={2} />
        <span className="taskflow-sidebar-brand" style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--tf-text)', letterSpacing: '-0.02em' }}>
          TaskFlow
        </span>
        <span className="taskflow-sidebar-role"
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--tf-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {isEmployee ? 'Employee' : 'Admin'}
        </span>
      </div>

      <nav style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(({ id, icon: Icon, label }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNav(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 11,
                border: 'none',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                background: isActive ? 'var(--tf-pearl)' : 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--tf-muted)',
                fontSize: 15,
                fontWeight: isActive ? 600 : 400,
                fontFamily: 'inherit',
                transition: 'color 120ms ease, background 120ms ease',
                borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                paddingLeft: isActive ? 9 : 12,
              }}
            >
              <Icon size={17} strokeWidth={isActive ? 2 : 1.5} />
              <span className="taskflow-sidebar-label">{label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '12px', borderTop: '1px solid var(--tf-border)' }}>
        <div style={{ padding: '8px 10px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, borderRadius: 11, background: active === 'profile' ? 'var(--tf-pearl)' : 'transparent' }}>
          <button type="button" onClick={() => onNav('profile')} aria-label="Open profile" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, padding: 0, textAlign: 'left', border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--tf-pearl)',
              border: '1px solid var(--tf-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--tf-text)',
              flexShrink: 0,
            }}
          >
            {(profile?.full_name || 'A')[0].toUpperCase()}
          </div>
          <div className="taskflow-sidebar-user-copy" style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || 'Admin'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--tf-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.email}
            </div>
          </div>
          </button>
          <ThemeToggle size={15} />
        </div>
        <button
          type="button"
          onClick={signOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 12px',
            width: '100%',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 11,
            background: 'transparent',
            color: 'var(--tf-muted)',
            fontSize: 14,
            fontFamily: 'inherit',
            transition: 'color 120ms ease, background 120ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--status-danger)';
            e.currentTarget.style.background = 'var(--status-danger-bg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--tf-muted)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <LogOut size={14} /> <span className="taskflow-sidebar-label">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
