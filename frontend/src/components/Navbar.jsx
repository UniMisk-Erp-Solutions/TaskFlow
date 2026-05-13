import React from 'react';
import { LogOut, Zap } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { ThemeToggle } from '../ThemeContext';

export default function Navbar() {
  const { profile, signOut } = useAuth();
  return (
    <header className="tf-nav-global">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={15} color="var(--color-body-on-dark)" strokeWidth={1.5} />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--color-body-on-dark)',
          }}
        >
          TaskFlow
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ThemeToggle onDark size={14} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--color-surface-chip)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-ink)',
            }}
          >
            {(profile?.full_name || 'E')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-body-on-dark)' }}>
              {profile?.full_name || 'Employee'}
            </div>
            <div className="tf-email-truncate" style={{ fontSize: 12, color: 'var(--color-body-muted-dark)' }}>
              {profile?.email}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={signOut}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            background: 'var(--color-ink)',
            color: 'var(--color-body-on-dark)',
            border: 'none',
          }}
        >
          <LogOut size={13} strokeWidth={1.8} /> Sign Out
        </button>
      </div>
    </header>
  );
}
