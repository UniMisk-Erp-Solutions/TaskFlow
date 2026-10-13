export const KANBAN_COLUMNS = [
  { id: 'backlog', label: 'Backlog', description: 'Planned for later' },
  { id: 'to_do', label: 'To Do', description: 'Ready to start' },
  { id: 'in_progress', label: 'In Progress', description: 'Being worked on' },
  { id: 'done', label: 'Done', description: 'Finished or awaiting review' },
];

export function kanbanColumnForTask(task) {
  if (KANBAN_COLUMNS.some((column) => column.id === task?.kanban_column)) return task.kanban_column;
  if (task?.status === 'completed' || task?.status === 'submitted') return 'done';
  if (task?.status === 'blocked' || task?.status === 'changes_requested') return 'backlog';
  if (task?.status === 'in_progress' || task?.status === 'rejected') return 'in_progress';
  return 'to_do';
}

export function kanbanOrderForTask(task) {
  const order = Number(task?.kanban_order);
  return Number.isFinite(order) ? order : 0;
}

export function compareKanbanTasks(a, b) {
  const orderDelta = kanbanOrderForTask(a) - kanbanOrderForTask(b);
  if (orderDelta) return orderDelta;
  const createdDelta = String(a?.created_at || '').localeCompare(String(b?.created_at || ''));
  return createdDelta || String(a?.id || '').localeCompare(String(b?.id || ''));
}

export function priorityColor(priority) {
  if (priority === 'high') return '#db2777';
  if (priority === 'low') return '#2563eb';
  return '#16a34a';
}
