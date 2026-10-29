// What each plan costs and includes, as shown on the profile page. Keep in step with the plans on the Pricing page.
export const PLAN_DETAILS = {
  free: {
    name: 'Free',
    price: '$0',
    priceNote: 'per user, per month',
    pitch: 'For solo creators or two-person teams.',
    features: ['Up to 3 projects', 'Unlimited tasks', 'List & board views', 'Team chat & file sharing', 'Mobile app with push notifications'],
  },
  pro: {
    name: 'Pro',
    price: '$12',
    priceNote: 'per user, per month ($10 when billed yearly)',
    pitch: 'For teams that ship every week.',
    features: ['Everything in Free', 'Unlimited projects', 'Calendar view', 'AI assistant', 'Time tracking & timer analytics', 'Approval workflow & history'],
  },
  business: {
    name: 'Business',
    price: 'Custom',
    priceNote: 'priced for your team size',
    pitch: 'For organizations that run work through teams and managers.',
    features: ['Everything in Pro', 'Manager role and teams', 'Two-step approval: manager, then admin', 'Leave portal with team leave summaries', 'Public and private file sharing'],
  },
};
