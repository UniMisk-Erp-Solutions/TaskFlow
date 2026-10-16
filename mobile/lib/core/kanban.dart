import 'models.dart';

class KanbanColumnDef {
  const KanbanColumnDef(this.id, this.label, this.hint);
  final String id;
  final String label;
  final String hint;
}

const kanbanColumns = [
  KanbanColumnDef('backlog', 'Backlog', 'Planned for later'),
  KanbanColumnDef('to_do', 'To Do', 'Ready to start'),
  KanbanColumnDef('in_progress', 'In Progress', 'Being worked on'),
  KanbanColumnDef('done', 'Done', 'Finished or awaiting review'),
];

String columnFor(Task task) {
  final c = task.kanbanColumn;
  if (c != null && kanbanColumns.any((e) => e.id == c)) return c;
  switch (task.status) {
    case 'completed':
    case 'submitted':
      return 'done';
    case 'blocked':
    case 'changes_requested':
      return 'backlog';
    case 'in_progress':
    case 'rejected':
      return 'in_progress';
    default:
      return 'to_do';
  }
}

int compareTasks(Task a, Task b) {
  final d = a.kanbanOrder.compareTo(b.kanbanOrder);
  if (d != 0) return d;
  final c = (a.createdAt ?? '').compareTo(b.createdAt ?? '');
  return c != 0 ? c : a.id.compareTo(b.id);
}

double nextOrder(List<Task> tasks, String column, String movingId) {
  final siblings = tasks.where((t) => columnFor(t) == column && t.id != movingId).toList()..sort(compareTasks);
  return (siblings.isEmpty ? 0 : siblings.last.kanbanOrder) + 1024;
}

const approvedVisibleMs = 60000;

/// Milliseconds before an approved task leaves the Done column; null when not applicable.
int? approvedTimeLeftMs(Task task, DateTime now) {
  if (task.status != 'completed') return null;
  final stamp = DateTime.tryParse(task.approvedAt ?? task.updatedAt ?? '');
  if (stamp == null) return null;
  final left = stamp.millisecondsSinceEpoch + approvedVisibleMs - now.millisecondsSinceEpoch;
  if (left < 0) return 0;
  return left > approvedVisibleMs ? approvedVisibleMs : left;
}

/// When an approved task leaves the Done column; null when it is not an approved task.
DateTime? approvedExpiry(Task task) {
  if (task.status != 'completed') return null;
  final stamp = DateTime.tryParse(task.approvedAt ?? task.updatedAt ?? '');
  return stamp?.add(const Duration(milliseconds: approvedVisibleMs));
}
