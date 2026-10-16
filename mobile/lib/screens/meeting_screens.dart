import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../state/auth_state.dart';
import '../state/data_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';
import 'extras.dart';

class MeetingFormScreen extends StatefulWidget {
  const MeetingFormScreen({super.key, this.date});
  final String? date;
  @override
  State<MeetingFormScreen> createState() => _MeetingFormScreenState();
}

class _MeetingFormScreenState extends State<MeetingFormScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  late List<String> _attendees = [context.read<AuthController>().profile!.id];
  late String _date = widget.date ?? '';
  String _time = '';
  String _priority = 'medium';
  String _project = '';
  bool _busy = false;
  String _error = '';

  Future<void> _save() async {
    if (_title.text.trim().isEmpty) return setState(() => _error = 'Title is required.');
    if (_date.isEmpty) return setState(() => _error = 'Pick a meeting date.');
    if (_attendees.isEmpty) return setState(() => _error = 'Select at least one attendee.');
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      final meeting = await context.read<DataController>().createMeeting({
        'title': _title.text.trim(),
        'description': _description.text.trim(),
        'assignee_ids': _attendees,
        'priority': _priority,
        'meeting_date': _date,
        'meeting_time': _time.isEmpty ? null : _time,
        'project_id': _project.isEmpty ? null : _project,
      });
      if (mounted) context.pushReplacement('/meeting/${meeting.id}');
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e, 'Could not create the meeting.'));
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
    final me = context.read<AuthController>().profile!;
    final people = data.people.isEmpty ? [(me.id, me.displayName)] : [for (final p in data.people) (p.id, p.displayName)];
    return Scaffold(
      appBar: AppBar(title: const Text('New meeting')),
      body: ListView(padding: kPad, children: [
        if (_error.isNotEmpty) ...[Banner_(_error), const Gap(12)],
        TextField(controller: _title, autofocus: true, decoration: const InputDecoration(labelText: 'Title')),
        const Gap(14),
        TextField(controller: _description, minLines: 3, maxLines: 6, decoration: const InputDecoration(labelText: 'Agenda', alignLabelWithHint: true)),
        const Gap(14),
        DateField(label: 'Date', value: _date, clearable: false, onChanged: (v) => setState(() => _date = v)),
        const Gap(14),
        TimeField(label: 'Time', value: _time, onChanged: (v) => setState(() => _time = v)),
        const Gap(14),
        MultiSelectField(label: 'Attendees', values: _attendees, options: people, onChanged: (v) => setState(() => _attendees = v)),
        const Gap(14),
        SelectField<String>(
          label: 'Project',
          value: _project,
          options: [('', 'No project'), for (final p in data.projects) (p.id, p.name)],
          onChanged: (v) => setState(() => _project = v),
        ),
        const Gap(14),
        Segment2<String>(
          value: _priority,
          options: const [('low', 'Low', null), ('medium', 'Medium', null), ('high', 'High', null)],
          onChanged: (v) => setState(() => _priority = v),
        ),
        const Gap(22),
        FilledButton(onPressed: _busy ? null : _save, child: const Text('Schedule meeting')),
      ]),
    );
  }
}

const _meetingStatuses = [
  ('scheduled', 'Scheduled'),
  ('submitted', 'Submitted'),
  ('completed', 'Completed'),
  ('changes_requested', 'Changes requested'),
  ('cancelled', 'Cancelled'),
];

class MeetingDetailScreen extends StatefulWidget {
  const MeetingDetailScreen({super.key, required this.id});
  final String id;
  @override
  State<MeetingDetailScreen> createState() => _MeetingDetailScreenState();
}

class _MeetingDetailScreenState extends State<MeetingDetailScreen> {
  Meeting? _fetched;
  String _error = '';
  String _busy = '';
  bool _editing = false;
  Object _timelineKey = 0;
  final _note = TextEditingController();
  final _title = TextEditingController();
  final _description = TextEditingController();
  List<String> _attendees = [];
  String _date = '';
  String _time = '';

  @override
  void initState() {
    super.initState();
    if (context.read<DataController>().meetingById(widget.id) == null) {
      Api.instance.get('/meetings/${widget.id}').then((json) {
        if (mounted) setState(() => _fetched = Meeting(Map<String, dynamic>.from(json as Map)));
      }).catchError((Object e) {
        if (mounted) setState(() => _error = errorText(e, 'Meeting not found.'));
      });
    }
  }

  @override
  void dispose() {
    _note.dispose();
    _title.dispose();
    _description.dispose();
    super.dispose();
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
    final me = context.watch<AuthController>().profile!;
    final meeting = data.meetingById(widget.id) ?? _fetched;
    if (meeting == null) {
      return Scaffold(appBar: AppBar(title: const Text('Meeting')), body: _error.isEmpty ? const Loader() : Padding(padding: const EdgeInsets.all(16), child: Banner_(_error)));
    }
    final isAdmin = me.isAdmin;
    final mine = meeting.assigneeIds.contains(me.id);
    final attendees = meeting.assigneeIds.map(data.nameOf).join(', ');

    Future<void> post(String action) async {
      await Api.instance.post('/meetings/${meeting.id}/$action', {'note': _note.text.trim()});
      await data.load(silent: true);
    }

    return Scaffold(
      appBar: AppBar(title: Text(_editing ? 'Edit meeting' : 'Meeting')),
      body: ListView(padding: kPad, children: [
        if (_error.isNotEmpty) ...[Banner_(_error, onClose: () => setState(() => _error = '')), const Gap(12)],
        if (_editing)
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              TextField(controller: _title, decoration: const InputDecoration(labelText: 'Title')),
              const Gap(14),
              TextField(controller: _description, minLines: 3, maxLines: 6, decoration: const InputDecoration(labelText: 'Agenda', alignLabelWithHint: true)),
              const Gap(14),
              DateField(label: 'Date', value: _date, clearable: false, onChanged: (v) => setState(() => _date = v)),
              const Gap(14),
              TimeField(label: 'Time', value: _time, onChanged: (v) => setState(() => _time = v)),
              const Gap(14),
              MultiSelectField(
                label: 'Attendees',
                values: _attendees,
                options: [for (final p in data.people) (p.id, p.displayName)],
                onChanged: (v) => _attendees = v,
              ),
              const Gap(16),
              Row(children: [
                FilledButton(
                  onPressed: _busy == 'save'
                      ? null
                      : () => _run('save', () => data.updateMeeting(meeting.id, {
                            'title': _title.text.trim(),
                            'description': _description.text.trim(),
                            'meeting_date': _date,
                            'meeting_time': _time.isEmpty ? null : _time,
                            'assignee_ids': _attendees,
                          }), after: () => setState(() => _editing = false)),
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
              Text(meeting.title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              const Gap(10),
              Row(children: [StatusPill(meeting.status), const SizedBox(width: 8), PriorityPill(meeting.priority)]),
              if ((meeting.description ?? '').isNotEmpty) ...[
                const Gap(12),
                Text(meeting.description!, style: TextStyle(color: context.app.muted, height: 1.45)),
              ],
              const Gap(14),
              Row(children: [
                Icon(Icons.event_outlined, size: 18, color: context.app.muted),
                const SizedBox(width: 8),
                Text('${formatDate(meeting.date).isEmpty ? 'No date' : formatDate(meeting.date)}${meeting.time != null ? ' · ${formatTime12(meeting.time)}' : ''}'),
              ]),
              const Gap(8),
              Row(children: [
                Icon(Icons.group_outlined, size: 18, color: context.app.muted),
                const SizedBox(width: 8),
                Expanded(child: Text(attendees.isEmpty ? 'No attendees' : attendees)),
              ]),
              if (meeting.projectName != null) ...[
                const Gap(8),
                Row(children: [
                  Icon(Icons.folder_outlined, size: 18, color: context.cs.primary),
                  const SizedBox(width: 8),
                  Text(meeting.projectName!, style: TextStyle(color: context.cs.primary, fontWeight: FontWeight.w700)),
                ]),
              ],
              if (isAdmin) ...[
                const Gap(14),
                OutlinedButton.icon(
                  onPressed: () {
                    _title.text = meeting.title;
                    _description.text = meeting.description ?? '';
                    _attendees = [...meeting.assigneeIds];
                    _date = (meeting.date ?? '').length >= 10 ? meeting.date!.substring(0, 10) : '';
                    _time = (meeting.time ?? '').length >= 5 ? meeting.time!.substring(0, 5) : '';
                    setState(() => _editing = true);
                  },
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: const Text('Edit meeting'),
                  style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40)),
                ),
              ],
            ]),
          ),
        if (!_editing && (isAdmin || mine)) ...[
          const Gap(12),
          AppCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              SelectField<String>(
                label: 'Status',
                value: meeting.status,
                options: _meetingStatuses,
                onChanged: (next) {
                  if (next != meeting.status) _run('status', () => data.updateMeetingStatus(meeting.id, next));
                },
              ),
              const Gap(14),
              TextField(controller: _note, minLines: 2, maxLines: 4, decoration: const InputDecoration(hintText: 'Note (required when requesting changes)')),
              const Gap(12),
              Wrap(spacing: 8, runSpacing: 8, children: [
                if (mine && const ['scheduled', 'changes_requested'].contains(meeting.status))
                  FilledButton.icon(
                    onPressed: _busy == 'submit' ? null : () => _run('submit', () => post('submit'), after: _note.clear),
                    icon: const Icon(Icons.send, size: 18),
                    label: const Text('Submit'),
                  ),
                if (isAdmin && meeting.status == 'submitted') ...[
                  FilledButton.icon(
                    onPressed: _busy == 'approve' ? null : () => _run('approve', () => post('approve'), after: _note.clear),
                    icon: const Icon(Icons.check),
                    label: const Text('Approve'),
                  ),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: context.app.danger),
                    onPressed: _busy == 'changes'
                        ? null
                        : () {
                            if (_note.text.trim().isEmpty) {
                              setState(() => _error = 'Add a note describing the changes.');
                              return;
                            }
                            _run('changes', () => post('request-changes'), after: _note.clear);
                          },
                    icon: const Icon(Icons.close),
                    label: const Text('Request changes'),
                  ),
                ],
              ]),
            ]),
          ),
        ],
        const Gap(18),
        AttachmentsSection(kind: 'meetings', itemId: meeting.id),
        const Gap(18),
        TimelineSection(kind: 'meetings', itemId: meeting.id, names: data.names, refreshKey: _timelineKey),
        if (isAdmin && !_editing) ...[
          const Gap(24),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(foregroundColor: context.app.danger),
            onPressed: () async {
              if (!await confirm(context, title: 'Delete meeting?', message: 'This cannot be undone.')) return;
              await _run('delete', () => data.deleteMeeting(meeting.id), after: () {
                if (mounted) context.pop();
              });
            },
            icon: const Icon(Icons.delete_outline),
            label: const Text('Delete meeting'),
          ),
        ],
      ]),
    );
  }
}
