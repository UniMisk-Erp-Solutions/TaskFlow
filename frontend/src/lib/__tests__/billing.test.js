import { describe, it, expect } from 'vitest';
import { accessState, validateInquiry, TRIAL_DAYS } from '../../../../supabase/functions/api/billing.ts';

const NOW = new Date('2026-10-29T10:00:00Z');
const days = (n) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

describe('billing rules (the API decides, not the browser)', () => {
  it('a Free workspace is unlocked and may start one trial', () => {
    const s = accessState({ plan: 'free', plan_status: 'none', trial_used: false }, NOW);
    expect(s).toMatchObject({ plan: 'free', status: 'none', locked: false, trialEligible: true });
  });

  it('the trial lasts 7 days', () => {
    expect(TRIAL_DAYS).toBe(7);
  });

  it('a running trial is unlocked and counts the days left', () => {
    const s = accessState({ plan: 'pro', plan_status: 'trialing', trial_ends_at: days(3), trial_used: true }, NOW);
    expect(s).toMatchObject({ plan: 'pro', status: 'trialing', locked: false, trialDaysLeft: 3, trialEligible: false });
  });

  it('locks the workspace the moment the trial ends, even if the stored status still says trialing', () => {
    const s = accessState({ plan: 'pro', plan_status: 'trialing', trial_ends_at: days(-0.001), trial_used: true }, NOW);
    expect(s).toMatchObject({ status: 'expired', locked: true });
  });

  it('treats a trial with no end date as expired rather than free access', () => {
    expect(accessState({ plan: 'pro', plan_status: 'trialing', trial_ends_at: null, trial_used: true }, NOW).locked).toBe(true);
  });

  it('an explicit expired status stays locked', () => {
    expect(accessState({ plan: 'pro', plan_status: 'expired', trial_used: true }, NOW).locked).toBe(true);
  });

  it('a paid workspace is unlocked, until its paid period runs out', () => {
    expect(accessState({ plan: 'pro', plan_status: 'active', paid_until: days(10), trial_used: true }, NOW).locked).toBe(false);
    expect(accessState({ plan: 'pro', plan_status: 'active', paid_until: days(-1), trial_used: true }, NOW)).toMatchObject({ locked: true, status: 'expired' });
  });

  it('a Business workspace that is active is never locked', () => {
    expect(accessState({ plan: 'business', plan_status: 'active', trial_used: false }, NOW)).toMatchObject({ plan: 'business', locked: false, trialEligible: false });
  });

  it('a used trial cannot be started again and a paid plan is not eligible', () => {
    expect(accessState({ plan: 'free', plan_status: 'none', trial_used: true }, NOW).trialEligible).toBe(false);
    expect(accessState({ plan: 'pro', plan_status: 'active', trial_used: false }, NOW).trialEligible).toBe(false);
  });

  it('unknown or missing data falls back to an unlocked Free workspace', () => {
    expect(accessState(null, NOW)).toMatchObject({ plan: 'free', status: 'none', locked: false });
    expect(accessState({ plan: 'gold', plan_status: 'weird' }, NOW)).toMatchObject({ plan: 'free', status: 'none', locked: false });
  });
});

const good = {
  name: 'Asha Patel', work_email: 'Asha@Example.com', company: 'Example Pvt Ltd', job_title: 'Operations Head', team_size: '51-200',
  requirements: 'We need manager approvals and a leave portal.', required_features: ['Leave portal', 'Two-step approval'],
  contact_method: 'email', phone: '', budget: '', message: '',
};

describe('Business enquiry validation (server side)', () => {
  it('accepts a complete request and normalises it', () => {
    const r = validateInquiry(good);
    expect(r.ok).toBe(true);
    expect(r.value.work_email).toBe('asha@example.com');
    expect(r.value.phone).toBeNull();
    expect(r.value.budget).toBeNull();
  });

  it('rejects missing and malformed fields with a message per field', () => {
    const r = validateInquiry({ ...good, name: '', work_email: 'not-an-email', team_size: '7', requirements: 'short', contact_method: 'fax' });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['contact_method', 'name', 'requirements', 'team_size', 'work_email']);
  });

  it('needs a phone number when the preferred contact is a call or WhatsApp', () => {
    expect(validateInquiry({ ...good, contact_method: 'phone' }).errors.phone).toBeTruthy();
    expect(validateInquiry({ ...good, contact_method: 'whatsapp', phone: '+91 98765 43210' }).ok).toBe(true);
  });

  it('only accepts known features and drops duplicates', () => {
    expect(validateInquiry({ ...good, required_features: ['Hack'] }).ok).toBe(false);
    expect(validateInquiry({ ...good, required_features: ['Leave portal', 'Leave portal'] }).value.required_features).toEqual(['Leave portal']);
  });

  it('caps long text and strips control characters', () => {
    expect(validateInquiry({ ...good, requirements: 'x'.repeat(2001) }).ok).toBe(false);
    expect(validateInquiry({ ...good, name: 'Asha\u0000 Patel' }).value.name).toBe('Asha Patel');
  });

  it('survives a body that is not an object', () => {
    expect(validateInquiry(null).ok).toBe(false);
    expect(validateInquiry('x').ok).toBe(false);
  });
});
