import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/format.dart';
import '../core/models.dart';
import '../state/auth_state.dart';
import '../state/data_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});
  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  final _search = TextEditingController();
  bool _meetings = false;
  String _filter = 'all';
  int _page = 1;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<DataController>();
    final auth = context.watch<AuthController>();
    final isAdmin = auth.isAdmin;
    final term = _search.text.trim().toLowerCase();

    final counts = <String, int>{
      'all': data.tasks.length,
      'pending': data.tasks.where((t) => t.status == 'pending').length,
      'in_progress': data.tasks.where((t) => t.status == 'in_progress').length,
      'submitted': data.tasks.where((t) => t.status == 'submitted').length,
      'completed': data.tasks.where((t) => t.status == 'completed').length,
      'overdue': data.tasks.where((t) => isOverdue(t.dueDate, t.status)).length,
    };

    final tasks = data.tasks.where((t) {
      final okFilter = _filter == 'all' ||
          (_filter == 'overdue' ? isOverdue(t.dueDate, t.status) : t.status == _filter);
      final okTerm = term.isEmpty || '${t.title} ${t.description ?? ''} ${t.projectName ?? ''}'.toLowerCase().contains(term);
      return okFilter && okTerm;
    }).toList()
      ..sort((a, b) => (b.createdAt ?? '').compareTo(a.createdAt ?? ''));

    final meetings = data.meetings
        .where((m) => term.isEmpty || '${m.title} ${m.description ?? ''}'.toLowerCase().contains(term))
        .toList()
      ..sort((a, b) => '${b.date ?? ''}${b.time ?? ''}'.compareTo('${a.date ?? ''}${a.time ?? ''}'));

    final paged = _meetings ? Paged<Object>(meetings, _page) : Paged<Object>(tasks, _page);
    final first = auth.profile?.displayName.split(' ').first ?? 'there';

    return RefreshIndicator(
      onRefresh: () => data.load(),
      child: ListView(
        padding: kPad,
        children: [
          Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Hello, $first', style: TextStyle(color: context.app.muted, fontSize: 13)),
                Text(_meetings ? 'Meetings' : 'Tasks', style: const TextStyle(fontSize: 27, fontWeight: FontWeight.w800, letterSpacing: -0.6)),
              ]),
            ),
            IconButton.filled(
              onPressed: () => context.push(_meetings ? '/meeting/new' : '/task/new'),
              icon: const Icon(Icons.add),
              tooltip: _meetings ? 'New meeting' : 'New task',
            ),
          ]),
          const Gap(14),
          Row(children: [
            for (final (label, value, color) in [
              ('Total', counts['all']!, null),
              ('Open', counts['pending']! + counts['in_progress']!, context.app.warning),
              ('Done', counts['completed']!, context.app.success),
              ('Overdue', counts['overdue']!, context.app.danger),
            ])
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: AppCard(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Column(children: [
                      Text('$value', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
                      Text(label, style: TextStyle(fontSize: 11, color: context.app.muted)),
                    ]),
                  ),
                ),
              ),
          ]),
          if (isAdmin && counts['submitted']! > 0) ...[
            const Gap(6),
            AppCard(
              onTap: () => setState(() {
                _meetings = false;
                _filter = 'submitted';
                _page = 1;
              }),
              child: Row(children: [
                Icon(Icons.inbox_outlined, color: context.app.warning),
                const SizedBox(width: 12),
                Expanded(
                  child: Text('${counts['submitted']} task${counts['submitted'] == 1 ? '' : 's'} waiting for your review',
                      style: TextStyle(fontWeight: FontWeight.w700, color: context.app.warning)),
                ),
                const Icon(Icons.chevron_right),
              ]),
            ),
          ],
          if (data.error.isNotEmpty) ...[const Gap(10), Banner_(data.error, tone: Tone.warning)],
          const Gap(14),
          Segment2<bool>(
            value: _meetings,
            options: const [(false, 'Tasks', Icons.check_box_outlined), (true, 'Meetings', Icons.videocam_outlined)],
            onChanged: (v) => setState(() {
              _meetings = v;
              _page = 1;
            }),
          ),
          const Gap(12),
          SearchField(controller: _search, hint: _meetings ? 'Search meetings' : 'Search tasks', onChanged: (_) => setState(() => _page = 1)),
          if (!_meetings) ...[
            const Gap(12),
            ChipBar<String>(
              value: _filter,
              counts: counts,
              options: const [
                ('all', 'All'),
                ('pending', 'Pending'),
                ('in_progress', 'In progress'),
                ('submitted', 'Under review'),
                ('completed', 'Completed'),
                ('overdue', 'Overdue'),
              ],
              onChanged: (v) => setState(() {
                _filter = v;
                _page = 1;
              }),
            ),
          ],
          const Gap(14),
          if (data.loading)
            const Loader()
          else if (paged.items.isEmpty)
            EmptyState(
              icon: _meetings ? Icons.videocam_outlined : Icons.check_circle_outline,
              title: _meetings ? 'No meetings' : 'No tasks here',
              message: term.isNotEmpty || _filter != 'all' ? 'Nothing matches your filters.' : 'New items will show up here.',
            )
          else
            for (final item in paged.items)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: item is Task ? _TaskTile(task: item) : _MeetingTile(meeting: item as Meeting),
              ),
          PagerBar(page: paged.current, pageCount: paged.pageCount, total: paged.total, onPage: (p) => setState(() => _page = p)),
        ],
      ),
    );
  }
}

class _TaskTile extends StatelessWidget {
  const _TaskTile({required this.task});
  final Task task;

  @override
  Widget build(BuildContext context) {
    final data = context.read<DataController>();
    final overdue = isOverdue(task.dueDate, task.status);
    final names = task.assigneeIds.map(data.nameOf).join(', ');
    return AppCard(
      accent: priorityColor(task.priority),
      onTap: () => context.push('/task/${task.id}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Text(task.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
          const SizedBox(width: 8),
          StatusPill(task.status),
        ]),
        const Gap(8),
        if (task.projectName != null)
          Row(children: [
            Icon(Icons.folder_outlined, size: 14, color: context.cs.primary),
            const SizedBox(width: 4),
            Text(task.projectName!, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: context.cs.primary)),
          ])
        else
          Row(children: [
            Icon(Icons.person_outline, size: 14, color: context.app.muted),
            const SizedBox(width: 4),
            Text('Individual', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: context.app.muted)),
          ]),
        const Gap(8),
        Row(children: [
          Icon(Icons.group_outlined, size: 14, color: context.app.muted),
          const SizedBox(width: 6),
          Expanded(
            child: Text(names.isEmpty ? 'Unassigned' : names,
                maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: context.app.muted)),
          ),
          if (task.dueDate != null) ...[
            Icon(Icons.event_outlined, size: 14, color: overdue ? context.app.danger : context.app.muted),
            const SizedBox(width: 4),
            Text(
              formatDate(task.dueDate) + (task.dueTime != null ? ' · ${formatTime12(task.dueTime)}' : ''),
              style: TextStyle(fontSize: 12, color: overdue ? context.app.danger : context.app.muted, fontWeight: overdue ? FontWeight.w700 : FontWeight.w400),
            ),
          ],
        ]),
      ]),
    );
  }
}

class _MeetingTile extends StatelessWidget {
  const _MeetingTile({required this.meeting});
  final Meeting meeting;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: () => context.push('/meeting/${meeting.id}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(meeting.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
          const SizedBox(width: 8),
          StatusPill(meeting.status),
        ]),
        const Gap(8),
        Row(children: [
          Icon(Icons.event_outlined, size: 14, color: context.app.muted),
          const SizedBox(width: 6),
          Text(
            (formatDate(meeting.date).isEmpty ? 'No date' : formatDate(meeting.date)) + (meeting.time != null ? ' · ${formatTime12(meeting.time)}' : ''),
            style: TextStyle(fontSize: 12, color: context.app.muted),
          ),
        ]),
      ]),
    );
  }
}
