import React from 'react';
import { LayoutDashboard, CheckSquare, Mail, LogOut, Zap, Users, CalendarDays, FolderKanban } from 'lucide-react';
import { useAuth } from '../AuthContext';

const NAV = [
  { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
  { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
  { id: 'calender', icon: CalendarDays, label: 'Calender' },
  { id: 'projects', icon: FolderKanban, label: 'Projects' },
  { id: 'users', icon: Users, label: 'Users' },
  { id: 'email', icon: Mail, label: 'Reminders' },
];

export default function Sidebar({ active, onNav }) {
  const { profile, signOut } = useAuth();

  return (
    <aside
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
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, color: 'var(--tf-text)', letterSpacing: '-0.02em' }}>
          TaskFlow
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--tf-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Admin
        </span>
      </div>

      <nav style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ id, icon: Icon, label }) => {
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
              {label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: '12px', borderTop: '1px solid var(--tf-border)' }}>
        <div style={{ padding: '8px 10px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
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
          <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || 'Admin'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--tf-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.email}
            </div>
          </div>
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
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
