// Every question on the FAQ page, grouped. Each answer describes something TaskFlow does today or repeats what the public Pricing
// page already says. Plan prices are not repeated here so they cannot drift out of date; the answers point to the Pricing page.
// The answers together run to well over 1,500 words (checked by a test), so the page is a real reference, not a list of one-liners.

export const FAQ_GROUPS = [
  {
    title: 'Getting started',
    items: [
      {
        q: 'What is TaskFlow?',
        a: 'TaskFlow is a web-based task management app for teams. It brings tasks, a Kanban board, a calendar, time tracking, meetings, team chat, file sharing, a whiteboard, a leave portal and an approval workflow into one workspace, so a team does not need a separate tool for each job. Everyone sees the work that is theirs, and managers and admins see the bigger picture.',
      },
      {
        q: 'Who is TaskFlow for?',
        a: 'It is built for teams that need to plan, assign and review work in one place. A solo creator or a two-person team can run on the Free plan, a growing team can use Pro for the calendar, time tracking, the AI assistant and approvals, and larger organizations that work through managers and teams can talk to us about the Business plan.',
      },
      {
        q: 'How do I sign up?',
        a: 'Create an account with your name, email and password, or sign in with Google. A new account creates a workspace, and you become its admin. From there you can add your team, create projects and start assigning tasks. Signing up is free and does not ask for a card, because the Free plan has no charge.',
      },
      {
        q: 'Can I join a workspace that already exists?',
        a: 'Yes. Sign up, then enter the workspace code your admin gives you. Your request goes to the workspace admin, who approves it before you can use anything. Until then you see a short waiting screen. Once you are approved you land in the workspace with the role the admin chose for you: employee, manager or admin.',
      },
      {
        q: 'Do I need to install anything?',
        a: 'No. TaskFlow runs in any modern browser on a computer, tablet or phone, so there is nothing to download from an app store. If you want it to feel like an app, you can add it to your phone’s home screen, and you can turn on notifications for that device so new work reaches you straight away.',
      },
    ],
  },
  {
    title: 'Plans and pricing',
    items: [
      {
        q: 'Is TaskFlow free?',
        a: 'Yes, there is a Free plan with unlimited tasks, list and board views, team chat, file sharing and up to 3 projects. It is meant to be a real way to run your work, not just a countdown to a trial. Paid plans add things such as unlimited projects, the calendar and time tracking, and their limits are listed on the Pricing page.',
      },
      {
        q: 'Is there a free trial of Pro?',
        a: 'Yes. A workspace admin can start a 7-day Pro trial from the Pricing page, with no card needed. The trial can be used once per workspace, and starting it never changes a workspace that is already on a paid plan. During the 7 days the workspace has the Pro features, and when the 7 days end it needs a Pro subscription to keep working.',
      },
      {
        q: 'What happens when the Pro trial ends?',
        a: 'The workspace asks its admin to subscribe to Pro, and until payment succeeds the workspace is locked. Nothing is deleted: your tasks, files and chats stay exactly as they were and come back as soon as payment goes through. People who are not admins see a message asking them to contact their admin, and they can still sign out.',
      },
      {
        q: 'How much does the Business plan cost?',
        a: 'Business is a custom plan priced around your team size, so there is no fixed price on the page. Use the Contact Team Unimisk form on the Pricing page to tell us about your team and what you need. You give your name, work email, company, job title, team size and requirements, and we will get back to you with a quote.',
      },
      {
        q: 'Can I change plans later?',
        a: 'Yes. Contact us and we will move your workspace to the plan that fits your team. Because every plan includes the one below it, moving up keeps everything you already have and adds more. If you are not sure which plan you need, start on Free or try the 7-day Pro trial and see how your team works with it.',
      },
    ],
  },
  {
    title: 'Tasks and projects',
    items: [
      {
        q: 'What can I manage in TaskFlow?',
        a: 'Tasks and projects with priorities, due dates and statuses, plus a Kanban board, a calendar, a per-task timer, meetings, whiteboards, files, team chat and a leave portal, all in the same account. Because it is one workspace, a task can have its files, its time records and its review history in the same place instead of spread across several tools.',
      },
      {
        q: 'Can I assign tasks to my team?',
        a: 'Yes. Admins and managers create tasks and assign them to one or more people. Each assignee sees the task in their own list and is notified when it is assigned, including a push notification on a phone that has notifications turned on. Admins and managers can also edit a task afterwards, including its name, due date and assignees.',
      },
      {
        q: 'Does TaskFlow have subtasks?',
        a: 'Yes. A task can have subtasks, so a larger piece of work can be broken into smaller steps and each step can be assigned and tracked on its own. Tasks also carry a priority of high, medium or low and a due date, and the lists and the board use colors for priority and status so urgent work stands out at a glance.',
      },
      {
        q: 'Does TaskFlow have a Kanban board and a calendar?',
        a: 'Yes. Tasks can be viewed as a list, on a drag-and-drop Kanban board with Backlog, To Do, In Progress and Done columns, and on a calendar that shows work by date. On a phone, where dragging is awkward, each task has a Move to control instead. The calendar view is listed on the Pro and Business plans.',
      },
      {
        q: 'Can I attach files to a task?',
        a: 'Yes. You can attach files to tasks and meetings, and open images, PDFs and other common file types in a preview without leaving the app. Every preview has a Download button that saves the file to your device. This keeps the paperwork for a piece of work next to the work itself, where the people who need it will see it.',
      },
      {
        q: 'Can I import my existing tasks?',
        a: 'Yes. You can import tasks and meetings from a CSV file, which is useful if your work currently lives in a spreadsheet or in another tool that can export to CSV. The import adds the rows as tasks or meetings in your workspace, so you can start from your existing list instead of retyping it one task at a time.',
      },
      {
        q: 'Can I track time on tasks?',
        a: 'Yes. Each task has a timer that records when you started and stopped, and a timer analytics page shows where the time went. If a timer was left running, you can set the real end time yourself. TaskFlow does not accept an end time in the future, so the record always reflects work that has actually happened. Time tracking is listed on the Pro and Business plans.',
      },
    ],
  },
  {
    title: 'Roles and approvals',
    items: [
      {
        q: 'What roles does TaskFlow have?',
        a: 'There are three roles: admin, manager and employee. Admins manage the whole organization, including its users and roles. Managers create teams, add users and assign and edit tasks for their team. Employees work on the tasks assigned to them. An admin can change a person’s role at any time from the user list, and the new role applies as soon as it is saved.',
      },
      {
        q: 'How does task approval work?',
        a: 'When an employee submits finished work, it goes to their manager for review. If the manager approves it, it moves on to an admin for final approval, and only then is the task marked complete. Either reviewer can send it back with a note, and the task returns to In Progress. Every step is logged, so you can see who approved what. The approval workflow is listed on the Pro and Business plans.',
      },
      {
        q: 'Can managers see their team’s work?',
        a: 'Yes. Managers can see the tasks assigned to the people on their teams, with colors for priority and status, and can edit those tasks. Managers can also see their team’s leave requests. This lets a manager keep their team on track without needing admin access to the rest of the organization.',
      },
    ],
  },
  {
    title: 'Communication and files',
    items: [
      {
        q: 'Is there team chat?',
        a: 'Yes. You can message people one-to-one, in a company-wide General chat and in groups you create yourself. You can reply to a specific message, edit what you sent, and share files, images and voice messages. Images and PDFs open in a viewer inside the app, and chats keep their history so a new conversation never starts from nothing.',
      },
      {
        q: 'Can I get notifications on my phone?',
        a: 'Yes. After you turn on notifications on a device, TaskFlow sends push notifications when a task or meeting is assigned to you and when someone sends you a chat message. TaskFlow asks once after you sign in, and you can turn notifications off again at any time. Notifications are per device, so you choose them separately on your phone and your computer.',
      },
      {
        q: 'Can I share and download files?',
        a: 'Yes. The Files section lets you upload files and whole folders, mark them public or private, and download a folder as a ZIP. Folders show the total size of everything inside them, and you can filter the list between public and private files. Public files are visible to the people in your workspace, while private files stay yours.',
      },
      {
        q: 'Can I manage leave requests in TaskFlow?',
        a: 'Yes. Employees can request leave, including half days and late coming, and see their requests in a list or on a calendar. Admins and managers can see leave for their people, along with a summary of how much leave each person has taken, which you can filter by person and by period. This replaces the spreadsheet many teams keep for leave.',
      },
    ],
  },
  {
    title: 'Data and support',
    items: [
      {
        q: 'Can other companies see my data?',
        a: 'No. Each workspace is separate from every other one, so people in another organization cannot see your tasks, files or chats. Inside a workspace, access follows roles, and private chats can only be read by the people in them. Files you mark as private stay private, and signing out clears your plan and profile details from the screen.',
      },
      {
        q: 'Is there an AI assistant?',
        a: 'Yes. TaskFlow includes an AI assistant that you can ask about your work, which is listed on the Pro and Business plans. It works with the tasks and information in your own workspace, so the answers are about your team’s work rather than generic advice. Like everything else in TaskFlow, it is available once you are signed in.',
      },
      {
        q: 'Is there a dark mode?',
        a: 'Yes. You can switch between a light and a dark theme at any time with the theme button, and TaskFlow remembers your choice on that device. Both themes cover the whole app and the public pages, so you can pick whichever is easier on your eyes for the time of day and the screen you are using.',
      },
      {
        q: 'How do I contact the TaskFlow team?',
        a: 'Email info@unimisk.com or use the Contact page, and we will get back to you. If you are interested in a Business plan, use the Contact Team Unimisk form on the Pricing page, which asks for the details we need to prepare a quote. If something is not working, include your workspace name and a short description of what you saw.',
      },
    ],
  },
];

export const ALL_FAQS = FAQ_GROUPS.flatMap((group) => group.items);

// The five shown on the home page, before the "Show more" button that leads to the FAQ page.
const HOME_QUESTIONS = [
  'What is TaskFlow?',
  'Is TaskFlow free?',
  'What can I manage in TaskFlow?',
  'Can I assign tasks to my team?',
  'Do I need to install anything?',
];

export const HOME_FAQS = HOME_QUESTIONS.map((q) => ALL_FAQS.find((item) => item.q === q)).filter(Boolean);
