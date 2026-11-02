# TaskFlow keyword intelligence system (Step 1)

The working file is [keyword-map.csv](keyword-map.csv): 269 keywords, each with a category, search intent, cluster, target page, role (primary or secondary) and priority. How pages are added to the site is in [../seo.md](../seo.md).

**What is estimated and what is not.** `priority` and `competition_est` are judgment calls from what TaskFlow does and who it competes with. `monthly_volume` and `keyword_difficulty` are empty on purpose: fill them from the tools below rather than trusting guesses. Treat `competition_est` as a starting hypothesis to confirm.

## Who TaskFlow is for (drives every choice below)

- Small to mid-sized teams (roughly 2 to 50 people) where a manager assigns work and staff submit it for approval.
- Teams moving off spreadsheets or off heavier tools (Trello, Asana, ClickUp, Monday).
- Dev teams that want tasks to move from GitHub pushes and pull requests (the GitHub integration).
- Differentiators worth owning in search, because big competitors rank poorly for them: the approval workflow, built-in time tracking, the employee/manager/admin roles, the GitHub link, and a real free plan.

## The eight categories, applied to TaskFlow

| Category | Examples in the CSV |
| --- | --- |
| Product | task management app, kanban board software, task tracking software |
| Problem | track employee tasks, track time spent on tasks, approve or reject completed tasks |
| Solution | task approval workflow software, task timer app for teams, create tasks with ai |
| Technology | task manager with github integration, task planner with google calendar sync, free task management app for android |
| Audience | free task manager for small teams, task management for remote teams, project management for startups |
| Comparison | trello alternative, asana alternative, clickup alternative, kanban vs to do list |
| Educational | what is a kanban board, how to prioritize tasks, how to delegate tasks |
| Transactional | best task management app for teams, cheap task management software for teams, task management software free trial |

## Page map

Already built (see `frontend/src/seo/seoPages.js` and `siteConfig.js`): `/task-management-app`, `/free-task-manager`, `/online-task-planner`, `/kanban-board-software`, `/employee-task-tracking`, `/pricing`, `/features`, `/security`, `/docs`, and four blog posts (prioritize tasks, kanban vs to-do, approval workflow, weekly planning).

Proposed new landing pages, in build order (all P1 clusters first):

1. `/task-approval-workflow-software` (approvals; lowest competition, strongest differentiator)
2. `/time-tracking-task-management`
3. `/github-task-tracking`
4. `/trello-alternative`, `/asana-alternative`, `/clickup-alternative` (comparison pages have the highest buying intent)
5. `/task-management-remote-teams`, `/project-management-small-teams`
6. Later: `/ai-task-manager`, `/team-leave-management`, `/task-management-agencies`, `/monday-alternative`, `/todoist-alternative`, `/team-calendar-meetings`

New blog posts (P2 and P3, written to feed the pages above with internal links): what is task management, what is a kanban board, how to delegate tasks, how to track employee tasks, how to track time on tasks, best task management tools, project task list template, Eisenhower matrix, and a few more listed in the CSV.

Every `target_page` that does not exist yet is a page to create. Never point two pages at the same primary keyword.

## How to prioritize

Score each keyword on four things, then sort by the result. Do not sort by volume.

1. **Commercial intent** (does the searcher want software?). Comparison, "alternative", "best", "pricing", "free" and audience terms score highest.
2. **Fit** (can TaskFlow honestly deliver what the searcher wants today?). Only claim what the app does, as the rules in `docs/seo.md` require.
3. **Realistic competition.** A new domain should not start on "task management software" (dominated by Asana, Monday, ClickUp, Trello). Start with long-tail and low-competition terms, then work up.
4. **Volume**, last. About 50 monthly searches for "task approval workflow software" can bring in more paying teams than 5,000 for "what is task management".

The P1/P2/P3 column is that judgment applied once. Re-rank it after volume and difficulty are filled in.

## Filling in the data (your part)

1. **Google Search Console.** Check whether any of these terms already show impressions. This is the best signal because it is real data for your own site.
2. **Google Keyword Planner.** Paste the `keyword` column into "Get search volume and forecasts". Copy volume into `monthly_volume`.
3. **Ahrefs or Semrush.** Paste the same list into Keywords Explorer to get `keyword_difficulty`, plus the "also rank for" and "questions" lists.
4. **Google Trends.** Compare the top 5 cluster terms (for example "kanban board" vs "task management app") to see which are growing.
5. **Check the real results page** for every P1 keyword in an incognito window. If the first page is all huge brands, or all blog posts when you plan a landing page, adjust the target.

## Related questions to answer on each page

Collect these from Google's "People also ask" box, Ahrefs "Questions" and Search Console queries, and answer them in the page's FAQ (the FAQ schema is already supported). Starter questions:

- Is there a free task management app for teams? (`/free-task-manager`)
- How do I track how long tasks take? (`/time-tracking-task-management`)
- How do I approve work my team has finished? (`/task-approval-workflow-software`)
- Can tasks update automatically from GitHub? (`/github-task-tracking`)
- What is a simpler alternative to Asana or ClickUp? (comparison pages)
- Does it work on my phone? (`/task-management-app`)

## Next steps

1. Fill in volume and difficulty (above), then re-sort by priority.
2. Add the first new page (`/task-approval-workflow-software`) to `LANDING_PAGES` in `seoPages.js`, following `docs/seo.md`.
3. Step 2 (page creation) uses the primary keyword, secondary keywords and questions from this file as the brief for each page.
