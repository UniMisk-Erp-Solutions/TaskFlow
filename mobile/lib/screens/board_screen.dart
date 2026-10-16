import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/kanban.dart';
import '../core/models.dart';
import '../state/auth_state.dart';
import '../state/data_state.dart';
import '../ui/live.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class BoardScreen extends StatefulWidget {
  const BoardScreen({super.key});
  @override
  State<BoardScreen> createState() => _BoardScreenState();
}

class _BoardScreenState extends State<BoardScreen> {
  final _search = TextEditingController();
  String _column = 'in_progress';
  bool _projectScope = false;
  int _page = 1;
  String _error = '';
  String _busyId = '';

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) {
      if (mounted) setState(() => _projectScope = p.getString('taskflow.kanban-scope') == 'project');
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _setScope(bool project) async {
    setState(() {
      _projectScope = project;
      _page = 1;
    });
    final p = await SharedPreferences.getInstance();
    await p.setString('taskflow.kanban-scope', project ? 'project' : 'individual');
  }

  Future<void> _move(DataController data, Task task, String target, {DateTime? endedAt}) async {
    setState(() {
      _error = '';
      _busyId = task.id;
    });
    try {
      await data.moveTask(task.id, target, nextOrder(data.tasks, target, task.id), workEndedAt: endedAt);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e, 'Could not move the task.'));
    } finally {
      if (mounted) setState(() => _busyId = '');
    }
  }

  Future<void> _requestMove(DataController data, Task task, String target, bool isAdmin) async {
    if (columnFor(task) == target) return;
    if (!isAdmin && columnFor(task) == 'in_progress' && (target == 'to_do' || target == 'backlog')) {
      setState(() => _error = 'A task that is In Progress cannot be moved back to To Do or Backlog.');
      return;
    }
    if (!isAdmin && target == 'done') {
      if (columnFor(task) != 'in_progress') {
        setState(() => _error = 'Move this task to In Progress before sending it for review.');
        return;
      }
      final result = await _reviewSheet(task);
      if (result == null) return;
      await _move(data, task, 'done', endedAt: result.endedAt);
      return;
    }
    await _move(data, task, target);
  }

  Future<({DateTime? endedAt})?> _reviewSheet(Task task) {
    var custom = false;
    var end = DateTime.now();
    return showModalBottomSheet<({DateTime? endedAt})>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) {
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Admin review needed', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
            const Gap(10),
            Text.rich(TextSpan(children: [
              TextSpan(text: task.title, style: const TextStyle(fontWeight: FontWeight.w800)),
              const TextSpan(text: ' will move to Done as '),
              TextSpan(text: 'Under review', style: TextStyle(fontWeight: FontWeight.w800, color: ctx.app.warning)),
              const TextSpan(text: '. An administrator must approve it before it is marked complete. If it is rejected, it returns to In Progress.'),
            ]), style: TextStyle(color: ctx.app.muted, height: 1.45)),
            const Gap(14),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: custom,
                  onChanged: (v) => setSheet(() => custom = v ?? false),
                  title: const Text('Set a different end time', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
                if (custom) ...[
                  OutlinedButton.icon(
                    icon: const Icon(Icons.event),
                    label: Text(formatDateTime(end.toIso8601String())),
                    onPressed: () async {
                      final now = DateTime.now();
                      final day = await showDatePicker(context: ctx, initialDate: end, firstDate: DateTime(2020), lastDate: now);
                      if (day == null || !ctx.mounted) return;
                      final time = await showTimePicker(context: ctx, initialTime: TimeOfDay.fromDateTime(end));
                      if (time == null) return;
                      var picked = DateTime(day.year, day.month, day.day, time.hour, time.minute);
                      if (picked.isAfter(now)) picked = now;
                      setSheet(() => end = picked);
                    },
                  ),
                  const Gap(6),
                  Text('Cannot be in the future. Running timers stop at this time.', style: TextStyle(fontSize: 12, color: ctx.app.muted)),
                ] else
                  Text('The end time will be the moment you send it for review.', style: TextStyle(fontSize: 12, color: ctx.app.muted)),
              ]),
            ),
            const Gap(16),
            Row(children: [
              Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(ctx), child: const Text('Keep in progress'))),
              const SizedBox(width: 10),
              Expanded(child: FilledButton(onPressed: () => Navigator.pop(ctx, (endedAt: custom ? end : null)), child: const Text('Send for review'))),
            ]),
          ]),
        );
      }),
    );
  }

  Future<void> _moveMenu(DataController data, Task task, bool isAdmin) {
    return showSheet<void>(context, title: 'Move to', builder: (ctx) {
      return Column(children: [
        for (final c in kanbanColumns)
          ListTile(
            contentPadding: EdgeInsets.zero,
            enabled: columnFor(task) != c.id && (isAdmin || columnFor(task) != 'in_progress' || (c.id != 'to_do' && c.id != 'backlog')),
            title: Text(c.label, style: const TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text(c.id == 'done' && !isAdmin ? 'Sends the task for admin review' : c.hint),
            trailing: columnFor(task) == c.id ? Icon(Icons.check, color: ctx.cs.primary) : const Icon(Icons.arrow_forward),
            onTap: () {
              Navigator.pop(ctx);
              _requestMove(data, task, c.id, isAdmin);
            },
          ),
      ]);
    });
  }

  @override
  Widget build(BuildContext context) {
    final data = context.watch<DataController>();
    final auth = context.watch<AuthController>();
    final isAdmin = auth.isAdmin;
    final me = auth.profile!;
    final projectIds = data.projects.map((p) => p.id).toSet();
    bool isProject(Task t) => t.projectId != null && projectIds.contains(t.projectId);
    final term = _search.text.trim().toLowerCase();

    final visible = data.tasks.where((t) {
      if (!isAdmin && _projectScope && !isProject(t)) return false;
      final left = approvedTimeLeftMs(t, DateTime.now());
      if (left != null && left <= 0) return false; // approved work leaves Done after a minute
      return term.isEmpty || '${t.title} ${t.projectName ?? ''}'.toLowerCase().contains(term);
    }).toList();

    final counts = {for (final c in kanbanColumns) c.id: visible.where((t) => columnFor(t) == c.id).length};
    final inColumn = visible.where((t) => columnFor(t) == _column).toList()..sort(compareTasks);
    final paged = Paged<Task>(inColumn, _page);

    final buildTime = DateTime.now();
    // Admins see everyone's tracked time on a task; employees see their own.
    bool tracked(Task t, dynamic s) => s.taskId == t.id && (isAdmin || s.userId == me.id);
    int secondsFor(Task t) => data.sessions.where((s) => tracked(t, s)).fold<int>(0, (a, s) => a + s.seconds(buildTime));
    bool runningFor(Task t) => data.sessions.any((s) => tracked(t, s) && s.endedAt == null);
    String runnersFor(Task t) => data.sessions.where((s) => s.taskId == t.id && s.endedAt == null).map((s) => data.nameOf(s.userId)).toSet().join(', ');

    return RefreshIndicator(
      onRefresh: () => data.load(),
      child: ListView(padding: kPad, children: [
        const Gap(8),
        const Text('Board', style: TextStyle(fontSize: 27, fontWeight: FontWeight.w800, letterSpacing: -0.6)),
        Text('${visible.length} task${visible.length == 1 ? '' : 's'}', style: TextStyle(fontSize: 13, color: context.app.muted)),
        const Gap(14),
        if (!isAdmin) ...[
          Segment2<bool>(
            value: _projectScope,
            options: const [(false, 'Individual', Icons.person_outline), (true, 'Project', Icons.folder_outlined)],
            onChanged: _setScope,
          ),
          const Gap(12),
        ],
        SearchField(controller: _search, hint: 'Search the board', onChanged: (_) => setState(() => _page = 1)),
        const Gap(12),
        ChipBar<String>(
          value: _column,
          equalWidth: true,
          counts: counts,
          options: [for (final c in kanbanColumns) (c.id, c.label)],
          onChanged: (v) => setState(() {
            _column = v;
            _page = 1;
          }),
        ),
        const Gap(6),
        Text(kanbanColumns.firstWhere((c) => c.id == _column).hint, style: TextStyle(fontSize: 12, color: context.app.muted)),
        if (_error.isNotEmpty) ...[const Gap(10), Banner_(_error, onClose: () => setState(() => _error = ''))],
        const Gap(12),
        if (data.loading)
          const Loader()
        else if (paged.items.isEmpty)
          const EmptyState(icon: Icons.view_kanban_outlined, title: 'Nothing here', message: 'Move tasks between columns with the ⋯ menu on each card.')
        else
          for (final task in paged.items)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Opacity(
                opacity: _busyId == task.id ? 0.55 : 1,
                child: _BoardCard(
                  task: task,
                  isAdmin: isAdmin,
                  showKind: !isAdmin && !_projectScope,
                  isProject: isProject(task),
                  names: task.assigneeIds.map(data.nameOf).join(', '),
                  seconds: secondsFor(task),
                  running: runningFor(task),
                  runners: isAdmin ? runnersFor(task) : '',
                  mine: task.assigneeIds.contains(me.id),
                  expiry: approvedExpiry(task),
                  onExpired: () {
                    if (mounted) setState(() {});
                  },
                  onMove: () => _moveMenu(data, task, isAdmin),
                  onTimer: () async {
                    HapticFeedback.mediumImpact();
                    setState(() => _error = '');
                    try {
                      await (runningFor(task) ? data.pauseTimer(task.id) : data.startTimer(task.id));
                    } catch (e) {
                      if (mounted) setState(() => _error = errorText(e));
                    }
                  },
                ),
              ),
            ),
        PagerBar(page: paged.current, pageCount: paged.pageCount, total: paged.total, onPage: (p) => setState(() => _page = p)),
      ]),
    );
  }
}

class _BoardCard extends StatelessWidget {
  const _BoardCard({
    required this.task,
    required this.isAdmin,
    required this.showKind,
    required this.isProject,
    required this.names,
    required this.seconds,
    required this.running,
    required this.mine,
    required this.expiry,
    required this.onExpired,
    required this.onMove,
    this.runners = '',
    required this.onTimer,
  });

  final Task task;
  final bool isAdmin;
  final bool showKind;
  final bool isProject;
  final String names;
  final int seconds;
  final bool running;
  final bool mine;
  final DateTime? expiry;
  final VoidCallback onExpired;
  final VoidCallback onMove;
  final String runners;
  final VoidCallback onTimer;

  @override
  Widget build(BuildContext context) {
    final locked = task.status == 'completed' || task.status == 'submitted';
    final lane = columnFor(task);
    return AppCard(
      accent: priorityColor(task.priority),
      onTap: () => context.push('/task/${task.id}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Wrap(spacing: 6, runSpacing: 4, children: [
                PriorityPill(task.priority),
                if (task.parentTaskId != null) const Pill('Subtask', tone: Tone.neutral, icon: Icons.subdirectory_arrow_right),
                if (showKind) Pill(isProject ? 'Project' : 'Individual', tone: isProject ? Tone.primary : Tone.neutral, icon: isProject ? Icons.folder_outlined : Icons.person_outline),
                if (task.status == 'submitted') const Pill('Under review', tone: Tone.warning),
                if (const ['rejected', 'changes_requested', 'blocked'].contains(task.status)) StatusPill(task.status),
              ]),
              const Gap(8),
              Text(task.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            ]),
          ),
          if (!locked) IconButton(onPressed: onMove, icon: const Icon(Icons.more_horiz), tooltip: 'Move task'),
        ]),
        if (task.projectName != null) ...[
          const Gap(6),
          Text(task.projectName!, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: context.cs.primary)),
        ],
        const Gap(8),
        Row(children: [
          Expanded(child: Text(names.isEmpty ? 'Unassigned' : names, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: context.app.muted))),
          if (task.dueDate != null) Text(formatDate(task.dueDate), style: TextStyle(fontSize: 12, color: context.app.muted)),
        ]),
        if (expiry != null && expiry!.isAfter(DateTime.now())) ...[
          const Gap(8),
          Countdown(
            until: expiry!,
            onDone: onExpired,
            builder: (context, left) => Row(children: [
              Icon(Icons.timer_outlined, size: 14, color: context.app.success),
              const SizedBox(width: 6),
              Text('Clears in ${clock(left.inSeconds)}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: context.app.success)),
            ]),
          ),
        ],
        if (lane == 'in_progress' && isAdmin) ...[
          const Gap(10),
          Row(children: [
            Icon(Icons.timer_outlined, size: 16, color: context.cs.primary),
            const SizedBox(width: 6),
            LiveSeconds(
              base: seconds,
              running: running,
              builder: (context, s) => Text(clock(s), style: TextStyle(fontWeight: FontWeight.w800, color: context.cs.primary, fontFeatures: const [FontFeature.tabularFigures()])),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(runners.isEmpty ? 'Not running' : '$runners working',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.end,
                  style: TextStyle(fontSize: 12, fontWeight: runners.isEmpty ? FontWeight.w500 : FontWeight.w700, color: runners.isEmpty ? context.app.muted : context.app.success)),
            ),
          ]),
        ],
        if (lane == 'in_progress' && mine && !isAdmin) ...[
          const Gap(10),
          Row(children: [
            Icon(Icons.timer_outlined, size: 16, color: context.cs.primary),
            const SizedBox(width: 6),
            LiveSeconds(
              base: seconds,
              running: running,
              builder: (context, s) => Text(clock(s), style: TextStyle(fontWeight: FontWeight.w800, color: context.cs.primary, fontFeatures: const [FontFeature.tabularFigures()])),
            ),
            const Spacer(),
            running
                ? OutlinedButton.icon(
                    onPressed: onTimer,
                    icon: const Icon(Icons.pause, size: 18),
                    label: const Text('Pause'),
                    style: OutlinedButton.styleFrom(minimumSize: const Size(0, 38)))
                : FilledButton.icon(
                    onPressed: onTimer,
                    icon: const Icon(Icons.play_arrow, size: 20),
                    label: const Text('Start'),
                    style: FilledButton.styleFrom(minimumSize: const Size(0, 38))),
          ]),
        ],
      ]),
    );
  }
}
