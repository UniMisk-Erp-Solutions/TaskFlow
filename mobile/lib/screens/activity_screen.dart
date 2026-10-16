import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../state/auth_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

const _actions = <String, (String, Tone)>{
  'uploaded': ('Uploaded', Tone.success),
  'created': ('Folder created', Tone.success),
  'renamed': ('Renamed', Tone.warning),
  'visibility_changed': ('Access changed', Tone.warning),
  'opened': ('Opened', Tone.primary),
  'downloaded': ('Downloaded', Tone.primary),
  'deleted': ('Deleted', Tone.danger),
};

String _describe(DriveActivity e) {
  final d = e.details;
  String vis(dynamic v) => v == 'public' ? 'Public' : 'Private';
  switch (e.action) {
    case 'renamed':
      return '"${d['from']}" → "${d['to']}"';
    case 'visibility_changed':
      return '${vis(d['from'])} → ${vis(d['to'])}';
    case 'uploaded':
      return [
        if (d['size_bytes'] != null) formatSize(d['size_bytes'] as num),
        if (d['content_type'] != null) '${d['content_type']}',
        if (d['visibility'] != null) vis(d['visibility']),
      ].join(' · ');
    case 'created':
      return d['visibility'] == null ? '' : vis(d['visibility']);
    case 'deleted':
      if (d['files_removed'] != null) return '${d['files_removed']} file(s) removed';
      if (d['with_folder'] != null) return 'with folder "${d['with_folder']}"';
      return d['size_bytes'] != null ? formatSize(d['size_bytes'] as num) : '';
    default:
      return '';
  }
}

class ActivityScreen extends StatefulWidget {
  const ActivityScreen({super.key, this.itemId, this.itemName});
  final String? itemId;
  final String? itemName;
  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  final _search = TextEditingController();
  List<DriveActivity> _rows = [];
  bool _loading = true;
  String _error = '';
  String _action = 'all';
  int _page = 1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await Api.instance.get('/drive/activity', query: {if (widget.itemId != null) 'item_id': widget.itemId});
      if (!mounted) return;
      setState(() {
        _rows = (data as List).whereType<Map>().map((e) => DriveActivity(Map<String, dynamic>.from(e))).toList();
        _error = '';
      });
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = context.watch<AuthController>().isAdmin;
    final term = _search.text.trim().toLowerCase();
    final rows = _rows.where((r) {
      final okAction = _action == 'all' || r.action == _action;
      final okTerm = term.isEmpty || '${r.itemName} ${r.actorName} ${r.details}'.toLowerCase().contains(term);
      return okAction && okTerm;
    }).toList();
    final paged = Paged<DriveActivity>(rows, _page);

    return Scaffold(
      appBar: AppBar(title: const Text('File activity')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: kPad, children: [
          if (widget.itemName != null) ...[
            AppCard(child: Text.rich(TextSpan(children: [const TextSpan(text: 'History of '), TextSpan(text: widget.itemName, style: const TextStyle(fontWeight: FontWeight.w800))]))),
            const Gap(12),
          ],
          Banner_(
            isAdmin
                ? 'You see activity on your own items and on items that are public. Private items of other people are never shown to administrators.'
                : 'You see activity on your own files and folders, including private ones.',
            tone: Tone.info,
          ),
          const Gap(12),
          SearchField(controller: _search, hint: 'Search the log', onChanged: (_) => setState(() => _page = 1)),
          const Gap(12),
          ChipBar<String>(
            value: _action,
            options: [('all', 'All'), for (final e in _actions.entries) (e.key, e.value.$1)],
            onChanged: (v) => setState(() {
              _action = v;
              _page = 1;
            }),
          ),
          if (_error.isNotEmpty) ...[const Gap(12), Banner_(_error)],
          const Gap(12),
          if (_loading)
            const Loader()
          else if (paged.items.isEmpty)
            const EmptyState(icon: Icons.history, title: 'No activity to show')
          else
            for (final e in paged.items)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppCard(
                  padding: const EdgeInsets.all(14),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Pill(_actions[e.action]?.$1 ?? e.action, tone: _actions[e.action]?.$2 ?? Tone.neutral),
                      const Spacer(),
                      Text(formatDateTime(e.createdAt, seconds: true), style: TextStyle(fontSize: 11, color: context.app.muted)),
                    ]),
                    const Gap(8),
                    Row(children: [
                      Icon(e.itemKind == 'folder' ? Icons.folder_outlined : Icons.insert_drive_file_outlined, size: 16, color: context.app.muted),
                      const SizedBox(width: 6),
                      Expanded(child: Text(e.itemName, style: const TextStyle(fontWeight: FontWeight.w700))),
                    ]),
                    const Gap(4),
                    Text('by ${e.actorName}${_describe(e).isEmpty ? '' : ' · ${_describe(e)}'}', style: TextStyle(fontSize: 12, color: context.app.muted)),
                  ]),
                ),
              ),
          PagerBar(page: paged.current, pageCount: paged.pageCount, total: paged.total, onPage: (p) => setState(() => _page = p)),
        ]),
      ),
    );
  }
}
