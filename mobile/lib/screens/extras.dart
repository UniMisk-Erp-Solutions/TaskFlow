import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:dio/dio.dart';

import '../core/api.dart';
import '../core/files.dart';
import '../core/format.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

/// Files attached to a task or meeting: list, open and upload.
class AttachmentsSection extends StatefulWidget {
  const AttachmentsSection({super.key, required this.kind, required this.itemId});
  final String kind; // 'tasks' | 'meetings'
  final String itemId;

  @override
  State<AttachmentsSection> createState() => _AttachmentsSectionState();
}

class _AttachmentsSectionState extends State<AttachmentsSection> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  bool _busy = false;
  String _error = '';

  String get _base => '/${widget.kind}/${widget.itemId}/attachments';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await Api.instance.get(_base);
      if (!mounted) return;
      setState(() {
        _items = (data as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
        _error = '';
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = errorText(e);
          _loading = false;
        });
      }
    }
  }

  Future<void> _upload() async {
    final picked = await FilePicker.pickFiles();
    if (picked.isEmpty) return;
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      for (final f in picked) {
        final path = f.path;
        if (path == null) continue;
        final form = FormData.fromMap({
          'type': 'other',
          'file': await MultipartFile.fromFile(path, filename: f.name),
        });
        await Api.instance.post(_base, form);
      }
      await _load();
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e, 'Upload failed.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _open(Map<String, dynamic> item) async {
    try {
      await openFromApi('/${widget.kind}/attachments/${item['id']}/download', '${item['original_name'] ?? 'file'}', query: {'stream': 'inline'});
    } catch (e) {
      if (mounted) toast(context, errorText(e, 'Could not open the file.'));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        const Expanded(child: SectionLabel('Attachments')),
        OutlinedButton.icon(
          onPressed: _busy ? null : _upload,
          icon: _busy ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.attach_file, size: 16),
          label: const Text('Add'),
          style: OutlinedButton.styleFrom(minimumSize: const Size(0, 36)),
        ),
      ]),
      if (_error.isNotEmpty) ...[Banner_(_error), const Gap(8)],
      if (_loading)
        const Loader()
      else if (_items.isEmpty)
        Text('No attachments.', style: TextStyle(color: context.app.muted, fontSize: 13))
      else
        for (final item in _items)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: AppCard(
              padding: const EdgeInsets.all(12),
              onTap: () => _open(item),
              child: Row(children: [
                Icon(Icons.insert_drive_file_outlined, color: context.cs.primary),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${item['original_name'] ?? 'File'}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                    Text('${formatSize(item['size_bytes'] as num?)} · ${formatDateTime('${item['created_at']}')}',
                        style: TextStyle(fontSize: 12, color: context.app.muted)),
                  ]),
                ),
                Icon(Icons.open_in_new, size: 18, color: context.app.muted),
              ]),
            ),
          ),
    ]);
  }
}

const _actionLabel = {
  'created': 'created this',
  'updated': 'edited this',
  'status_changed': 'changed the status',
  'submitted': 'submitted it for review',
  'approved': 'approved it',
  'rejected': 'rejected it',
  'changes_requested': 'requested changes',
};

const _fieldLabel = {
  'title': 'Title',
  'description': 'Description',
  'priority': 'Priority',
  'due_date': 'Due date',
  'due_time': 'Due time',
  'project_id': 'Project',
  'meeting_date': 'Date',
  'meeting_time': 'Time',
  'status': 'Status',
  'assignees': 'Assignees',
  'assignee_ids': 'Assignees',
};

String _short(dynamic v) {
  if (v == null || v == '') return '—';
  if (v is String) return v.length > 60 ? '${v.substring(0, 57)}…' : v;
  if (v is List) return v.isEmpty ? '—' : '${v.length} item(s)';
  return '$v';
}

/// Audit timeline of a task or meeting.
class TimelineSection extends StatefulWidget {
  const TimelineSection({super.key, required this.kind, required this.itemId, required this.names, required this.refreshKey});
  final String kind;
  final String itemId;
  final Map<String, String> names;
  final Object refreshKey;

  @override
  State<TimelineSection> createState() => _TimelineSectionState();
}

class _TimelineSectionState extends State<TimelineSection> {
  List<Map<String, dynamic>> _entries = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant TimelineSection old) {
    super.didUpdateWidget(old);
    if (old.refreshKey != widget.refreshKey) _load();
  }

  Future<void> _load() async {
    try {
      final data = await Api.instance.get('/${widget.kind}/${widget.itemId}/history');
      if (!mounted) return;
      setState(() {
        _entries = (data as List).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _entries = [];
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SectionLabel('Timeline'),
      if (_loading)
        const Loader()
      else if (_entries.isEmpty)
        Text('No activity recorded yet.', style: TextStyle(color: context.app.muted, fontSize: 13))
      else
        for (final e in _entries)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.only(left: 12),
            decoration: BoxDecoration(border: Border(left: BorderSide(color: context.app.border, width: 2))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text.rich(TextSpan(children: [
                TextSpan(text: widget.names['${e['actor_id']}'] ?? 'System', style: const TextStyle(fontWeight: FontWeight.w800)),
                TextSpan(text: ' ${_actionLabel['${e['action']}'] ?? e['action']}'),
              ]), style: const TextStyle(fontSize: 13)),
              Text(formatDateTime('${e['created_at']}'), style: TextStyle(fontSize: 11, color: context.app.muted)),
              if (e['changes'] is Map)
                for (final entry in (e['changes'] as Map).entries) _change(context, '${entry.key}', entry.value),
              if (e['note'] != null && '${e['note']}'.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 6),
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: context.app.surfaceAlt, borderRadius: BorderRadius.circular(8)),
                  child: Text('${e['note']}', style: const TextStyle(fontSize: 13)),
                ),
            ]),
          ),
    ]);
  }

  Widget _change(BuildContext context, String key, dynamic value) {
    final label = _fieldLabel[key] ?? key;
    final style = TextStyle(fontSize: 12, color: context.app.muted);
    if (key == 'assignees' && value is Map) {
      final added = (value['added'] as List? ?? []).map((id) => widget.names['$id'] ?? 'Member').join(', ');
      final removed = (value['removed'] as List? ?? []).map((id) => widget.names['$id'] ?? 'Member').join(', ');
      return Text('Assignees${added.isEmpty ? '' : ' · added $added'}${removed.isEmpty ? '' : ' · removed $removed'}', style: style);
    }
    if (value is Map && value.containsKey('from') && value.containsKey('to')) {
      return Text('$label: ${_short(value['from'])} → ${_short(value['to'])}', style: style);
    }
    return Text('$label: ${_short(value)}', style: style);
  }
}
