import { useEffect, useState } from 'react';
import supabase from './supabaseClient';
import { useBilling } from './BillingContext';

export const PLAN_LABELS = { free: 'Free', pro: 'Pro', business: 'Business' };

/** The pricing plan of the signed-in person's workspace, as the server reports it; null for visitors and while loading. */
export default function useWorkspacePlan() {
  const { billing } = useBilling();
  return billing?.plan ?? null;
}

/** One line for the profile page: the plan and, for Pro, where the trial or payment stands. */
export function planSummary(billing) {
  if (!billing) return '';
  const name = PLAN_LABELS[billing.plan] || 'Free';
  if (billing.plan !== 'pro') return name;
  if (billing.status === 'trialing') {
    const d = billing.trialDaysLeft ?? 0;
    return `${name} (free trial, ${d} ${d === 1 ? 'day' : 'days'} left)`;
  }
  if (billing.status === 'expired') return `${name} (trial ended, payment needed)`;
  return name;
}

/**
 * The plan to show on the profile: the server's billing status when it is available; otherwise (for example while the billing
 * endpoint is not live yet) the plan stored on the workspace itself.
 */
export function usePlanWithFallback(billing, orgId) {
  const [fallback, setFallback] = useState(null);
  useEffect(() => {
    if (billing || !orgId) { setFallback(null); return undefined; }
    let alive = true;
    supabase.from('organizations').select('plan').eq('id', orgId).maybeSingle()
      .then(({ data }) => { if (alive) setFallback(data?.plan in PLAN_LABELS ? data.plan : 'free'); })
      .catch(() => {});
    return () => { alive = false; };
  }, [billing, orgId]);
  return billing?.plan || fallback;
}
