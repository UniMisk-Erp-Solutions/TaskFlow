// Content for the search landing pages and the blog. Every claim about TaskFlow here describes something the app really does
// (or repeats what the public pricing page already says); nothing is a statistic or a promise about results.
// Keywords were chosen to be realistic for a new site: specific phrases people type when they are choosing a tool,
// not one-word head terms such as "productivity tools".

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
];

export const BLOG_POSTS = [
  {
    slug: 'how-to-prioritize-tasks',
    title: 'How to Prioritize Tasks: 5 Simple Methods That Work',
    seoTitle: 'How to Prioritize Tasks: 5 Simple Methods | TaskFlow',
    description:
      'Five practical ways to decide what to do first, from the Eisenhower matrix to value versus effort, with a simple way to choose between them.',
    date: '2026-10-27',
    readMinutes: 5,
    intro:
      'Having too many tasks is rarely the real problem. The problem is not knowing which of them matters most today. These five methods give you a quick way to decide, and you can use them with any task list.',
    sections: [
      {
        h2: '1. The Eisenhower matrix: urgent versus important',
        paragraphs: [
          'Sort each task by two questions: is it urgent, and is it important? Urgent and important tasks are done now. Important but not urgent tasks are scheduled. Urgent but not important tasks are delegated if possible. Neither urgent nor important tasks are dropped.',
          'The value of this method is that it separates the loud from the valuable. Many things feel urgent only because someone is waiting for a reply.',
        ],
      },
      {
        h2: '2. High, medium, low',
        paragraphs: [
          'The simplest system is three levels. Give every task a priority when you create it, and keep high priority for a short list. If everything is high, nothing is. A good rule is to allow no more than three high-priority tasks per person per day.',
        ],
      },
      {
        h2: '3. Value versus effort',
        paragraphs: [
          'List your tasks and judge two things for each: how much value it creates and how much effort it takes. Do the high-value, low-effort tasks first. Plan the high-value, high-effort ones as projects. Question anything that is low value and high effort.',
        ],
      },
      {
        h2: '4. MoSCoW: must, should, could, won’t',
        paragraphs: [
          'Used a lot in project planning, MoSCoW sorts work into must have, should have, could have and will not have this time. It is useful when you have a fixed deadline and have to agree with other people what is in and what is out.',
        ],
      },
      {
        h2: '5. Do the hardest thing first',
        paragraphs: [
          'Pick the one task you are most likely to avoid and do it first, when your energy is highest. It is not a scoring system, just a way to stop important work being pushed to the end of the day.',
        ],
      },
      {
        h2: 'Which method should you choose?',
        bullets: [
          'Working alone with a long list: start with high, medium, low.',
          'Dealing with constant interruptions: use the Eisenhower matrix.',
          'Choosing between projects: use value versus effort.',
          'Negotiating scope with others: use MoSCoW.',
        ],
        paragraphs: ['Whatever you choose, write the priority on the task itself so that everyone who works on it can see it.'],
      },
    ],
    related: ['/online-task-planner', '/blog/weekly-planning-template', '/task-management-app'],
  },
  {
    slug: 'kanban-vs-to-do-list',
    title: 'Kanban vs To-Do List: Which Is Better for Your Team?',
    seoTitle: 'Kanban vs To-Do List: Which Should Your Team Use? | TaskFlow',
    description:
      'A to-do list shows what has to be done. A Kanban board shows where each piece of work is. Here is how to choose, and when to use both.',
    date: '2026-10-27',
    readMinutes: 5,
    intro:
      'Both a to-do list and a Kanban board help you manage tasks, but they answer different questions. A list tells you what is left. A board tells you where everything stands. Knowing the difference makes it easier to pick the right one.',
    sections: [
      {
        h2: 'What a to-do list is good at',
        paragraphs: [
          'A list is quick. You can add an item in seconds, reorder it and tick it off. It works well for personal work, short projects and anything where each task is simply either done or not done.',
          'Its weakness is that a long list hides the state of the work. A task can be started, blocked or waiting for review, and a plain checkbox cannot say so.',
        ],
      },
      {
        h2: 'What a Kanban board is good at',
        paragraphs: [
          'A board splits work into lanes such as Backlog, To Do, In Progress and Done. Because each card sits in a lane, you see at a glance how much is waiting, how much is under way and where work is piling up.',
          'Boards also make teamwork visible. When several people share work, everyone sees the same picture without asking for a status update.',
        ],
      },
      {
        h2: 'How to choose',
        bullets: [
          'One person, simple tasks: a to-do list is enough.',
          'Several people, work that moves through stages: use a board.',
          'Work that needs review before it is finished: use a board with a review step.',
          'Both: keep a list for planning and a board for tracking progress.',
        ],
      },
      {
        h2: 'A tip for using a board well',
        paragraphs: [
          'Limit how much is In Progress at the same time. If a lane keeps growing, finish something before you start something new. A board shows the bottleneck, but only you can clear it.',
        ],
      },
    ],
    related: ['/kanban-board-software', '/free-task-manager', '/task-management-app'],
  },
  {
    slug: 'task-approval-workflow',
    title: 'How to Set Up a Task Approval Workflow That Does Not Slow Your Team',
    seoTitle: 'Task Approval Workflow: How to Set One Up | TaskFlow',
    description:
      'A practical guide to approval workflows for tasks: who should review, what to include in a submission and how to keep reviews quick.',
    date: '2026-10-27',
    readMinutes: 6,
    intro:
      'An approval step protects quality, but a badly designed one just creates a queue. The goal is simple: finished work gets a second look quickly, and people always know what happens next.',
    sections: [
      {
        h2: 'Decide who reviews what',
        paragraphs: [
          'Start by choosing the reviewer for each kind of work. In a small team that may be one person. In a larger one, a two-step flow often works well: a team manager checks the work first because they know the details, and a final approver confirms it before it counts as done.',
          'Write the rule down so nobody has to guess who is waiting on whom.',
        ],
      },
      {
        h2: 'Make submissions easy to review',
        bullets: [
          'Add a short note saying what was done and anything the reviewer should check.',
          'Attach the files or links that prove it.',
          'Submit one task at a time rather than a batch of unrelated work.',
        ],
      },
      {
        h2: 'Give feedback that can be acted on',
        paragraphs: [
          'When work is sent back, the note should say what to change, not just that it was rejected. A task that returns to “in progress” with a clear reason is fixed faster than one that comes back with silence.',
        ],
      },
      {
        h2: 'Keep reviews from piling up',
        bullets: [
          'Agree on a target response time, such as one working day.',
          'Give reviewers a single queue of what is waiting, instead of asking them to hunt through messages.',
          'Send a notification when something needs review, so it is not forgotten.',
        ],
      },
      {
        h2: 'Keep a record',
        paragraphs: [
          'Log who approved or rejected each task and when. A history makes it easy to answer questions later and to spot steps where work usually gets stuck.',
        ],
      },
    ],
    related: ['/employee-task-tracking', '/kanban-board-software', '/task-management-app'],
  },
  {
    slug: 'weekly-planning-template',
    title: 'Weekly Planning Template: Plan Your Week in 20 Minutes',
    seoTitle: 'Weekly Planning Template: 20-Minute Routine | TaskFlow',
    description:
      'A simple weekly planning routine you can repeat every Friday or Monday: review, list, prioritize, schedule and leave room for surprises.',
    date: '2026-10-27',
    readMinutes: 4,
    intro:
      'A weekly plan does not need to be long. Twenty minutes at the start or end of the week is enough to see what matters, spot clashes and avoid starting Monday with a blank page.',
    sections: [
      {
        h2: 'Step 1: Review last week (3 minutes)',
        paragraphs: [
          'Look at what was finished and what was not. Anything unfinished is either still important, in which case it carries over, or it is not, in which case you drop it.',
        ],
      },
      {
        h2: 'Step 2: List everything for this week (5 minutes)',
        paragraphs: [
          'Write down every task, meeting and deadline you already know about. Put each task in your task manager with a due date so it is not only in your head.',
        ],
      },
      {
        h2: 'Step 3: Pick your priorities (4 minutes)',
        paragraphs: [
          'Choose the three outcomes that would make the week a success. Mark the tasks that lead to them as high priority and leave the rest at medium or low.',
        ],
      },
      {
        h2: 'Step 4: Put it on the calendar (5 minutes)',
        paragraphs: [
          'Look at the calendar next to your task list. Block time for the high-priority tasks and notice which days are already full of meetings. Move tasks to days that have room.',
        ],
      },
      {
        h2: 'Step 5: Leave space (3 minutes)',
        paragraphs: [
          'Do not plan every hour. Keep some space for requests and problems you could not predict. If the week looks full, move something to the next one now rather than on Thursday.',
        ],
      },
      {
        h2: 'Make it a habit',
        bullets: ['Do it at the same time every week.', 'Use the same list each time.', 'Share the plan with your team so they know what to expect.'],
      },
    ],
    related: ['/online-task-planner', '/blog/how-to-prioritize-tasks', '/task-management-app'],
  },
];

export const BLOG_INDEX = {
  path: '/blog',
  title: 'TaskFlow Blog: Task Management and Planning Guides',
  description: 'Practical guides on prioritizing tasks, planning your week, choosing between a list and a Kanban board, and running approvals.',
  changefreq: 'weekly',
  priority: 0.7,
  lastmod: '2026-10-27',
  h1: 'Task management and planning guides',
  intro: 'Practical, plain-language guides for people who plan, assign and review work.',
};

export const blogPath = (slug) => `/blog/${slug}`;
