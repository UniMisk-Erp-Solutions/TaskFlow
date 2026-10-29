import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from './api';
import { useAuth } from './AuthContext';

const BillingContext = createContext({
  billing: null, refresh: async () => null, startTrial: async () => ({ ok: false }), checkout: async () => ({ ok: false }),
});

function errorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback;
}

/**
 * The workspace's subscription as the SERVER reports it (GET /billing/status). The browser never decides on its own whether a
 * workspace is locked or on a trial: it only shows what the API says, and the API enforces the lock on every request.
 * Signing out (or having no workspace) clears everything.
 */
export function BillingProvider({ children }) {
  const { user, profile } = useAuth();
  const orgId = user ? profile?.org_id || null : null;
  const [billing, setBilling] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/billing/status');
      setBilling(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!orgId) { setBilling(null); return undefined; }
    let alive = true;
    api.get('/billing/status').then(({ data }) => { if (alive) setBilling(data); }).catch(() => {});
    return () => { alive = false; };
  }, [orgId]);

  // A request the server refused with "subscription required", or the tab coming back to the front, re-reads the status.
  useEffect(() => {
    if (!orgId) return undefined;
    const again = () => { refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('tf:subscription-required', again);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('tf:subscription-required', again);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [orgId, refresh]);

  // Re-read the status the moment a running trial is due to end.
  useEffect(() => {
    if (!billing || billing.status !== 'trialing' || !billing.trialEndsAt) return undefined;
    const wait = new Date(billing.trialEndsAt).getTime() - Date.now() + 1500;
    if (wait <= 0 || wait > 2_000_000_000) return undefined;
    const timer = window.setTimeout(refresh, wait);
    return () => window.clearTimeout(timer);
  }, [billing, refresh]);

  const startTrial = useCallback(async () => {
    try {
      const { data } = await api.post('/billing/start-trial');
      setBilling(data);
      return { ok: true };
    } catch (err) {
      refresh();
      return { ok: false, error: errorMessage(err, 'Could not start the trial.') };
    }
  }, [refresh]);

  const checkout = useCallback(async () => {
    try {
      const { data } = await api.post('/billing/checkout');
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: errorMessage(err, 'Could not start the payment.'), code: err?.response?.data?.code };
    }
  }, []);

  const value = useMemo(() => ({ billing, refresh, startTrial, checkout }), [billing, refresh, startTrial, checkout]);
  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling() {
  return useContext(BillingContext);
}
