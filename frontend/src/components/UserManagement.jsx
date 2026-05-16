import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import api from '../api';
import { formatDate } from '../lib/dateFormat';

function UsersTable({ users }) {
  if (!users.length) {
    return (
      <div className="empty">
        <div style={{ fontSize: 13, color: 'var(--tf-muted)' }}>No users yet. Click “Add User” to invite your first employee.</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: 'var(--tf-panel)' }}>
          <tr style={{ borderBottom: '1px solid var(--tf-border)' }}>
            <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Name</th>
            <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Email</th>
            <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Role</th>
            <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, color: 'var(--tf-muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: '1px solid var(--tf-border)' }}>
              <td style={{ padding: '9px 14px', fontSize: 13, color: 'var(--tf-text)' }}>
                {u.full_name || '—'}
              </td>
              <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--tf-muted)' }}>
                {u.email}
              </td>
              <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--tf-muted)', textTransform: 'capitalize' }}>
                {u.role}
              </td>
              <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--tf-muted)' }}>
                {formatDate(u.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddUserModal({ open, onClose, onCreated }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setEmail('');
      setFullName('');
      setPassword('');
      setInviteRole('employee');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email || !fullName || !password) {
      setError('Full name, email and password are required');
      return;
    }

    setLoading(true);
    try {
      await api.post('/admin/users', {
        email,
        password,
        fullName,
        role: inviteRole,
      });
      await new Promise((r) => setTimeout(r, 120));
      if (onCreated) await onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overlay" role="presentation">
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16 }}>Add User</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-ink-muted-48)',
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              className="input"
              type="text"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="input"
              type="email"
              placeholder="employee@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="input"
              type="password"
              placeholder="Temporary password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              className="input select"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option value="employee">Employee — tasks & meetings only</option>
              <option value="admin">Admin — full workspace + admin panel</option>
            </select>
            <div style={{ fontSize: 11, color: 'var(--tf-muted)', marginTop: 6 }}>
              Admins you add can sign in at the same login URL and open the admin dashboard.
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  async function loadWithRetry(attempts = 6) {
    setLoading(true);
    setError('');
    for (let i = 0; i < attempts; i++) {
      try {
        const { data } = await api.get('/admin/users');
        setUsers(data);
        setError('');
        setLoading(false);
        return;
      } catch (err) {
        if (i === attempts - 1) {
          setError(err.response?.data?.error || err.message || 'Failed to load users');
          setLoading(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 160 * (i + 1)));
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    loadWithRetry();
  }, []);

  return (
    <div style={{ border: '1px solid var(--tf-border)', borderRadius: 6, overflow: 'hidden', background: 'var(--tf-panel)' }}>
      <div
        style={{
          padding: '13px 16px',
          borderBottom: '1px solid var(--tf-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--tf-muted)',
              letterSpacing: '0.3px',
              textTransform: 'uppercase',
            }}
          >
            Users
          </span>
          <div style={{ fontSize: 11, color: 'var(--tf-muted)', marginTop: 2 }}>
            Manage employees in your workspace
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => loadWithRetry()} disabled={loading}>
            <RefreshCw size={12} />
          </button>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={() => setShowAdd(true)}
          >
            <Plus size={13} /> Add User
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--status-danger)', borderBottom: '1px solid var(--tf-border)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
          <span className="spinner" />
        </div>
      ) : (
        <div style={{ padding: '10px 16px 16px' }}>
          <UsersTable users={users} />
        </div>
      )}

      <AddUserModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={loadWithRetry} />
    </div>
  );
}

