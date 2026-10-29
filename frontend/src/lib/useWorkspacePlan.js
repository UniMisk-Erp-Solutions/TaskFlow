import { useBilling } from '../BillingContext';

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
