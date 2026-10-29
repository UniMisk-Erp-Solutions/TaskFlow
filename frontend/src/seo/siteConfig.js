// Single source of truth for the public (indexable) pages: the browser (<Seo>), the build (static page heads + sitemap)
// and the tests all read from here. Plain JS, no JSX, so Node can import it too.

export const SITE_URL = 'https://taskflow.unimisk.com';
export const SITE_NAME = 'TaskFlow';
export const DEFAULT_OG_IMAGE = '/icons/icon-512.png';
export const DEFAULT_TITLE = 'TaskFlow: Task Management App for Teams';
export const DEFAULT_DESCRIPTION =
  'TaskFlow is an online task manager for teams: assign tasks, track time on a Kanban board, plan with a calendar and approve finished work.';

export const absoluteUrl = (path = '/') => `${SITE_URL}${path === '/' ? '/' : path.replace(/\/+$/, '')}`;

/** Pages that already existed as marketing pages. `lastmod` is the date the page's content last meaningfully changed. */
export const CORE_PAGES = [
  {
    path: '/',
    title: 'TaskFlow: Task Management App for Teams',
    description: DEFAULT_DESCRIPTION,
    changefreq: 'weekly',
    priority: 1.0,
    lastmod: '2026-10-27',
    summary: 'Plan work, assign it to your team, track the time it takes and approve it when it is done.',
  },
  {
    path: '/features',
    title: 'Features: Kanban Board, Calendar, Time Tracking | TaskFlow',
    description:
      'Explore TaskFlow features: tasks with subtasks and several assignees, a Kanban board, calendar, time tracking, approvals, chat, files and an AI assistant.',
    changefreq: 'monthly',
    priority: 0.9,
    lastmod: '2026-10-27',
    summary: 'Tasks, Kanban, calendar, time tracking, approvals and more in one workspace.',
  },
  {
    path: '/pricing',
    title: 'Pricing: Free Plan and Paid Plans for Teams | TaskFlow',
    description: 'Compare the TaskFlow Free, Pro and Business plans. Start with the free plan and upgrade when your team needs more.',
    changefreq: 'monthly',
    priority: 0.9,
    lastmod: '2026-10-27',
    summary: 'Compare the Free, Pro and Business plans.',
  },
  {
    path: '/faq',
    title: 'FAQ: TaskFlow Plans, Features and Setup',
    description: 'Answers to common questions about TaskFlow: plans and pricing, the 7-day Pro trial, roles, approvals, chat, files and getting started.',
    changefreq: 'monthly',
    priority: 0.7,
    lastmod: '2026-10-29',
    summary: 'Answers to common questions about TaskFlow.',
  },
  {
    path: '/docs',
    title: 'Documentation and Guides | TaskFlow',
    description: 'Guides for setting up TaskFlow: creating projects, assigning tasks, using the board and calendar, and approving work.',
    changefreq: 'monthly',
    priority: 0.7,
    lastmod: '2026-10-27',
    summary: 'Guides for getting the most out of TaskFlow.',
  },
  {
    path: '/about',
    title: 'About TaskFlow: Why We Built a Simpler Task Manager',
    description: 'Learn who builds TaskFlow and why: a task manager that keeps teams, deadlines and approvals in one clear place.',
    changefreq: 'monthly',
    priority: 0.6,
    lastmod: '2026-10-27',
    summary: 'The team and the thinking behind TaskFlow.',
  },
  {
    path: '/contact',
    title: 'Contact TaskFlow: Talk to Sales or Get Support',
    description: 'Questions about TaskFlow? Contact the team for sales, support or help setting up your workspace.',
    changefreq: 'monthly',
    priority: 0.6,
    lastmod: '2026-10-27',
    summary: 'Get in touch with the TaskFlow team.',
  },
  {
    path: '/security',
    title: 'Security at TaskFlow: How We Protect Your Data',
    description: 'How TaskFlow protects your workspace: role-based access, per-organization data separation, private file storage and audit history.',
    changefreq: 'yearly',
    priority: 0.6,
    lastmod: '2026-10-27',
    summary: 'How your workspace data is protected.',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy | TaskFlow',
    description: 'How TaskFlow collects, uses and protects personal information, and the choices you have over your data.',
    changefreq: 'yearly',
    priority: 0.3,
    lastmod: '2026-10-27',
    summary: 'How personal information is handled.',
  },
  {
    path: '/terms',
    title: 'Terms of Service | TaskFlow',
    description: 'The terms of service that apply when you create an account and use the TaskFlow task management app.',
    changefreq: 'yearly',
    priority: 0.3,
    lastmod: '2026-10-27',
    summary: 'The terms for using TaskFlow.',
  },
];

/** App screens that must never appear in search results. */
export const NOINDEX_PREFIXES = ['/login', '/app', '/admin', '/dashboard', '/manager', '/signup'];
