// Blog articles, part 1: the first four guides, each long enough to read as a full page.
// Same entry shape as every other article (see docs/seo.md). Claims about TaskFlow describe what the app does.

export const CORE_BLOG_POSTS = [
  {
    slug: 'how-to-prioritize-tasks',
    title: 'How to Prioritize Tasks: 5 Simple Methods That Work',
    seoTitle: 'How to Prioritize Tasks: 5 Simple Methods | TaskFlow',
    description:
      'Five practical ways to decide what to do first, from the Eisenhower matrix to value versus effort, with a simple way to choose between them.',
    date: '2026-10-27',
    readMinutes: 7,
    intro:
      'Having too many tasks is rarely the real problem. The problem is not knowing which of them matters most today. These five methods give you a quick way to decide what the team should do first, and you can use them with any task list, spreadsheet or task manager.',
    sections: [
      {
        h2: 'Why prioritizing matters more for teams',
        paragraphs: [
          'When you work alone, a bad priority call costs you an afternoon. On a team, it costs everyone who is waiting for your work. Two people can each pick the most important thing on their own list and still pull in opposite directions, because each of them sees a different list.',
          'Prioritizing as a team means agreeing on how you decide, not only on what comes first. Once the method is shared, people can make good calls without asking a manager every time, and disagreements become short conversations about facts instead of long ones about opinions.',
        ],
      },
      {
        h2: '1. The Eisenhower matrix: urgent versus important',
        paragraphs: [
          'Sort each task by two questions: is it urgent, and is it important? Urgent and important tasks are done now. Important but not urgent tasks are scheduled. Urgent but not important tasks are delegated if possible. Neither urgent nor important tasks are dropped.',
          'The value of this method is that it separates the loud from the valuable. Many things feel urgent only because someone is waiting for a reply. The matrix forces you to ask whether the work moves a goal forward or only quiets a person.',
          'Most teams find that the important but not urgent square is where the best work lives: planning, fixing the process, writing things down. It is also the square that gets skipped when the week gets busy, so give it dates on the calendar.',
        ],
      },
      {
        h2: '2. High, medium, low',
        paragraphs: [
          'The simplest system is three levels. Give every task a priority when you create it, and keep high priority for a short list. If everything is high, nothing is. A good rule is to allow no more than three high-priority tasks per person per day.',
          'This method works best when the levels have a meaning everyone agrees on. For example: high means it blocks someone else or has a fixed deadline this week, medium means it matters but can move a day or two, low means it is worth doing when there is space. Write those meanings down where the team can see them.',
        ],
      },
      {
        h2: '3. Value versus effort',
        paragraphs: [
          'List your tasks and judge two things for each: how much value it creates and how much effort it takes. Do the high-value, low-effort tasks first. Plan the high-value, high-effort ones as projects. Question anything that is low value and high effort.',
          'You do not need exact numbers. Small, medium and large is enough. The point is to notice quick wins that have been sitting unseen, and to stop yourself from spending a week on something that would have made little difference.',
          'This method is especially useful when you are choosing between projects, because it makes the trade-off visible to everyone in the room.',
        ],
      },
      {
        h2: '4. MoSCoW: must, should, could, won’t',
        paragraphs: [
          'Used a lot in project planning, MoSCoW sorts work into must have, should have, could have and will not have this time. It is useful when you have a fixed deadline and have to agree with other people what is in and what is out.',
          'The “won’t have this time” group is the most important one. Naming what is left out, and saying that it is left out for now rather than forever, makes it much easier to protect the must-haves when new requests arrive.',
        ],
      },
      {
        h2: '5. Do the hardest thing first',
        paragraphs: [
          'Pick the one task you are most likely to avoid and do it first, when your energy is highest. It is not a scoring system, just a way to stop important work being pushed to the end of the day, where it gets the least attention.',
          'This pairs well with any of the other methods. Use one of them to decide what matters, then use this habit to make sure the thing that matters most is not the thing you keep postponing.',
        ],
      },
      {
        h2: 'Which method should you choose?',
        bullets: [
          'Working alone with a long list: start with high, medium, low.',
          'Dealing with constant interruptions: use the Eisenhower matrix.',
          'Choosing between projects: use value versus effort.',
          'Negotiating scope with others: use MoSCoW.',
          'Putting off the one thing that matters: do the hardest thing first.',
        ],
        paragraphs: ['Whatever you choose, write the priority on the task itself so that everyone who works on it can see it.'],
      },
      {
        h2: 'Keep priorities honest over time',
        paragraphs: [
          'A priority is a snapshot. A task that was high on Monday may be low by Wednesday because something changed. Review the list at the start of each day or in a short weekly planning session, and move tasks up or down on purpose rather than letting old labels pile up.',
          'Check for two warning signs. If most of your tasks are marked high, the levels have lost their meaning. If a high-priority task has not moved in several days, either it is blocked and someone needs to help, or it was never really a priority. Both are worth a conversation.',
          'In TaskFlow, every task carries a priority and a due date, and priorities show as colours on the list and the board, so the team sees the same picture without asking. The calendar view shows how the due dates spread across the week, which makes overloaded days easy to spot.',
        ],
      },
      {
        h2: 'A 15-minute routine for prioritizing as a team',
        paragraphs: [
          'Prioritizing works best as a short, regular habit rather than a big event. Once a week, gather the team for fifteen minutes with the full list of open tasks in front of you. Go through it in this order.',
        ],
        bullets: [
          'Remove anything that is no longer needed. Dead tasks make every other task harder to see.',
          'Mark the few tasks that are blocking other people. These come first because they unlock more work.',
          'Mark the tasks with a fixed deadline this week.',
          'Pick the top three outcomes for the team, and make sure at least one person owns each.',
          'Agree what will wait. Say it out loud, so nobody is surprised on Friday.',
        ],
      },
      {
        h2: 'A worked example: a five-person team on a Monday',
        paragraphs: [
          'Imagine a small marketing team with thirty open tasks. Using high, medium and low, they first mark everything that has an external deadline this week: the newsletter, a webinar slide deck and a client report. That leaves three high-priority items.',
          'Next they look for blockers. The webinar needs the product screenshots from design, so the screenshot task becomes high priority too, even though it looks small. Then they apply value versus effort to what remains: a quick fix to the pricing page copy is high value and low effort, so it moves up, while a full website redesign is high value and high effort, so it becomes a project with its own plan instead of a task competing for this week.',
          'In twenty minutes the team has four high-priority tasks, each with an owner, and a clear list of things that will wait. Nobody had to guess, and nobody had to ask the manager.',
        ],
      },
      {
        h2: 'Common prioritization mistakes',
        bullets: [
          'Marking everything high priority, which removes the meaning of the label.',
          'Prioritizing by who asked loudest instead of by impact.',
          'Never revisiting priorities, so last month’s urgent tasks stay at the top.',
          'Ignoring dependencies, so a low-priority task that blocks three others stays at the bottom.',
          'Keeping priorities in your head instead of on the task, where the team cannot see them.',
          'Treating prioritizing as a one-time job rather than a weekly habit.',
        ],
        paragraphs: [
          'If you fix only one of these, fix the first. A short high-priority list does more for a team than any scoring system.',
        ],
      },
    ],
    related: ['/online-task-planner', '/blog/weekly-planning-template', '/blog/how-to-assign-tasks-across-a-team', '/task-management-app'],
  },
  {
    slug: 'kanban-vs-to-do-list',
    title: 'Kanban vs To-Do List: Which Is Better for Your Team?',
    seoTitle: 'Kanban vs To-Do List: Which Should Your Team Use? | TaskFlow',
    description:
      'A to-do list shows what has to be done. A Kanban board shows where each piece of work is. Here is how to choose, and when to use both.',
    date: '2026-10-27',
    readMinutes: 6,
    intro:
      'Both a to-do list and a Kanban board help you manage tasks, but they answer different questions. A list tells you what is left. A board tells you where everything stands. Knowing the difference makes it easier to pick the right one for your team, and to know when it is time to switch.',
    sections: [
      {
        h2: 'What a to-do list is good at',
        paragraphs: [
          'A list is quick. You can add an item in seconds, reorder it and tick it off. It works well for personal work, short projects and anything where each task is simply either done or not done.',
          'A list is also easy to learn. Nobody needs training to use one, and it fits on a single screen or a sheet of paper. For a one-person job or a small project that lasts a few days, that simplicity is hard to beat.',
          'Its weakness is that a long list hides the state of the work. A task can be started, blocked or waiting for review, and a plain checkbox cannot say so. As soon as a second person depends on your tasks, the list starts to need extra notes just to explain what is going on.',
        ],
      },
      {
        h2: 'What a Kanban board is good at',
        paragraphs: [
          'A board splits work into lanes such as Backlog, To Do, In Progress and Done. Because each card sits in a lane, you see at a glance how much is waiting, how much is under way and where work is piling up.',
          'Boards also make teamwork visible. When several people share work, everyone sees the same picture without asking for a status update. Moving a card is the update.',
          'The cost of a board is a little more discipline. Cards have to be moved when the work changes, or the board stops telling the truth. A board that is out of date is worse than a list, because it looks reliable and is not.',
        ],
      },
      {
        h2: 'The same week, two ways',
        paragraphs: [
          'Imagine a team of four preparing a product launch. As a list, there are thirty items: write the announcement, update the pricing page, record a demo, brief support and so on. Every morning someone has to ask which of those are started, which are finished and which are stuck.',
          'On a board, the same thirty cards are spread over the lanes. Ten sit in Backlog, six in To Do, eight in In Progress and six in Done. Without asking anyone, you can see that eight things are open at once, that nothing has been waiting a long time, and that the demo video has not moved for three days. The question for the stand-up becomes obvious.',
        ],
      },
      {
        h2: 'How to choose',
        bullets: [
          'One person, simple tasks: a to-do list is enough.',
          'Several people, work that moves through stages: use a board.',
          'Work that needs review before it is finished: use a board with a review step.',
          'Many small tasks that repeat: a list or a checklist is faster.',
          'Work you need to report on: a board shows progress without extra effort.',
          'Both: keep a list for planning and a board for tracking progress.',
        ],
      },
      {
        h2: 'Signs your team has outgrown a list',
        bullets: [
          'People keep asking “is this done yet?” in chat.',
          'Tasks are marked complete before anyone has checked them.',
          'Nobody can say how many things are in progress at once.',
          'The list is longer than anyone is willing to scroll.',
          'Handoffs between people get lost.',
        ],
        paragraphs: ['If two or three of these sound familiar, a board will probably save you more time than it costs.'],
      },
      {
        h2: 'A tip for using a board well',
        paragraphs: [
          'Limit how much is In Progress at the same time. If a lane keeps growing, finish something before you start something new. A board shows the bottleneck, but only you can clear it.',
          'Keep the lanes few and meaningful. Four lanes are enough for most teams. Add a lane only when work genuinely waits at a stage that the existing lanes cannot describe, such as a review step.',
        ],
      },
      {
        h2: 'You do not have to pick one',
        paragraphs: [
          'The best setups let you look at the same tasks in both ways. In TaskFlow, the list view and the Kanban board show the same tasks, so a move on the board updates the list and the other way round. Plan in the list, run the day on the board, and switch whenever one view answers your question better than the other.',
        ],
      },
      {
        h2: 'Moving from a list to a board in one afternoon',
        paragraphs: [
          'You do not need a big rollout. Most teams can switch in an afternoon by following a few steps, and keep the old list as a backup until they trust the board.',
        ],
        bullets: [
          'Start with the lanes: Backlog, To Do, In Progress and Done are enough.',
          'Put every open task on a card, with an owner and a due date.',
          'Sort the cards into lanes by their real status, not by what you hope is true.',
          'Agree one rule for moving a card, such as “move it as soon as you start working on it”.',
          'Use the board in your next stand-up instead of asking for verbal updates.',
          'After two weeks, ask what is missing, and only then add lanes or labels.',
        ],
      },
      {
        h2: 'What each person looks at',
        paragraphs: [
          'A board serves different people in different ways, which is part of why it works for teams. An employee looks at their own cards to decide what to work on next. A manager looks at the whole board to see where work is piling up and who needs help. An approver looks at what has been submitted and is waiting for a decision.',
          'The same applies to lists. A personal list is for deciding the next action, and a shared list is for agreeing what is in scope. Using each for its own job stops a single view from becoming overloaded with every kind of information.',
        ],
      },
      {
        h2: 'Common mistakes when teams adopt a board',
        bullets: [
          'Adding too many lanes, so cards spend more time being sorted than worked on.',
          'Letting cards sit in In Progress long after the work stopped.',
          'Using the board as a wish list, so Backlog grows without anyone reviewing it.',
          'Creating cards with no owner, so nobody feels responsible for moving them.',
          'Keeping a separate list “just in case”, which splits the truth in two.',
        ],
        paragraphs: [
          'None of these are reasons to avoid a board. They are reasons to agree on a few simple rules and to look at the board together regularly. A board that the team looks at every day stays accurate on its own.',
        ],
      },
    ],
    related: ['/kanban-board-software', '/blog/how-to-spot-and-fix-kanban-bottlenecks', '/free-task-manager', '/task-management-app'],
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
      'An approval step protects quality, but a badly designed one just creates a queue. The goal is simple: finished work gets a second look quickly, and people always know what happens next. This guide covers who should review, what a good submission looks like, how to give feedback and how to keep the whole thing fast.',
    sections: [
      {
        h2: 'What an approval workflow is, and when you need one',
        paragraphs: [
          'A task approval workflow adds one step between “I think this is finished” and “this is finished”. The person who did the work submits it, a reviewer checks it, and only then does the task count as complete. If the reviewer finds a problem, the work goes back with a note.',
          'You need one when the cost of a mistake is higher than the cost of a short delay. Typical cases are client deliverables, financial or legal documents, content that goes public, work done by new team members and anything that other people will build on. For routine, low-risk tasks, an approval step is usually just friction.',
        ],
      },
      {
        h2: 'Decide who reviews what',
        paragraphs: [
          'Start by choosing the reviewer for each kind of work. In a small team that may be one person. In a larger one, a two-step flow often works well: a team manager checks the work first because they know the details, and a final approver confirms it before it counts as done.',
          'Write the rule down so nobody has to guess who is waiting on whom. A short table is enough: type of work, first reviewer, final approver and the target response time.',
          'Avoid making one person the reviewer for everything. A single reviewer becomes the bottleneck, and reviews begin to be rushed. If a manager is away, there should be a named backup.',
        ],
      },
      {
        h2: 'Make submissions easy to review',
        bullets: [
          'Add a short note saying what was done and anything the reviewer should check.',
          'Attach the files or links that prove it.',
          'Submit one task at a time rather than a batch of unrelated work.',
          'Say what you are unsure about. A reviewer who knows where to look gives a better review in less time.',
        ],
        paragraphs: [
          'A good submission note takes one minute to write and saves the reviewer ten. Compare “done” with “Updated the pricing table and the footer links; please check the annual price on mobile.” The second tells the reviewer what changed and where the risk is.',
        ],
      },
      {
        h2: 'Give feedback that can be acted on',
        paragraphs: [
          'When work is sent back, the note should say what to change, not just that it was rejected. A task that returns to “in progress” with a clear reason is fixed faster than one that comes back with silence.',
          'Good feedback is specific, points to the place that needs work and explains the reason when it is not obvious. Separate the things that must change from the things that are only suggestions, so the person does not have to guess which is which.',
          'Keep the tone about the work. The aim of a review is a better result, and people submit more openly when sending something back does not feel like a verdict on them.',
        ],
      },
      {
        h2: 'Keep reviews from piling up',
        bullets: [
          'Agree on a target response time, such as one working day.',
          'Give reviewers a single queue of what is waiting, instead of asking them to hunt through messages.',
          'Send a notification when something needs review, so it is not forgotten.',
          'Review in small batches at set times rather than whenever something arrives.',
          'Track how long tasks wait for review. If the wait keeps growing, add a reviewer or narrow what needs approval.',
        ],
      },
      {
        h2: 'Common mistakes',
        bullets: [
          'Requiring approval for everything, so reviewers cannot tell what is important.',
          'Having no deadline for the review, so work waits for days.',
          'Rejecting work without a reason.',
          'Letting approvals happen in chat, where nobody can find them later.',
          'Having a different process for every team, so nobody knows the rules.',
        ],
      },
      {
        h2: 'Keep a record',
        paragraphs: [
          'Log who approved or rejected each task and when. A history makes it easy to answer questions later and to spot steps where work usually gets stuck.',
          'In TaskFlow, employees submit finished work for review, and a reviewer approves it or sends it back with a note. Each step is written to the task history. The Business plan adds a two-step flow, where the manager approves first and an admin gives the final approval.',
        ],
      },
      {
        h2: 'An example: a two-step approval in practice',
        paragraphs: [
          'Picture a team that produces monthly reports for clients. A team member finishes a report and submits it with a note: “Numbers match the finance sheet. Please check the summary on page two.” The task now shows as waiting for review.',
          'The team manager opens the review queue, reads the summary and spots a wrong date. They send the task back with a note saying which date and what it should be. The task returns to In Progress, and the team member fixes it and submits again within the hour.',
          'This time the manager approves, and the task moves on to the final approver, an admin, who checks that the report follows the client’s template and gives the final approval. Only now is the task marked complete. The whole trail, from first submission to final approval, sits on the task.',
        ],
      },
      {
        h2: 'How to tell whether your workflow is working',
        paragraphs: [
          'An approval workflow is a means to an end. It is working if quality goes up without work slowing down. You can check this without special tools by looking at three things over a month.',
        ],
        bullets: [
          'How long tasks wait for review. If the median is more than a working day, reviewers need more capacity or a clearer schedule.',
          'How many tasks are sent back, and for what reasons. If the same reason repeats, fix it at the source with a template or a checklist.',
          'How many mistakes reach clients or customers after approval. If this is not falling, reviews are not catching the right things.',
        ],
      },
      {
        h2: 'Approval workflows for teams of different sizes',
        paragraphs: [
          'A team of three does not need the same process as a department of thirty. In a very small team, one reviewer is usually enough, and the approval can be fast because everyone knows the work. The key is that it is a separate person from the one who did the work.',
          'As the team grows, add structure only where it solves a real problem. Managers can review the work of their own teams, which keeps reviews close to the people who know the details, while a final approver keeps standards consistent across teams. Resist the urge to add a step for every risk. Each extra step adds waiting time, and people begin to submit work half-checked because they expect the next person to catch it.',
        ],
      },
    ],
    related: ['/task-approval-workflow-software', '/blog/how-to-keep-task-history-clear', '/employee-task-tracking', '/kanban-board-software'],
  },
  {
    slug: 'weekly-planning-template',
    title: 'Weekly Planning Template: Plan Your Week in 20 Minutes',
    seoTitle: 'Weekly Planning Template: 20-Minute Routine | TaskFlow',
    description:
      'A simple weekly planning routine you can repeat every Friday or Monday: review, list, prioritize, schedule and leave room for surprises.',
    date: '2026-10-27',
    readMinutes: 6,
    intro:
      'A weekly plan does not need to be long. Twenty minutes at the start or end of the week is enough to see what matters, spot clashes and avoid starting Monday with a blank page. This template walks you through five short steps that you can repeat every week, alone or with your team.',
    sections: [
      {
        h2: 'Why a weekly plan works better than a daily one',
        paragraphs: [
          'A daily plan reacts to whatever happened this morning. A monthly plan is too far away to be useful. A week is long enough to fit real projects and short enough that you can still predict most of it. It is also the natural rhythm of meetings, deadlines and reports.',
          'Planning once a week also saves effort. Instead of deciding what to do every morning, you decide once, then adjust. The morning question becomes “is the plan still right?”, which takes a minute.',
        ],
      },
      {
        h2: 'Step 1: Review last week (3 minutes)',
        paragraphs: [
          'Look at what was finished and what was not. Anything unfinished is either still important, in which case it carries over, or it is not, in which case you drop it.',
          'Ask one question: what slowed me down? If the answer is the same as last week, that is the thing to fix. It might be too many meetings, unclear requests or work that was waiting for someone else.',
        ],
      },
      {
        h2: 'Step 2: List everything for this week (5 minutes)',
        paragraphs: [
          'Write down every task, meeting and deadline you already know about. Put each task in your task manager with a due date so it is not only in your head.',
          'Include the small things: replies you owe, approvals people are waiting for, errands that need an hour. Small tasks add up, and forgetting them is how a week that looked light turns out to be full.',
        ],
      },
      {
        h2: 'Step 3: Pick your priorities (4 minutes)',
        paragraphs: [
          'Choose the three outcomes that would make the week a success. Mark the tasks that lead to them as high priority and leave the rest at medium or low.',
          'Phrase each outcome as a result, not an activity. “Pricing page live” is better than “work on pricing page”, because you can tell when it is done.',
        ],
      },
      {
        h2: 'Step 4: Put it on the calendar (5 minutes)',
        paragraphs: [
          'Look at the calendar next to your task list. Block time for the high-priority tasks and notice which days are already full of meetings. Move tasks to days that have room.',
          'Estimate honestly. If a task takes half a day, give it half a day on the calendar. Most overloaded weeks are not caused by too much work but by a plan that assumed every task would take an hour.',
        ],
      },
      {
        h2: 'Step 5: Leave space (3 minutes)',
        paragraphs: [
          'Do not plan every hour. Keep some space for requests and problems you could not predict. If the week looks full, move something to the next one now rather than on Thursday.',
          'A useful rule is to plan about two thirds of your available time. The rest absorbs interruptions, and on a quiet week you can pull the next task forward.',
        ],
      },
      {
        h2: 'A template you can copy',
        bullets: [
          'Last week: what I finished, what carries over, what slowed me down.',
          'This week’s three outcomes: one line each, written as results.',
          'Fixed commitments: meetings, deadlines and days off.',
          'Task list: each task with an owner, a priority and a due date.',
          'Buffer: the time I am keeping free.',
          'One thing I will not do this week.',
        ],
      },
      {
        h2: 'Make it a habit',
        bullets: [
          'Do it at the same time every week.',
          'Use the same list each time.',
          'Share the plan with your team so they know what to expect.',
          'Check it for two minutes each morning and adjust.',
        ],
        paragraphs: [
          'For teams, share the plan before the week starts, then use a short weekly meeting to compare it with reality. In TaskFlow, the calendar view shows tasks by due date next to meetings, which makes the clash-spotting step in this template quick.',
        ],
      },
      {
        h2: 'Planning the week as a team: a 30-minute meeting',
        paragraphs: [
          'The personal template above works for individuals. For a team, run a short weekly meeting at the start of the week, with each person’s plan prepared in advance. The meeting is not for reading out lists. It is for finding clashes and agreeing on priorities.',
        ],
        bullets: [
          'Minutes 0 to 5: look at last week. What was finished, what carried over and why.',
          'Minutes 5 to 15: each person names their top three outcomes for the week and any help they need.',
          'Minutes 15 to 25: look at the calendar together. Who is away, which days are overloaded and where do two people need the same thing?',
          'Minutes 25 to 30: confirm the plan, write down the decisions and assign any new tasks.',
        ],
      },
      {
        h2: 'What to do when the plan falls apart',
        paragraphs: [
          'Every week plan meets reality at some point. A client calls with an urgent request, someone falls ill or a task turns out to be much bigger than expected. A plan is not a promise. It is a baseline that lets you see what changed.',
          'When it happens, do a two-minute replan rather than carrying on and hoping. Ask what has to move to make room for the new thing. Pick something to postpone on purpose, tell the people who are waiting for it and update the due date. A visible, deliberate change is much better than a task that quietly becomes late.',
          'Also note the cause. If urgent requests derail the plan every week, increase the buffer you leave in step five, or agree a way for urgent requests to be raised and ranked.',
        ],
      },
      {
        h2: 'Questions for your weekly review',
        bullets: [
          'What did I plan and not finish, and what does that tell me?',
          'Which task took much longer than I expected?',
          'Which meeting could have been a message?',
          'What am I postponing, and why?',
          'What one change would make next week easier?',
          'Who do I need to talk to before the week starts?',
        ],
        paragraphs: [
          'Answering even two or three of these each week builds a record of what slows you down. After a month, patterns appear, and patterns are much easier to fix than individual bad weeks.',
        ],
      },
    ],
    related: ['/online-task-planner', '/blog/how-to-prioritize-tasks', '/blog/how-to-turn-meeting-action-items-into-tasks', '/task-management-app'],
  },
];
