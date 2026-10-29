import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Building2, Check, CalendarDays, Crown, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../AuthContext';
import api from '../api';
import { useBilling } from '../BillingContext';
import { planSummary, usePlanWithFallback } from '../useWorkspacePlan';
import { PLAN_DETAILS } from '../lib/planDetails';

const fieldStyle = {
  width: '100%',
  border: '1px solid var(--tf-border)',
  borderRadius: 11,
  background: 'var(--tf-page)',
  color: 'var(--tf-text)',
  padding: '11px 13px',
  font: 'inherit',
  outlineColor: 'var(--color-primary)',
};

/** The workspace's plan with its price and what it includes. Uses the server's billing status; if that is not available yet it reads the plan itself. */
function PlanCard({ billing, orgId }) {
  const key = usePlanWithFallback(billing, orgId);
  const info = key ? PLAN_DETAILS[key] : null;
  if (!info) return null;
  const status = billing ? planSummary(billing) : info.name;
  const warn = billing?.status === 'expired';
  return (
    <div style={{ border: '1px solid var(--tf-border)', borderRadius: 18, background: 'var(--tf-panel)', padding: 24, marginTop: 18 }} aria-labelledby="profile-plan-heading">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 17, borderBottom: '1px solid var(--tf-border)', marginBottom: 20 }}>
        <Crown size={18} color="var(--color-primary)" />
        <h3 id="profile-plan-heading" style={{ margin: 0, color: 'var(--tf-text)', fontSize: 16, fontWeight: 600 }}>Your plan</h3>
        <Link to="/pricing" className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>View all plans</Link>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 200 }}>
          <div style={{ color: 'var(--tf-text)', fontSize: 22, fontWeight: 650 }}>{info.name}</div>
          <div style={{ color: warn ? 'var(--status-danger)' : 'var(--tf-muted)', fontSize: 13, marginTop: 4 }}>{status}</div>
          <div style={{ marginTop: 14, color: 'var(--tf-text)', fontSize: 30, fontWeight: 650, letterSpacing: '-0.02em' }}>{info.price}</div>
          <div style={{ color: 'var(--tf-muted)', fontSize: 12 }}>{info.priceNote}</div>
          <div style={{ color: 'var(--tf-muted)', fontSize: 13, marginTop: 12, maxWidth: 260, lineHeight: 1.5 }}>{info.pitch}</div>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10, flex: '1 1 260px' }}>
          {info.features.map((feature) => (
            <li key={feature} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, color: 'var(--tf-text)', fontSize: 14 }}>
              <Check size={16} color="var(--status-success)" style={{ marginTop: 2, flexShrink: 0 }} /> {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '15px 0', borderBottom: '1px solid var(--tf-border)' }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, flexShrink: 0, borderRadius: 10, background: 'var(--tf-pearl)', color: 'var(--color-primary)' }}><Icon size={17} /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--tf-muted)', fontSize: 12, marginBottom: 4 }}>{label}</div>
        <div style={{ color: 'var(--tf-text)', fontSize: 14, fontWeight: 500, overflowWrap: 'anywhere' }}>{value || 'Not provided'}</div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const { billing } = useBilling();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setFullName(profile?.full_name || '');
    setPhone(profile?.phone || '');
  }, [profile?.full_name, profile?.phone]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.patch('/auth/me', { fullName: fullName.trim(), phone: phone.trim() });
      await refreshProfile();
      setMessage({ type: 'success', text: 'Your profile was updated.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Could not update your profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  const role = profile?.role === 'admin' ? 'Administrator' : profile?.role === 'manager' ? 'Manager' : 'Employee';
  const joined = profile?.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

  return (
    <section style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ color: 'var(--tf-text)', font: '600 25px var(--font-display)', margin: 0, letterSpacing: '-0.025em' }}>Your profile</h2>
        <p style={{ color: 'var(--tf-muted)', fontSize: 14, margin: '7px 0 0' }}>Manage your account details and view your workspace access.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px, .8fr) minmax(320px, 1.4fr)', gap: 18, alignItems: 'start' }} className="tf-profile-grid">
        <div style={{ border: '1px solid var(--tf-border)', borderRadius: 18, background: 'var(--tf-panel)', padding: 24, textAlign: 'center' }}>
          <div style={{ width: 76, height: 76, display: 'grid', placeItems: 'center', margin: '0 auto 14px', borderRadius: '50%', background: 'var(--tf-pearl)', border: '1px solid var(--tf-border)', color: 'var(--color-primary)', fontSize: 28, fontWeight: 650 }}>
            {(profile?.full_name || profile?.email || '?').slice(0, 1).toUpperCase()}
          </div>
          <div style={{ color: 'var(--tf-text)', fontSize: 19, fontWeight: 600 }}>{profile?.full_name || 'Your name'}</div>
          <div style={{ color: 'var(--tf-muted)', fontSize: 13, marginTop: 5, overflowWrap: 'anywhere' }}>{profile?.email}</div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 15, padding: '6px 11px', border: '1px solid var(--tf-border)', borderRadius: 999, color: 'var(--color-primary)', background: 'var(--tf-page)', fontSize: 12, fontWeight: 600 }}>
            <ShieldCheck size={14} /> {role}
          </span>
          <div style={{ textAlign: 'left', marginTop: 18 }}>
            <Detail icon={Building2} label="Workspace" value={profile?.organization_name || profile?.org?.name || (profile?.org_id ? 'Workspace member' : 'No workspace')} />
            {billing && <Detail icon={Crown} label="Plan" value={planSummary(billing)} />}
            <Detail icon={CalendarDays} label="Member since" value={joined} />
            <Detail icon={BadgeCheck} label="Account status" value={profile?.status === 'active' || !profile?.status ? 'Active' : profile.status.replaceAll('_', ' ')} />
          </div>
        </div>

        <form onSubmit={save} style={{ border: '1px solid var(--tf-border)', borderRadius: 18, background: 'var(--tf-panel)', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 17, borderBottom: '1px solid var(--tf-border)', marginBottom: 20 }}>
            <UserRound size={18} color="var(--color-primary)" />
            <h3 style={{ margin: 0, color: 'var(--tf-text)', fontSize: 16, fontWeight: 600 }}>Personal information</h3>
          </div>
          <label style={{ display: 'block', color: 'var(--tf-muted)', fontSize: 13, marginBottom: 15 }}>
            Full name
            <input required maxLength={100} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} style={{ ...fieldStyle, display: 'block', marginTop: 7 }} />
          </label>
          <label style={{ display: 'block', color: 'var(--tf-muted)', fontSize: 13, marginBottom: 15 }}>
            Email address
            <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: 9, marginTop: 7, opacity: .75 }}><Mail size={15} />{profile?.email || '—'}</div>
            <span style={{ display: 'block', fontSize: 11, marginTop: 5 }}>Contact your workspace administrator to change your sign-in email.</span>
          </label>
          <label style={{ display: 'block', color: 'var(--tf-muted)', fontSize: 13, marginBottom: 20 }}>
            Phone number
            <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: 9, marginTop: 7 }}><Phone size={15} /><input aria-label="Phone number" type="tel" maxLength={30} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Add a phone number" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: 'var(--tf-text)', font: 'inherit' }} /></div>
          </label>
          {message && <div role="status" style={{ marginBottom: 14, fontSize: 13, color: message.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)' }}>{message.text}</div>}
          <button type="submit" className="btn btn-primary tf-profile-save" disabled={saving || !fullName.trim()}>{saving ? 'Saving…' : 'Save changes'}</button>
        </form>
      </div>
      <PlanCard billing={billing} orgId={profile?.org_id} />
      <style>{'@media (max-width: 760px) { .tf-profile-grid { grid-template-columns: 1fr !important; } }'}</style>
    </section>
  );
}
