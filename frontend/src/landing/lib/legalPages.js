// Content for the policy pages in the Resources menu: refunds, cookies, acceptable use, grievances and the disclaimer.
// Privacy, Terms and Security have their own pages. These are plain-language drafts that only state things the product and the pricing page
// already say (a free plan, a 7-day Pro trial with no card, monthly or yearly billing, cancel anytime, support at info@unimisk.com). The
// company should have its own advisers review them before they are treated as final.

export const LEGAL_CONTACT = 'info@unimisk.com';
export const LEGAL_UPDATED = '17 November 2026';

export const LEGAL_PAGES = [
  {
    path: '/refunds',
    title: 'Refund Policy | TaskFlow',
    h1: 'Refund Policy',
    description: 'How refunds and cancellations work for TaskFlow: the free plan, the 7-day Pro trial, paid plans and how to ask for a refund.',
    summary: 'How refunds and cancellations work.',
    blurb: 'How cancellations and refund requests work for TaskFlow plans.',
    sections: [
      {
        title: 'The free plan and the Pro trial',
        paragraphs: [
          'The Free plan costs nothing and needs no payment details. A workspace admin can start a 7-day Pro trial from the pricing page with no card, so there is nothing to refund if you stop before the trial ends.',
          'When the 7 days end, the workspace needs a Pro subscription to keep working. We only charge once you choose a plan and complete the payment.',
        ],
      },
      {
        title: 'Paid plans and billing',
        paragraphs: [
          'Pro is billed per user per month, on a monthly or a yearly cycle. The Business plan is quoted for your team size, and the terms of your agreement apply to it.',
        ],
      },
      {
        title: 'Cancelling',
        paragraphs: [
          'You can cancel at any time. Cancelling stops future charges for the plan. Please cancel before the next billing date if you do not want to be charged for the next period.',
        ],
      },
      {
        title: 'Asking for a refund',
        bullets: [
          `Email ${LEGAL_CONTACT} with your workspace name, the email on the account and the payment you are asking about.`,
          'Tell us briefly why you are asking, for example you were charged after cancelling, charged twice or charged for users you removed.',
          'We review each request on its merits and reply with a decision and the reasons. Where the law gives you a right to a refund, we honour it.',
          'Approved refunds go back to the original payment method. The time your bank takes to show the money is outside our control.',
        ],
      },
      {
        title: 'Payment disputes',
        paragraphs: [
          'If you think a charge is wrong, please contact us first so we can fix it quickly. We would rather correct a mistake than have you go through a bank dispute.',
        ],
      },
    ],
  },
  {
    path: '/cookies',
    title: 'Cookie Policy | TaskFlow',
    h1: 'Cookie Policy',
    description: 'What cookies and similar browser storage TaskFlow uses, why, and how you can control them.',
    summary: 'What cookies and browser storage TaskFlow uses.',
    blurb: 'What cookies and similar browser storage TaskFlow uses, and the choices you have.',
    sections: [
      {
        title: 'What we mean by cookies',
        paragraphs: [
          'Cookies are small text files a website saves in your browser. We also use similar browser storage, such as local storage, that works the same way for this purpose. In this policy, “cookies” covers both.',
        ],
      },
      {
        title: 'What TaskFlow uses them for',
        bullets: [
          'Staying signed in: your session is kept in your browser so you do not have to sign in on every page. If you choose “Remember me” when creating an account, your sign-in preference is kept.',
          'Preferences: display settings you choose are stored on your device so the app opens the way you left it.',
          'Installable app: when you add TaskFlow to your home screen, files are saved on your device so the app starts quickly.',
        ],
      },
      {
        title: 'What we do not use',
        paragraphs: [
          'At the time of writing, TaskFlow does not use advertising cookies and does not load third-party analytics or tracking scripts. If that changes, we will update this page and ask for your consent first where the law requires it.',
        ],
      },
      {
        title: 'Third-party content',
        paragraphs: [
          'The site loads fonts from Google Fonts. Fetching fonts sends your IP address and browser details to that provider, as any request to a web server does. Please see the provider’s own policy for how it handles that data.',
        ],
      },
      {
        title: 'Your choices',
        paragraphs: [
          'You can delete or block cookies in your browser settings. Blocking the storage that keeps you signed in will stop you from using the app, but the public pages will still work. You can clear stored data at any time from your browser’s site settings.',
        ],
      },
      {
        title: 'Changes to this policy',
        paragraphs: [
          'We will post any change here and update the date at the top of this page.',
        ],
      },
    ],
  },
  {
    path: '/acceptable-use',
    title: 'Acceptable Use Policy | TaskFlow',
    h1: 'Acceptable Use Policy',
    description: 'The rules for using TaskFlow responsibly: what is not allowed, what workspace admins are responsible for and how we respond to misuse.',
    summary: 'The rules for using TaskFlow responsibly.',
    blurb: 'The rules for using TaskFlow responsibly, so the service stays safe and useful for everyone.',
    sections: [
      {
        title: 'Using TaskFlow responsibly',
        paragraphs: [
          'TaskFlow is a workspace for planning and tracking work. Please use it for that purpose, and in a way that is lawful and fair to other people.',
        ],
      },
      {
        title: 'What is not allowed',
        bullets: [
          'Breaking the law or helping someone else to do so.',
          'Uploading or sharing content that infringes someone’s rights, is defamatory, harassing, hateful or sexually exploitative.',
          'Uploading malware, or trying to disrupt, overload or damage the service or its infrastructure.',
          'Trying to access accounts, workspaces or data that are not yours, or testing the security of the service without our written permission.',
          'Sending spam or using TaskFlow to send unsolicited bulk messages.',
          'Scraping the service with automated tools in a way that burdens it.',
          'Impersonating another person or organisation, or sharing a login between several people.',
          'Putting other people’s personal data into TaskFlow without a lawful reason or the authority to do so.',
        ],
      },
      {
        title: 'What workspace admins are responsible for',
        paragraphs: [
          'Admins decide who joins a workspace and what role each person has. They are responsible for removing access when someone leaves and for making sure the people in the workspace follow this policy.',
        ],
      },
      {
        title: 'What happens if the policy is broken',
        paragraphs: [
          'Depending on how serious the problem is, we may remove content, warn the account, limit features or suspend or close the account. Where we can, we will tell the workspace admin what happened and why. We may report unlawful activity to the authorities.',
        ],
      },
      {
        title: 'Reporting a problem',
        paragraphs: [
          `If you see misuse or think your account has been affected, email ${LEGAL_CONTACT} with the details. For a complaint about how your personal data is handled, use the grievance process.`,
        ],
      },
    ],
  },
  {
    path: '/grievances',
    title: 'Grievance Redressal | TaskFlow',
    h1: 'Grievance Redressal',
    description: 'How to raise a complaint or a data request with TaskFlow, what happens next and how to escalate to the Data Protection Board of India.',
    summary: 'How to raise a complaint or data request.',
    blurb: 'How to raise a complaint or a request about your personal data, and what happens next.',
    sections: [
      {
        title: 'Who this page is for',
        paragraphs: [
          'If you are a person whose personal data is handled through TaskFlow, India’s Digital Personal Data Protection (DPDP) Act gives you rights over that data, and the right to have a grievance heard. This page explains how to use them with us.',
        ],
      },
      {
        title: 'What you can ask us',
        bullets: [
          'A summary of the personal data we hold about you and how it is used.',
          'Correction or completion of data that is wrong or incomplete.',
          'Erasure of data that is no longer needed, unless the law requires us to keep it.',
          'To withdraw a consent you gave us.',
          'To name another person to exercise these rights for you.',
          'To raise any other complaint about how we handle personal data or about the service.',
        ],
      },
      {
        title: 'How to raise a grievance',
        bullets: [
          `Email ${LEGAL_CONTACT} with the subject “Grievance”.`,
          'Include your name, the email on your TaskFlow account, your workspace name if you know it, and a clear description of what you want.',
          'We may ask you for a little more information to confirm who you are before we share or change anything.',
        ],
      },
      {
        title: 'What happens next',
        paragraphs: [
          'We acknowledge your message, look into it and send you a written reply that explains what we did or why we could not do it. We aim to respond without delay, and always within the time the law allows.',
          'If your data sits in a workspace run by your employer or another organisation, that organisation decides why and how it is used, so we may need to pass your request to its admin. We will tell you when we do.',
        ],
      },
      {
        title: 'Our grievance contact',
        paragraphs: [
          `Grievance Officer, TaskFlow (Team Unimisk). Email: ${LEGAL_CONTACT}.`,
        ],
      },
      {
        title: 'If you are not satisfied',
        paragraphs: [
          'If we have not resolved your complaint, or you are unhappy with our reply, you can complain to the Data Protection Board of India. The Board generally expects you to have used the organisation’s own process first, which is why we ask you to write to us before you escalate.',
        ],
      },
    ],
  },
  {
    path: '/disclaimer',
    title: 'Disclaimer | TaskFlow',
    h1: 'Disclaimer',
    description: 'Important limits on the information on the TaskFlow website and blog, the AI assistant and the service, and where to find our full terms.',
    summary: 'Limits on the information and features on this site.',
    blurb: 'Important limits on the information on this website and on some features of the service.',
    sections: [
      {
        title: 'General information only',
        paragraphs: [
          'The articles, guides and other content on this website are general information about planning and managing work. They are not legal, financial, tax or other professional advice, and you should not rely on them as such. This includes our guidance on privacy and data protection.',
        ],
      },
      {
        title: 'Accuracy',
        paragraphs: [
          'We work to keep the site accurate and up to date, but we cannot promise that everything on it is complete, current or free of errors. Features, plans and prices can change; the pricing page and the product itself are the authority.',
        ],
      },
      {
        title: 'AI assistant',
        paragraphs: [
          'The AI assistant can create and update tasks and draft text from your instructions. Its output can be wrong or incomplete, so please check anything important before you act on it or share it.',
        ],
      },
      {
        title: 'Results',
        paragraphs: [
          'TaskFlow is a tool. How well it works for a team depends on how the team uses it, so we do not promise any particular result.',
        ],
      },
      {
        title: 'Links to other sites',
        paragraphs: [
          'Our pages may link to websites we do not run. We are not responsible for their content or their practices.',
        ],
      },
      {
        title: 'Our full terms',
        paragraphs: [
          'This disclaimer sits alongside the Terms of Service and the Privacy Policy, which set out the rules for using TaskFlow and the limits on our liability. If anything here conflicts with those documents, they take priority.',
        ],
      },
    ],
  },
];

export const LEGAL_PATHS = LEGAL_PAGES.map((p) => p.path);
