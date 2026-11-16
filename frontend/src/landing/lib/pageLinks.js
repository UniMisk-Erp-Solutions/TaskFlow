// Links between the public pages, written once so every page, the footer and the tests read the same data.
// Anchor text says what the visitor will find (not "click here" or a bare "About"); the blurb adds a sentence of detail.

import { BLOG_POSTS, blogPath } from '../../seo/seoPages.js';

export const PAGE = {
  about: { to: '/about', label: 'About TaskFlow: why we built a simpler task manager', blurb: 'The team and the thinking behind the app.' },
  contact: { to: '/contact', label: 'Contact TaskFlow: talk to sales or get support', blurb: 'Email the team, or ask about a Business plan.' },
  docs: { to: '/docs', label: 'Documentation and guides', blurb: 'Set up your workspace, projects, tasks and approvals.' },
  faq: { to: '/faq', label: 'FAQ: TaskFlow plans, features and setup', blurb: 'Short answers to the questions people ask most.' },
  privacy: { to: '/privacy', label: 'Privacy Policy: how we handle your information', blurb: 'What we collect, why, and the choices you have.' },
  security: { to: '/security', label: 'Security at TaskFlow: how we protect your data', blurb: 'Roles, separate workspaces, private files and audit history.' },
  terms: { to: '/terms', label: 'Terms of Service for using TaskFlow', blurb: 'The terms that apply when you create an account.' },
  pricing: { to: '/pricing', label: 'Pricing: free plan and paid plans for teams', blurb: 'Compare Free, Pro and Business.' },
  blog: { to: '/blog', label: 'TaskFlow blog: task management and planning guides', blurb: 'Practical guides for people who plan, assign and review work.' },
  approval: { to: '/task-approval-workflow-software', label: 'Task approval workflow software for teams', blurb: 'Submit, review and approve work, with a record of every decision.' },
};

/** The ten blog guides, in the order they appear on the blog. The label is the guide's own title. */
export const GUIDE_LINKS = BLOG_POSTS.map((post) => ({ to: blogPath(post.slug), label: post.title, blurb: post.description }));

const guide = (slug) => GUIDE_LINKS.find((g) => g.to === blogPath(slug));

/** "Related pages" shown at the bottom of the company, legal and help pages, keyed by the page they appear on. */
export const PAGE_LINKS = {
  '/about': [PAGE.contact, PAGE.security, PAGE.faq, PAGE.docs, PAGE.blog],
  '/contact': [PAGE.faq, PAGE.docs, PAGE.pricing, PAGE.security, PAGE.about],
  '/docs': [PAGE.faq, PAGE.contact, PAGE.security, PAGE.approval, guide('how-to-assign-tasks-across-a-team'), guide('how-to-write-clear-task-descriptions'), guide('how-to-keep-task-history-clear')],
  '/faq': [PAGE.pricing, PAGE.docs, PAGE.security, PAGE.about, PAGE.contact],
  '/privacy': [PAGE.security, PAGE.terms, PAGE.contact],
  '/terms': [PAGE.privacy, PAGE.security, PAGE.contact],
  '/security': [PAGE.privacy, PAGE.terms, PAGE.faq, PAGE.approval, guide('how-to-keep-task-history-clear'), PAGE.contact],
  '/pricing': [PAGE.faq, PAGE.approval, PAGE.contact],
};
