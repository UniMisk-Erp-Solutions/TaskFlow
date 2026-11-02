// Content for the search landing pages and the blog. Every claim about TaskFlow here describes something the app really does
// (or repeats what the public pricing page already says); nothing is a statistic or a promise about results.
// Keywords were chosen to be realistic for a new site: specific phrases people type when they are choosing a tool,
// not one-word head terms such as "productivity tools".

import { CORE_BLOG_POSTS } from './blogPostsCore.js';
import { TEAMWORK_BLOG_POSTS } from './blogPostsTeamwork.js';

export const LANDING_PAGES = [
  {
    path: '/task-management-app',
    title: 'Task Management App for Teams | TaskFlow',
    description:
      'TaskFlow is a task management app for teams: assign tasks to several people, set priorities and due dates, work on a Kanban board and approve finished work.',
    keyword: 'task management app',
    changefreq: 'monthly',
    priority: 0.9,
    lastmod: '2026-10-27',
    eyebrow: 'Task management app',
    h1: 'A task management app built for how teams really work',
    intro: [
      'Most teams do not need more features, they need everyone to see what is assigned, what is due and what is waiting for a decision. TaskFlow puts all of that in one workspace that works in the browser and installs on a phone like an app.',
      'Create a task, give it a priority and a due date, assign it to one person or several, and follow it from the first idea to the moment someone approves it.',
    ],
    sections: [
      {
        h2: 'What you can manage in TaskFlow',
        bullets: [
          'Tasks with descriptions, priorities, due dates and times, and nested subtasks.',
          'More than one assignee on a task, so shared work has a single home.',
          'Projects that group related tasks and meetings together.',
          'A Kanban board with Backlog, To Do, In Progress and Done lanes.',
          'A calendar of due dates and meetings.',
          'A history of every change on a task, so you can see who did what and when.',
        ],
      },
      {
        h2: 'From assigned to approved',
        paragraphs: [
          'When someone finishes a task they submit it for review with a short note. Their manager checks it first, and an admin gives the final approval. Either reviewer can send it back with a reason, and the task returns to the person who owns it.',
          'This keeps finished work from quietly slipping through without a second pair of eyes, and it leaves a record you can look back on.',
        ],
      },
      {
        h2: 'Works on desktop and on your phone',
        paragraphs: [
          'TaskFlow is a web app, so there is nothing to install on a computer. On a phone you can add it to your home screen and turn on notifications, so a new assignment reaches you straight away.',
        ],
      },
    ],
    faqs: [
      { q: 'What is TaskFlow?', a: 'TaskFlow is a web-based task management app for teams. It combines tasks, a Kanban board, a calendar, time tracking and an approval workflow in one workspace.' },
      { q: 'Can I assign one task to several people?', a: 'Yes. A task can have multiple assignees, and each of them sees it in their own list.' },
      { q: 'Does TaskFlow work on a phone?', a: 'Yes. It runs in the browser and can be added to your home screen as an installable app, with optional notifications.' },
      { q: 'Is there an approval step for finished work?', a: 'Yes. Work is submitted for review, checked by a manager and then approved by an admin, and either reviewer can send it back with a note.' },
    ],
    related: ['/kanban-board-software', '/online-task-planner', '/employee-task-tracking', '/blog/how-to-prioritize-tasks'],
  },
  {
    path: '/free-task-manager',
    title: 'Free Task Manager for Small Teams | TaskFlow',
    description:
      'Start with the free TaskFlow plan: unlimited tasks, list and board views and a mobile app for solo creators and small teams. Upgrade only when you need more.',
    keyword: 'free task manager',
    changefreq: 'monthly',
    priority: 0.9,
    lastmod: '2026-10-27',
    eyebrow: 'Free task manager',
    h1: 'A free task manager for solo work and small teams',
    intro: [
      'If you are a solo creator or a very small team, you can start with the TaskFlow Free plan and pay nothing. It is meant to be a real way to run your work, not a countdown to a trial.',
      'The plan limits are listed on the pricing page, so you know what you are getting before you sign up.',
    ],
    sections: [
      {
        h2: 'What the Free plan includes',
        bullets: [
          'Unlimited tasks.',
          'Up to 3 projects.',
          'List and board views.',
          'The mobile app.',
          'Community support.',
        ],
        note: 'These are the Free plan limits shown on the TaskFlow pricing page at the time of writing. The pricing page is always the authority if they change.',
      },
      {
        h2: 'When a paid plan makes sense',
        paragraphs: [
          'Paid plans add things teams usually need once they grow: more projects, a calendar and timeline, the AI assistant, the approval workflow with history, and priority support. You can compare them side by side on the pricing page.',
          'There is no pressure to upgrade. Plenty of small teams stay on the Free plan for a long time.',
        ],
      },
      {
        h2: 'How to get started in a few minutes',
        bullets: [
          'Create your free account and name your workspace.',
          'Add your first project and a handful of tasks.',
          'Invite a teammate and assign them something.',
          'Try the board view to see your work as lanes.',
        ],
      },
    ],
    faqs: [
      { q: 'Is TaskFlow really free?', a: 'TaskFlow has a Free plan. Its limits (unlimited tasks, up to 3 projects) are listed on the pricing page.' },
      { q: 'Do I need a credit card to start?', a: 'No. You can create an account and use the Free plan without entering payment details.' },
      { q: 'Can I upgrade later?', a: 'Yes. You can move to Pro or Business whenever your team needs more, and the pricing page explains the differences.' },
    ],
    related: ['/task-management-app', '/kanban-board-software', '/blog/kanban-vs-to-do-list'],
  },
  {
    path: '/online-task-planner',
    title: 'Online Task Planner with Calendar and Reminders | TaskFlow',
    description:
      'Plan your week online with TaskFlow: set due dates and times, see work and meetings on one calendar, and get phone notifications when tasks are assigned.',
    keyword: 'online task planner',
    changefreq: 'monthly',
    priority: 0.9,
    lastmod: '2026-10-27',
    eyebrow: 'Online task planner',
    h1: 'An online task planner that shows the week ahead',
    intro: [
      'A good plan answers three questions: what has to be done, by when, and who is doing it. TaskFlow keeps those answers together so you can plan the day, the week or a whole project without juggling separate lists and calendars.',
    ],
    sections: [
      {
        h2: 'Plan with due dates, times and priorities',
        paragraphs: [
          'Every task can carry a due date and a due time, plus a priority. High, medium and low priority are colour-coded, so the urgent work stands out when you scan a list.',
        ],
      },
      {
        h2: 'See tasks and meetings in one calendar',
        paragraphs: [
          'The calendar shows task deadlines and meetings together, so a busy day looks busy before it arrives. When you create a meeting you can also add it to your own Google Calendar.',
        ],
      },
      {
        h2: 'Stay on track with notifications',
        paragraphs: [
          'Add TaskFlow to your phone and turn on notifications to be told when a task or meeting is assigned to you. You choose which kinds of alerts you want in the notification settings.',
        ],
      },
      {
        h2: 'A simple weekly planning routine',
        bullets: [
          'List everything that must happen this week and give each item a due date.',
          'Mark the few tasks that are truly high priority.',
          'Check the calendar for meetings that take up whole blocks of time.',
          'Move anything that does not fit to next week instead of overloading today.',
        ],
        note: 'For a fuller walkthrough, read our guide to planning your week in 20 minutes.',
      },
    ],
    faqs: [
      { q: 'Can I plan tasks by date and time?', a: 'Yes. Each task can have a due date and a due time, and you can see them on the calendar.' },
      { q: 'Can I add meetings to Google Calendar?', a: 'Yes. When you create a meeting there is an option to add it to your own Google Calendar after you connect your Google account.' },
      { q: 'Will I get reminders on my phone?', a: 'You can turn on notifications on a phone that has TaskFlow added to the home screen, and you will be alerted when work is assigned to you.' },
    ],
    related: ['/task-management-app', '/blog/weekly-planning-template', '/blog/how-to-prioritize-tasks'],
  },
  {
    path: '/kanban-board-software',
    title: 'Kanban Board Software for Teams | TaskFlow',
    description:
      'Manage work visually with the TaskFlow Kanban board: Backlog to Done lanes, drag and drop, colour-coded priorities and built-in time tracking.',
    keyword: 'kanban board software',
    changefreq: 'monthly',
    priority: 0.8,
    lastmod: '2026-10-27',
    eyebrow: 'Kanban board',
    h1: 'Kanban board software that your whole team can read at a glance',
    intro: [
      'A Kanban board turns a long list into lanes, so you can see in a second what is waiting, what is being worked on and what is finished. TaskFlow gives every team member a board of their own tasks, and managers and admins a view of the whole team.',
    ],
    sections: [
      {
        h2: 'How the TaskFlow board works',
        bullets: [
          'Four lanes: Backlog, To Do, In Progress and Done.',
          'Drag a card between lanes to update its status.',
          'Cards are tinted by priority: high is pink, medium is green and low is blue.',
          'Filters narrow the board to the work you care about.',
        ],
      },
      {
        h2: 'Rules that keep the board honest',
        paragraphs: [
          'Employees move their own work from Backlog to To Do to In Progress. Dropping a card in Done does not simply close it: the task goes to review, so a manager and then an admin can confirm it is really finished.',
          'Once a task is in progress it cannot be pushed back to To Do or Backlog by the person doing it, which stops work from disappearing off the board.',
        ],
      },
      {
        h2: 'Time tracking on the cards',
        paragraphs: [
          'Cards in the In Progress lane have start and pause controls, so the time spent on a task is recorded where the work happens. The Timer page then summarises time by task and by person.',
        ],
      },
    ],
    faqs: [
      { q: 'What lanes does the board have?', a: 'Backlog, To Do, In Progress and Done.' },
      { q: 'Can I see only my own tasks?', a: 'Yes. Employees see their own tasks on their board, and filters narrow the view further.' },
      { q: 'What happens when I move a card to Done?', a: 'The task is submitted for review. A manager checks it and an admin gives the final approval.' },
    ],
    related: ['/task-management-app', '/employee-task-tracking', '/blog/kanban-vs-to-do-list'],
  },
  {
    path: '/employee-task-tracking',
    title: 'Employee Task Tracking and Approval Workflow | TaskFlow',
    description:
      'Track what each employee works on with TaskFlow: assign tasks, record time, route finished work through manager and admin approval, with full history.',
    keyword: 'employee task tracking software',
    changefreq: 'monthly',
    priority: 0.8,
    lastmod: '2026-10-27',
    eyebrow: 'Employee task tracking',
    h1: 'Employee task tracking with a clear approval trail',
    intro: [
      'When several people share work, managers need to know who is doing what and whether it is really finished. TaskFlow records assignments, time and approvals in one place, with a history that shows every step.',
    ],
    sections: [
      {
        h2: 'Roles that match how a team is organised',
        bullets: [
          'Employees see and update their own tasks, and submit finished work for review.',
          'Managers create teams, add people, assign tasks to their team members and give the first approval.',
          'Admins see the whole workspace, manage users and give the final approval.',
        ],
      },
      {
        h2: 'A two-step approval',
        paragraphs: [
          'A submitted task first goes to the employee’s manager. Once the manager approves it, it moves to an admin for the final decision. If an employee has no manager, it goes straight to an admin. At either step the reviewer can send the task back with a note that explains what to change.',
        ],
      },
      {
        h2: 'Time, leave and history',
        paragraphs: [
          'Start and pause a timer on the task you are working on, and review time by task and by person. A leave portal lets people request time off, including half days and late arrivals, and lets admins and managers see how much leave each person has taken.',
          'Every change to a task is written to its history, so you can answer “who changed this and when?” without searching through messages.',
        ],
      },
    ],
    faqs: [
      { q: 'Who approves submitted work?', a: 'The employee’s manager approves first and an admin approves last. Employees without a manager go straight to an admin.' },
      { q: 'Can managers see their team’s tasks?', a: 'Yes. Managers see and can edit the tasks of the people in their teams, and can assign new work to them.' },
      { q: 'Can employees request leave?', a: 'Yes. The leave portal supports sick leave, exams, emergencies, trips, half days, late coming and custom types, with approval by an admin.' },
    ],
    related: ['/task-management-app', '/kanban-board-software', '/blog/task-approval-workflow'],
  },
  {
    path: '/task-approval-workflow-software',
    title: 'Task Approval Workflow Software for Teams | TaskFlow',
    description:
      'Task approval workflow software: employees submit finished work, managers and admins approve it or send it back with a note, and every decision is logged.',
    keyword: 'task approval workflow software',
    changefreq: 'monthly',
    priority: 0.8,
    lastmod: '2026-10-31',
    eyebrow: 'Task approval workflow',
    h1: 'Task approval workflow software where work is done only when it is approved',
    intro: [
      'Work often gets marked as finished without anyone checking it, and later nobody can say who signed it off. TaskFlow adds a review step: people submit finished work, a reviewer approves it or sends it back, and every decision is kept in the task history.',
    ],
    sections: [
      {
        h2: 'How the approval flow works',
        bullets: [
          'An employee submits a finished task for review instead of closing it themselves.',
          'The reviewer approves it, and only then is the task marked complete.',
          'Or the reviewer sends it back with a note that explains what to change, and the task returns to In Progress.',
          'Reviewers and the person who submitted the work are notified at each step.',
        ],
      },
      {
        h2: 'One reviewer or two',
        paragraphs: [
          'On the Pro plan, submitted work goes to an admin for review. On the Business plan you can add a second step: the employee’s manager approves first and an admin gives the final approval. If an employee has no manager, the task goes straight to an admin.',
        ],
      },
      {
        h2: 'A history of every decision',
        paragraphs: [
          'Each submission, approval and rejection is written to the task’s history with who did it and when. When someone asks why a task was sent back or who approved it, the answer is on the task, not buried in messages.',
        ],
      },
      {
        h2: 'Works with the rest of your task management',
        paragraphs: [
          'Approvals sit on the same tasks you already plan on the Kanban board and calendar, alongside time tracking and team chat. Pushes and pull requests that reference a task can move it forward from GitHub, and it still waits for an admin to approve it.',
        ],
      },
    ],
    faqs: [
      { q: 'Who approves submitted work?', a: 'On the Pro plan an admin reviews it. On the Business plan the employee’s manager approves first and an admin gives the final approval. Employees without a manager go straight to an admin.' },
      { q: 'Can a reviewer send a task back?', a: 'Yes. A reviewer can reject a submission with a note explaining what to change, and the task returns to In Progress.' },
      { q: 'Is the approval workflow on the Free plan?', a: 'No. The approval workflow is part of the Pro and Business plans. The Free plan covers tasks, list and board views, team chat and file sharing.' },
      { q: 'Does a GitHub push approve a task?', a: 'No. A push or pull request that references a task can move it from In Progress to Done, but an admin still has to approve it.' },
    ],
    related: ['/employee-task-tracking', '/kanban-board-software', '/blog/task-approval-workflow', '/pricing'],
  },
];

export const BLOG_POSTS = [...CORE_BLOG_POSTS, ...TEAMWORK_BLOG_POSTS];

export const BLOG_INDEX = {
  path: '/blog',
  title: 'TaskFlow Blog: Task Management and Planning Guides',
  description: 'Practical guides on prioritizing and assigning tasks, writing clear task descriptions, running approvals, time tracking and Kanban boards.',
  changefreq: 'weekly',
  priority: 0.7,
  lastmod: '2026-11-02',
  h1: 'Task management and planning guides',
  intro: 'Practical, plain-language guides for people who plan, assign and review work.',
};

export const blogPath = (slug) => `/blog/${slug}`;
