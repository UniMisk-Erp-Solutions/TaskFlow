import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../state/auth_state.dart';
import '../state/data_state.dart';
import '../ui/live.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'extras.dart';

class TaskFormScreen extends StatefulWidget {
  const TaskFormScreen({super.key, this.projectId});
  final String? projectId;
  @override
  State<TaskFormScreen> createState() => _TaskFormScreenState();
}

class _TaskFormScreenState extends State<TaskFormScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  late List<String> _assignees = [context.read<AuthController>().profile!.id];
  String _priority = 'medium';
  String _due = '';
  String _dueTime = '';
  late String _project = widget.projectId ?? '';
  bool _busy = false;
  String _error = '';

  Future<void> _save() async {
    if (_title.text.trim().isEmpty) {
      setState(() => _error = 'Title is required.');
      return;
    }
    if (_assignees.isEmpty) {
      setState(() => _error = 'Select at least one assignee.');
      return;
    }
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      final task = await context.read<DataController>().createTask({
        'title': _title.text.trim(),
        'description': _description.text.trim(),
        'assignee_ids': _assignees,
        'priority': _priority,
        'due_date': _due.isEmpty ? null : _due,
        'due_time': _due.isEmpty || _dueTime.isEmpty ? null : _dueTime,
        'project_id': _project.isEmpty ? null : _project,
      });
      if (mounted) context.pushReplacement('/task/${task.id}');
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e, 'Could not create the task.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<DataController>();
    final people = data.people.isEmpty
        ? [(context.read<AuthController>().profile!.id, context.read<AuthController>().profile!.displayName)]
        : [for (final p in data.people) (p.id, p.displayName)];
    return Scaffold(
      appBar: AppBar(title: const Text('New task')),
      body: ListView(padding: kPad, children: [
        if (_error.isNotEmpty) ...[Banner_(_error), const Gap(12)],
        TextField(controller: _title, autofocus: true, textCapitalization: TextCapitalization.sentences, decoration: const InputDecoration(labelText: 'Title')),
        const Gap(14),
        TextField(controller: _description, minLines: 3, maxLines: 6, decoration: const InputDecoration(labelText: 'Description', alignLabelWithHint: true)),
        const Gap(14),
        MultiSelectField(label: 'Assignees', values: _assignees, options: people, onChanged: (v) => setState(() => _assignees = v)),
        const Gap(14),
        SelectField<String>(
          label: 'Project',
          value: _project,
          options: [('', 'No project (individual)'), for (final p in data.projects) (p.id, p.name)],
          onChanged: (v) => setState(() => _project = v),
        ),
        const Gap(14),
        Segment2<String>(
          value: _priority,
          options: const [('low', 'Low', null), ('medium', 'Medium', null), ('high', 'High', null)],
          onChanged: (v) => setState(() => _priority = v),
        ),
        const Gap(14),
        DateField(label: 'Due date', value: _due, onChanged: (v) => setState(() => _due = v)),
        if (_due.isNotEmpty) ...[const Gap(14), TimeField(label: 'Due time', value: _dueTime, onChanged: (v) => setState(() => _dueTime = v))],
        const Gap(22),
        FilledButton(onPressed: _busy ? null : _save, child: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4)) : const Text('Create task')),
      ]),
    );
  }
}

const _adminStatuses = ['pending', 'in_progress', 'submitted', 'completed', 'rejected', 'changes_requested', 'blocked'];
const _employeeStatuses = ['pending', 'in_progress', 'submitted', 'blocked'];

class TaskDetailScreen extends StatefulWidget {
  const TaskDetailScreen({super.key, required this.id});
  final String id;
  @override
  State<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends State<TaskDetailScreen> {
  Task? _fetched;
  List<Map<String, dynamic>> _subtasks = [];
  final _subtaskTitle = TextEditingController();
  bool _addingSubtask = false;
  bool _loadingFetch = false;
  String _error = '';
  String _busy = '';
  bool _editing = false;
  Object _timelineKey = 0;
  final _note = TextEditingController();

  // edit draft
  final _title = TextEditingController();
  final _description = TextEditingController();
  List<String> _assignees = [];
  String _priority = 'medium';
  String _due = '';
  String _dueTime = '';
  String _project = '';

  @override
  void initState() {
    super.initState();
    final data = context.read<DataController>();
    _loadingFetch = data.taskById(widget.id) == null;
    _loadRecord();
  }

  /// Loads the full record (subtasks come with it) and keeps the list-cached task as the display source.
  Future<void> _loadRecord() async {
    try {
      final json = Map<String, dynamic>.from(await Api.instance.get('/tasks/${widget.id}') as Map);
      if (!mounted) return;
      setState(() {
        _fetched = Task(json);
        _subtasks = (json['subtasks'] as List? ?? const []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      });
    } catch (e) {
      if (mounted && context.read<DataController>().taskById(widget.id) == null) setState(() => _error = errorText(e, 'Task not found.'));
    } finally {
      if (mounted) setState(() => _loadingFetch = false);
    }
  }

  Future<void> _addSubtask(Task parent) async {
    final title = _subtaskTitle.text.trim();
    if (title.isEmpty) return;
    final me = context.read<AuthController>().profile!;
    final data = context.read<DataController>();
    setState(() {
      _addingSubtask = true;
      _error = '';
    });
    try {
      // Admins pass the parent's team on; employees add subtasks for themselves.
      final assignees = me.isAdmin && parent.assigneeIds.isNotEmpty ? parent.assigneeIds : [me.id];
      await Api.instance.post('/tasks', {
        'title': title,
        'description': '',
        'assignee_ids': assignees,
        'priority': parent.priority,
        'project_id': parent.projectId,
        'parent_task_id': parent.id,
        'due_date': null,
        'due_time': null,
      });
      _subtaskTitle.clear();
      await _loadRecord();
      await data.load(silent: true);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e, 'Could not add the subtask.'));
    } finally {
      if (mounted) setState(() => _addingSubtask = false);
    }
  }

  @override
  void dispose() {
    _note.dispose();
    _subtaskTitle.dispose();
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  void _startEdit(Task task) {
    _title.text = task.title;
    _description.text = task.description ?? '';
    _assignees = [...task.assigneeIds];
    _priority = task.priority;
    _due = task.dueDate?.substring(0, 10) ?? '';
    _dueTime = (task.dueTime ?? '').length >= 5 ? task.dueTime!.substring(0, 5) : '';
    _project = task.projectId ?? '';
    setState(() => _editing = true);
  }

  Future<void> _run(String label, Future<void> Function() action, {VoidCallback? after}) async {
    setState(() {
      _busy = label;
      _error = '';
    });
    try {
      await action();
      _timelineKey = DateTime.now().microsecondsSinceEpoch;
      after?.call();
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<DataController>();
    final auth = context.watch<AuthController>();
    final task = data.taskById(widget.id) ?? _fetched;
    if (task == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Task')),
        body: _loadingFetch ? const Loader() : Padding(padding: const EdgeInsets.all(16), child: Banner_(_error.isEmpty ? 'Task not found.' : _error)),
      );
    }

    final me = auth.profile!;
    final isAdmin = me.isAdmin;
    final mine = task.assigneeIds.contains(me.id);
    final status = task.status;
    final canSubmit = mine && const ['pending', 'in_progress', 'rejected', 'changes_requested', 'blocked'].contains(status);
    final canReview = isAdmin && status == 'submitted';
    final canReopen = isAdmin && (status == 'completed' || status == 'changes_requested');
    final overdue = isOverdue(task.dueDate, status);
    final now = DateTime.now();
    final mySessions = data.sessions.where((s) => s.taskId == task.id && s.userId == me.id).toList();
    final running = mySessions.any((s) => s.endedAt == null);
    final tracked = mySessions.fold<int>(0, (sum, s) => sum + s.seconds(now));
    final statuses = isAdmin ? _adminStatuses : _employeeStatuses;
    final statusOptions = [
      for (final s in {if (!statuses.contains(status)) status, ...statuses}) (s, statusLabel(s)),
    ];

    return Scaffold(
      appBar: AppBar(title: Text(_editing ? 'Edit task' : 'Task')),
      body: RefreshIndicator(
        onRefresh: () => data.load(),
        child: ListView(padding: kPad, children: [
          if (_error.isNotEmpty) ...[Banner_(_error, onClose: () => setState(() => _error = '')), const Gap(12)],
          if (_editing)
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                TextField(controller: _title, decoration: const InputDecoration(labelText: 'Title')),
                const Gap(14),
                TextField(controller: _description, minLines: 3, maxLines: 6, decoration: const InputDecoration(labelText: 'Description', alignLabelWithHint: true)),
                const Gap(14),
                MultiSelectField(
                  label: 'Assignees',
                  values: _assignees,
                  options: [for (final p in data.people) (p.id, p.displayName)],
                  onChanged: (v) => _assignees = v,
                ),
                const Gap(14),
                SelectField<String>(
                  label: 'Project',
                  value: _project,
                  options: [('', 'No project (individual)'), for (final p in data.projects) (p.id, p.name)],
                  onChanged: (v) => setState(() => _project = v),
                ),
                const Gap(14),
                Segment2<String>(
                  value: _priority,
                  options: const [('low', 'Low', null), ('medium', 'Medium', null), ('high', 'High', null)],
                  onChanged: (v) => setState(() => _priority = v),
                ),
                const Gap(14),
                DateField(label: 'Due date', value: _due, onChanged: (v) => setState(() => _due = v)),
                if (_due.isNotEmpty) ...[const Gap(14), TimeField(label: 'Due time', value: _dueTime, onChanged: (v) => setState(() => _dueTime = v))],
                const Gap(18),
                Row(children: [
                  FilledButton(
                    onPressed: _busy == 'save'
                        ? null
                        : () {
                            if (_title.text.trim().isEmpty) {
                              setState(() => _error = 'Title is required.');
                              return;
                            }
                            if (_assignees.isEmpty) {
                              setState(() => _error = 'Select at least one assignee.');
                              return;
                            }
                            _run('save', () => data.updateTask(task.id, {
                                  'title': _title.text.trim(),
                                  'description': _description.text.trim(),
                                  'priority': _priority,
                                  'due_date': _due.isEmpty ? null : _due,
                                  'due_time': _due.isEmpty || _dueTime.isEmpty ? null : _dueTime,
                                  'project_id': _project.isEmpty ? null : _project,
                                  'assignee_ids': _assignees,
                                }), after: () => setState(() => _editing = false));
                          },
                    child: const Text('Save'),
                  ),
                  const SizedBox(width: 8),
                  TextButton(onPressed: () => setState(() => _editing = false), child: const Text('Cancel')),
                ]),
              ]),
            )
          else
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(task.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.3)),
                const Gap(10),
                Wrap(spacing: 8, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                  StatusPill(status),
                  PriorityPill(task.priority),
                  if (task.projectName != null)
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.folder_outlined, size: 14, color: context.cs.primary),
                      const SizedBox(width: 4),
                      Text(task.projectName!, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: context.cs.primary)),
                    ]),
                ]),
                if ((task.description ?? '').isNotEmpty) ...[
                  const Gap(12),
                  Text(task.description!, style: TextStyle(color: context.app.muted, height: 1.45)),
                ],
                const Gap(14),
                Row(children: [
                  Icon(Icons.group_outlined, size: 18, color: context.app.muted),
                  const SizedBox(width: 8),
                  Expanded(child: Text(task.assigneeIds.map(data.nameOf).join(', ').isEmpty ? 'Unassigned' : task.assigneeIds.map(data.nameOf).join(', '))),
                ]),
                if (task.dueDate != null) ...[
                  const Gap(8),
                  Row(children: [
                    Icon(Icons.event_outlined, size: 18, color: overdue ? context.app.danger : context.app.muted),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Due ${formatDate(task.dueDate)}${task.dueTime != null ? ' at ${formatTime12(task.dueTime)}' : ''}${overdue ? ' · overdue' : ''}',
                        style: TextStyle(color: overdue ? context.app.danger : null),
                      ),
                    ),
                  ]),
                ],
                if (isAdmin) ...[
                  const Gap(14),
                  OutlinedButton.icon(
                    onPressed: () => _startEdit(task),
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: const Text('Edit task'),
                    style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40)),
                  ),
                ],
              ]),
            ),
          if (mine && !_editing && status != 'completed') ...[
            const Gap(12),
            AppCard(
              child: Row(children: [
                Icon(Icons.timer_outlined, color: context.cs.primary),
                const SizedBox(width: 10),
                LiveSeconds(
                  base: tracked,
                  running: running,
                  builder: (_, s) => Text(clock(s), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                ),
                const Spacer(),
                if (task.kanbanColumn == 'in_progress' || status == 'in_progress')
                  running
                      ? OutlinedButton.icon(
                          onPressed: _busy == 'pause' ? null : () => _run('pause', () => data.pauseTimer(task.id)),
                          icon: const Icon(Icons.pause),
                          style: OutlinedButton.styleFrom(minimumSize: const Size(0, 42), padding: const EdgeInsets.symmetric(horizontal: 16)),
                          label: const Text('Pause'))
                      : FilledButton.icon(
                          onPressed: _busy == 'start' ? null : () => _run('start', () => data.startTimer(task.id)),
                          icon: const Icon(Icons.play_arrow),
                          style: FilledButton.styleFrom(minimumSize: const Size(0, 42), padding: const EdgeInsets.symmetric(horizontal: 16)),
                          label: const Text('Start'))
                else
                  Flexible(child: Text('Move to In Progress to track time', textAlign: TextAlign.end, style: TextStyle(fontSize: 12, color: context.app.muted))),
              ]),
            ),
          ],
          if (!_editing && (isAdmin || mine)) ...[
            const Gap(12),
            AppCard(
              child: SelectField<String>(
                label: 'Status',
                value: status,
                options: statusOptions,
                onChanged: (next) {
                  if (next != status) _run('status', () => data.updateStatus(task.id, next));
                },
              ),
            ),
          ],
          if (!_editing && (canSubmit || canReview || canReopen)) ...[
            const Gap(12),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                SectionLabel(canSubmit ? 'Send for review' : 'Review'),
                TextField(
                  controller: _note,
                  minLines: 2,
                  maxLines: 5,
                  decoration: InputDecoration(
                    hintText: canSubmit
                        ? 'Add a note for the reviewer (optional)'
                        : canReview
                            ? 'Note (required when rejecting)'
                            : 'Why is it being reopened? (optional)',
                  ),
                ),
                const Gap(12),
                if (canSubmit)
                  FilledButton.icon(
                    onPressed: _busy == 'submit' ? null : () => _run('submit', () => data.submitTask(task.id, _note.text.trim()), after: _note.clear),
                    icon: const Icon(Icons.send, size: 18),
                    label: const Text('Submit for review'),
                  ),
                if (canReview)
                  Row(children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _busy == 'approve' ? null : () => _run('approve', () => data.approveTask(task.id, _note.text.trim()), after: _note.clear),
                        icon: const Icon(Icons.check),
                        label: const Text('Approve'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(backgroundColor: context.app.danger),
                        onPressed: _busy == 'reject'
                            ? null
                            : () {
                                if (_note.text.trim().isEmpty) {
                                  setState(() => _error = 'Add a note explaining what needs to change.');
                                  return;
                                }
                                _run('reject', () => data.requestChanges(task.id, _note.text.trim()), after: _note.clear);
                              },
                        icon: const Icon(Icons.close),
                        label: const Text('Reject'),
                      ),
                    ),
                  ]),
                if (!canReview && canReopen)
                  OutlinedButton.icon(
                    onPressed: _busy == 'reopen'
                        ? null
                        : () => _run('reopen', () => data.requestChanges(task.id, _note.text.trim().isEmpty ? 'Reopened by admin' : _note.text.trim()), after: _note.clear),
                    icon: const Icon(Icons.undo),
                    label: const Text('Reopen'),
                  ),
              ]),
            ),
          ],
          if (!_editing && (_subtasks.isNotEmpty || isAdmin || mine)) ...[
            const Gap(18),
            SectionLabel('Subtasks${_subtasks.isEmpty ? '' : ' (${_subtasks.where((s) => s['status'] == 'completed').length}/${_subtasks.length} done)'}'),
            if (_subtasks.isEmpty) Text('No subtasks yet.', style: TextStyle(color: context.app.muted, fontSize: 13)),
            for (final st in _subtasks)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppCard(
                  padding: const EdgeInsets.all(12),
                  onTap: () => context.push('/task/${st['id']}'),
                  child: Row(children: [
                    Expanded(
                      child: Text('${st['title']}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontWeight: FontWeight.w700, decoration: st['status'] == 'completed' ? TextDecoration.lineThrough : null)),
                    ),
                    const SizedBox(width: 8),
                    StatusPill('${st['status']}'),
                  ]),
                ),
              ),
            if (isAdmin || mine)
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: _subtaskTitle,
                    textInputAction: TextInputAction.done,
                    textCapitalization: TextCapitalization.sentences,
                    onSubmitted: (_) => _addSubtask(task),
                    decoration: const InputDecoration(hintText: 'Add a subtask', isDense: true),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: _addingSubtask ? null : () => _addSubtask(task),
                  icon: _addingSubtask ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.add),
                  tooltip: 'Add subtask',
                ),
              ]),
          ],
          const Gap(18),
          AttachmentsSection(kind: 'tasks', itemId: task.id),
          const Gap(18),
          TimelineSection(kind: 'tasks', itemId: task.id, names: data.names, refreshKey: _timelineKey),
          if (isAdmin && !_editing) ...[
            const Gap(24),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(foregroundColor: context.app.danger),
              onPressed: () async {
                if (!await confirm(context, title: 'Delete task?', message: 'This cannot be undone.')) return;
                await _run('delete', () => data.deleteTask(task.id), after: () {
                  if (mounted) context.pop();
                });
              },
              icon: const Icon(Icons.delete_outline),
              label: const Text('Delete task'),
            ),
          ],
        ]),
      ),
    );
  }
}
