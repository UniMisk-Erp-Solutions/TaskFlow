import React from 'react';
import { LogOut, Zap } from 'lucide-react';
import { useAuth } from '../AuthContext';

export default function Navbar() {
  const { profile, signOut } = useAuth();
  return (
    <header style={{
      height: 52, background: '#0a0a0a',
      borderBottom: '1px solid #1a1a1a',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '0 24px', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={14} color="#e4e4e4" strokeWidth={1.5} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e4', letterSpacing: '-0.2px' }}>TaskFlow</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: 4, background: '#1e1e1e', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#666' }}>
            {(profile?.full_name || 'E')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#ccc' }}>{profile?.full_name || 'Employee'}</div>
            <div style={{ fontSize: 10, color: '#444' }}>{profile?.email}</div>
          </div>
        </div>
        <button onClick={signOut} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: '1px solid #1e1e1e', cursor: 'pointer',
          color: '#555', fontSize: 12, fontFamily: 'inherit',
          padding: '5px 10px', borderRadius: 4, transition: 'all 100ms ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color='#e4e4e4'; e.currentTarget.style.borderColor='#2a2a2a'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color='#555'; e.currentTarget.style.borderColor='#1e1e1e'; }}>
          <LogOut size={12} /> Sign Out
        </button>
      </div>
    </header>
  );
}
