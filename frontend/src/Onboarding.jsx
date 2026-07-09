import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, ShieldCheck, Building2, Users, ArrowLeft } from 'lucide-react';
import api from './api';
import { useAuth } from './AuthContext';

/**
 * Post-signup wizard (email/password AND Google users land here on first sign-in):
 *   1. mobile number  ->  4-digit OTP sent to WhatsApp
 *   2. verify the code
 *   3. create a new organization  OR  join one with its 6-digit code (needs admin approval)
 *
 * Login never runs this — only accounts without an organization reach it.
 */

const COUNTRY_CODES = [
  { code: '91', label: 'India (+91)' },
  { code: '1', label: 'USA / Canada (+1)' },
  { code: '44', label: 'UK (+44)' },
  { code: '61', label: 'Australia (+61)' },
  { code: '971', label: 'UAE (+971)' },
  { code: '65', label: 'Singapore (+65)' },
  { code: '49', label: 'Germany (+49)' },
  { code: '33', label: 'France (+33)' },
  { code: '81', label: 'Japan (+81)' },
  { code: '86', label: 'China (+86)' },
];

function errText(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback;
}

const card = {
  width: '100%', maxWidth: 460, background: 'var(--tf-panel)',
  border: '1px solid var(--tf-border)', borderRadius: 16, padding: 28,
};
const stepDot = (active, done) => ({
  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 12, fontWeight: 600,
  background: done ? 'var(--color-primary)' : active ? 'var(--tf-pearl)' : 'transparent',
  color: done ? '#fff' : active ? 'var(--tf-text)' : 'var(--tf-muted)',
  border: `1px solid ${done || active ? 'transparent' : 'var(--tf-border)'}`,
});

export default function Onboarding() {
  const navigate = useNavigate();
  const { profile, refreshProfile, signOut } = useAuth();

  const [step, setStep] = useState(1);           // 1 phone · 2 otp · 3 org
  const [cc, setCc] = useState('91');
  const [local, setLocal] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState('');           // 'create' | 'join'
  const [orgName, setOrgName] = useState('');
  const [orgCode, setOrgCode] = useState('');
  const [orgPreview, setOrgPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const phone = `${cc}${local.replace(/\D/g, '')}`;

  async function sendOtp() {
    setError(''); setNotice('');
    const digits = local.replace(/\D/g, '');
    if (digits.length < 6) { setError('Enter your mobile number.'); return; }
    setBusy(true);
    try {
      await api.post('/auth/otp/send', { phone });
      setNotice(`We sent a 4-digit code to your WhatsApp on +${phone}.`);
      setStep(2);
    } catch (err) { setError(errText(err, 'Could not send the code.')); }
    finally { setBusy(false); }
  }

  async function verifyOtp() {
    setError(''); setNotice('');
    if (!/^\d{4}$/.test(code)) { setError('Enter the 4-digit code.'); return; }
    setBusy(true);
    try {
      await api.post('/auth/otp/verify', { phone, code });
      setStep(3);
    } catch (err) { setError(errText(err, 'Could not verify the code.')); }
    finally { setBusy(false); }
  }

  async function lookupOrg(value) {
    setOrgPreview(null);
    const c = value.replace(/\D/g, '');
    if (c.length !== 6) return;
    try {
      const { data } = await api.get(`/auth/org/lookup?code=${c}`);
      setOrgPreview(data);
      setError('');
    } catch (err) { setError(errText(err, 'No organization found with that code.')); }
  }

  async function finish() {
    setError('');
    if (mode === 'create' && !orgName.trim()) { setError('Enter a name for your organization.'); return; }
    if (mode === 'join' && orgCode.replace(/\D/g, '').length !== 6) { setError('Enter the 6-digit organization code.'); return; }
    setBusy(true);
    try {
      const body = mode === 'create'
        ? { phone, mode: 'create', orgName: orgName.trim() }
        : { phone, mode: 'join', orgCode: orgCode.replace(/\D/g, '') };
      const { data } = await api.post('/auth/onboarding', body);
      await refreshProfile();               // the gate in App.jsx re-routes from here
      if (data.status === 'active') navigate('/app', { replace: true });
    } catch (err) { setError(errText(err, 'Could not complete setup.')); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--tf-page)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Zap size={20} color="var(--color-primary)" />
        <span style={{ fontSize: 19, fontWeight: 600, color: 'var(--tf-text)' }}>TaskFlow</span>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          {[1, 2, 3].map((n) => (
            <React.Fragment key={n}>
              <div style={stepDot(step === n, step > n)}>{step > n ? '✓' : n}</div>
              {n < 3 && <div style={{ flex: 1, height: 1, background: 'var(--tf-border)' }} />}
            </React.Fragment>
          ))}
        </div>

        <h1 style={{ fontSize: 21, fontWeight: 600, color: 'var(--tf-text)', margin: 0 }}>
          {step === 1 && 'Verify your mobile number'}
          {step === 2 && 'Enter the code'}
          {step === 3 && 'Set up your workspace'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--tf-muted)', marginTop: 6, marginBottom: 20, lineHeight: 1.5 }}>
          {step === 1 && `Hi ${profile?.full_name || 'there'}! We'll send a 4-digit code to your WhatsApp.`}
          {step === 2 && notice}
          {step === 3 && 'Create a new organization, or join one you were given a code for.'}
        </p>

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="input" value={cc} onChange={(e) => setCc(e.target.value)} style={{ flex: '0 0 150px' }}>
                {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
              <input
                className="input" inputMode="numeric" placeholder="Mobile number" value={local} maxLength={12}
                onChange={(e) => setLocal(e.target.value.replace(/\D/g, ''))} style={{ flex: 1 }}
              />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={sendOtp} style={{ justifyContent: 'center' }}>
              {busy ? <span className="spinner" /> : 'Send code on WhatsApp'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              className="input" inputMode="numeric" placeholder="• • • •" value={code} maxLength={4}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              style={{ textAlign: 'center', fontSize: 24, letterSpacing: 10, fontWeight: 600 }}
            />
            {error && <div className="form-error">{error}</div>}
            <button className="btn btn-primary btn-lg" disabled={busy} onClick={verifyOtp} style={{ justifyContent: 'center' }}>
              {busy ? <span className="spinner" /> : 'Verify'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setStep(1); setCode(''); setError(''); }}>
                <ArrowLeft size={14} /> Change number
              </button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={sendOtp}>Resend code</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { key: 'create', icon: <Building2 size={18} />, title: 'Create organization', sub: "You'll be the admin" },
                { key: 'join', icon: <Users size={18} />, title: 'Join organization', sub: 'Needs a 6-digit code' },
              ].map((o) => (
                <button
                  key={o.key} type="button" onClick={() => { setMode(o.key); setError(''); }}
                  style={{
                    flex: 1, textAlign: 'left', padding: 14, borderRadius: 12, cursor: 'pointer',
                    background: mode === o.key ? 'var(--tf-pearl)' : 'transparent',
                    border: `1px solid ${mode === o.key ? 'var(--color-primary)' : 'var(--tf-border)'}`,
                  }}
                >
                  <div style={{ color: 'var(--color-primary)', marginBottom: 6 }}>{o.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-text)' }}>{o.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--tf-muted)', marginTop: 2 }}>{o.sub}</div>
                </button>
              ))}
            </div>

            {mode === 'create' && (
              <input className="input" placeholder="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            )}

            {mode === 'join' && (
              <>
                <input
                  className="input" inputMode="numeric" placeholder="6-digit organization code" value={orgCode} maxLength={6}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setOrgCode(v); lookupOrg(v); }}
                  style={{ letterSpacing: 6, fontWeight: 600 }}
                />
                {orgPreview && (
                  <div style={{ fontSize: 13, color: 'var(--tf-text)', background: 'var(--tf-pearl)', padding: '10px 12px', borderRadius: 10 }}>
                    ✓ Joining <strong>{orgPreview.name}</strong> — an admin will review your request.
                  </div>
                )}
              </>
            )}

            {error && <div className="form-error">{error}</div>}
            <button className="btn btn-primary btn-lg" disabled={busy || !mode} onClick={finish} style={{ justifyContent: 'center' }}>
              {busy ? <span className="spinner" /> : mode === 'join' ? 'Request to join' : 'Create workspace'}
            </button>
          </div>
        )}

        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--tf-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={13} /> Verified once, at signup only
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => signOut()}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
