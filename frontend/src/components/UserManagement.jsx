import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import api from '../api';

function UsersTable({ users }) {
  if (!users.length) {
    return (
      <div className="empty">
        <div style={{ fontSize: 13, color: '#444' }}>No users yet. Click “Add User” to invite your first employee.</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#0c0c0c' }}>
          <tr style={{ borderBottom: '1px solid #1e1e1e' }}>
            <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Name</th>
            <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Email</th>
            <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Role</th>
            <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: '1px solid #191919' }}>
              <td style={{ padding: '9px 14px', fontSize: 13, color: '#ddd' }}>
                {u.full_name || '—'}
              </td>
              <td style={{ padding: '9px 14px', fontSize: 12, color: '#aaa' }}>
                {u.email}
              </td>
              <td style={{ padding: '9px 14px', fontSize: 12, color: '#bbb', textTransform: 'capitalize' }}>
                {u.role}
              </td>
              <td style={{ padding: '9px 14px', fontSize: 12, color: '#555' }}>
                {u.created_at
                  ? new Date(u.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'}
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setEmail('');
      setFullName('');
      setPassword('');
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
        role: 'employee',
      });
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !loading && onClose()}>
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
              color: '#555',
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
            <input
              className="input"
              type="text"
              value="employee"
              readOnly
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
            />
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

  async function load() {
    try {
      setLoading(true);
      const { data } = await api.get('/admin/users');
      setUsers(data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ border: '1px solid #1a1a1a', borderRadius: 6, overflow: 'hidden', background: '#0c0c0c' }}>
      <div
        style={{
          padding: '13px 16px',
          borderBottom: '1px solid #1a1a1a',
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
              color: '#666',
              letterSpacing: '0.3px',
              textTransform: 'uppercase',
            }}
          >
            Users
          </span>
          <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>
            Manage employees in your workspace
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={load} disabled={loading}>
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
        <div style={{ padding: '10px 16px', fontSize: 12, color: '#f87171', borderBottom: '1px solid #1a1a1a' }}>
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

      <AddUserModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={load} />
    </div>
  );
}

