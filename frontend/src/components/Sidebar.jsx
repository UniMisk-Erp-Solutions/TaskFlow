import React from 'react';
import { LayoutDashboard, CheckSquare, Mail, LogOut, Zap } from 'lucide-react';
import { useAuth } from '../AuthContext';

const NAV = [
  { id: 'overview', icon: LayoutDashboard, label: 'Overview'  },
  { id: 'tasks',    icon: CheckSquare,     label: 'Tasks'     },
  { id: 'email',    icon: Mail,            label: 'Reminders' },
];

export default function Sidebar({ active, onNav }) {
  const { profile, signOut } = useAuth();

  return (
    <aside style={{
      width: 210, flexShrink: 0,
      background: '#0a0a0a',
      borderRight: '1px solid #1a1a1a',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={15} color="#e4e4e4" strokeWidth={1.5} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.3px' }}>TaskFlow</span>
        <span style={{ marginLeft: 2, fontSize: 9, fontWeight: 600, color: '#333', letterSpacing: '1px', textTransform: 'uppercase', paddingTop: 1 }}>Admin</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV.map(({ id, icon: Icon, label }) => {
          const isActive = active === id;
          return (
            <button key={id} onClick={() => onNav(id)} style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '8px 10px', borderRadius: 5,
              border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
              background: isActive ? '#151515' : 'transparent',
              color: isActive ? '#e4e4e4' : '#555',
              fontSize: 13, fontWeight: isActive ? 500 : 400,
              fontFamily: 'inherit', transition: 'all 100ms ease',
              borderLeft: isActive ? '2px solid #e4e4e4' : '2px solid transparent',
            }}
            onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.color='#999'; e.currentTarget.style.background='#111'; } }}
            onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.color='#555'; e.currentTarget.style.background='transparent'; } }}>
              <Icon size={14} strokeWidth={isActive ? 2 : 1.5} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: '10px 8px 14px', borderTop: '1px solid #1a1a1a' }}>
        <div style={{ padding: '8px 10px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 24, height: 24, borderRadius: 4, background: '#1e1e1e', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#666', flexShrink: 0 }}>
            {(profile?.full_name || 'A')[0].toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name || 'Admin'}
            </div>
            <div style={{ fontSize: 10, color: '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.email}
            </div>
          </div>
        </div>
        <button onClick={signOut} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', width: '100%', border: 'none', cursor: 'pointer',
          background: 'transparent', color: '#444', fontSize: 12,
          fontFamily: 'inherit', borderRadius: 5, transition: 'all 100ms ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color='#f87171'; e.currentTarget.style.background='rgba(248,113,113,0.05)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color='#444'; e.currentTarget.style.background='transparent'; }}>
          <LogOut size={12} /> Sign Out
        </button>
      </div>
    </aside>
  );
}
