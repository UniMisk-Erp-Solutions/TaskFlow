import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/api.dart';
import '../core/files.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../state/auth_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class FilesScreen extends StatefulWidget {
  const FilesScreen({super.key});
  @override
  State<FilesScreen> createState() => _FilesScreenState();
}

class _FilesScreenState extends State<FilesScreen> {
  final _search = TextEditingController();
  String? _folderId;
  List<Map<String, String>> _crumbs = [];
  List<DriveItem> _folders = [];
  List<DriveItem> _files = [];
  List<DriveItem>? _results;
  bool _loading = true;
  String _filter = 'all';
  bool _publicByDefault = true;
  String _busy = '';
  String _error = '';
  int _page = 1;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  List<DriveItem> _parse(dynamic list) =>
      (list as List? ?? const []).whereType<Map>().map((e) => DriveItem(Map<String, dynamic>.from(e))).toList();

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final data = await Api.instance.get('/drive', query: {if (_folderId != null) 'folder_id': _folderId});
      final map = Map<String, dynamic>.from(data as Map);
      if (!mounted) return;
      setState(() {
        _crumbs = (map['breadcrumbs'] as List? ?? const []).whereType<Map>().map((c) => {'id': '${c['id']}', 'name': '${c['name']}'}).toList();
        _folders = _parse(map['folders']);
        _files = _parse(map['files']);
        _error = '';
      });
    } catch (e) {
      if (_folderId != null && e is Exception && errorText(e).toLowerCase().contains('not found')) {
        _folderId = null;
        if (mounted) _load();
        return;
      }
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onSearch(String value) {
    _debounce?.cancel();
    final term = value.trim();
    setState(() => _page = 1);
    if (term.length < 2) {
      setState(() => _results = null);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () async {
      try {
        final data = Map<String, dynamic>.from(await Api.instance.get('/drive/search', query: {'q': term}) as Map);
        if (mounted) setState(() => _results = [..._parse(data['folders']), ..._parse(data['files'])]);
      } catch (_) {
        if (mounted) setState(() => _results = []);
      }
    });
  }

  void _enter(String? id) {
    _search.clear();
    setState(() {
      _results = null;
      _folderId = id;
      _page = 1;
    });
    _load();
  }

  Future<void> _open(DriveItem item, {bool download = false}) async {
    setState(() => _busy = '${download ? 'Downloading' : 'Opening'} ${item.name}…');
    try {
      final path = '/drive/files/${item.id}/content';
      if (download) {
        await saveFromApi(path, item.name, query: {'download': 1});
      } else {
        await openFromApi(path, item.name);
      }
      if (mounted) setState(() => _error = '');
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e, 'Could not open the file.'));
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  Future<void> _upload() async {
    final picked = await FilePicker.pickFiles();
    if (picked.isEmpty) return;
    final failures = <String>[];
    final client = Supabase.instance.client;
    for (var i = 0; i < picked.length; i++) {
      final f = picked[i];
      if (f.path == null) continue;
      setState(() => _busy = 'Uploading ${i + 1} of ${picked.length}: ${f.name}');
      try {
        final ticket = Map<String, dynamic>.from(await Api.instance.post('/drive/files/prepare', {
          'name': f.name,
          'folder_id': _folderId,
          'visibility': _publicByDefault ? 'public' : 'private',
        }) as Map);
        await client.storage.from('${ticket['bucket']}').uploadToSignedUrl('${ticket['path']}', '${ticket['token']}', File(f.path!));
        await Api.instance.post('/drive/files/complete', {
          'file_id': ticket['file_id'],
          'name': f.name,
          'folder_id': _folderId,
          'visibility': _publicByDefault ? 'public' : 'private',
        });
      } catch (e) {
        failures.add('${f.name}: ${errorText(e)}');
      }
    }
    if (!mounted) return;
    setState(() {
      _busy = '';
      _error = failures.isEmpty ? '' : 'Could not upload ${failures.length} file(s). ${failures.join(' | ')}';
    });
    await _load(silent: true);
  }

  Future<void> _newFolder() async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New folder'),
        content: TextField(controller: controller, autofocus: true, maxLength: 120, decoration: const InputDecoration(labelText: 'Folder name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: const Text('Create')),
        ],
      ),
    );
    if (name == null || name.isEmpty) return;
    try {
      await Api.instance.post('/drive/folders', {
        'name': name,
        'parent_id': _folderId,
        'visibility': _publicByDefault ? 'public' : 'private',
      });
      await _load(silent: true);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }
  }

  Future<void> _edit(DriveItem item) async {
    final name = TextEditingController(text: item.name);
    var isPublic = item.isPublic;
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) {
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Edit ${item.isFolder ? 'folder' : 'file'}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const Gap(14),
            TextField(controller: name, decoration: const InputDecoration(labelText: 'Name')),
            const Gap(14),
            const Text('Who can see this', style: TextStyle(fontWeight: FontWeight.w700)),
            const Gap(8),
            Segment2<bool>(
              value: isPublic,
              options: const [(true, 'Public', Icons.public), (false, 'Private', Icons.lock_outline)],
              onChanged: (v) => setSheet(() => isPublic = v),
            ),
            const Gap(6),
            Text(isPublic ? 'Everyone in your organization can see this.' : 'Only you can see this.', style: TextStyle(fontSize: 12, color: ctx.app.muted)),
            const Gap(16),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save changes')),
          ]),
        );
      }),
    );
    if (saved != true) return;
    final patch = <String, dynamic>{};
    if (name.text.trim().isNotEmpty && name.text.trim() != item.name) patch['name'] = name.text.trim();
    if (isPublic != item.isPublic) patch['visibility'] = isPublic ? 'public' : 'private';
    if (patch.isEmpty) return;
    try {
      await Api.instance.patch('/drive/${item.isFolder ? 'folders' : 'files'}/${item.id}', patch);
      _search.clear();
      setState(() => _results = null);
      await _load(silent: true);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }
  }

  Future<void> _delete(DriveItem item) async {
    final ok = await confirm(
      context,
      title: 'Delete ${item.isFolder ? 'folder' : 'file'}?',
      message: item.isFolder ? '"${item.name}" and everything inside it will be removed.' : '"${item.name}" will be removed.',
    );
    if (!ok) return;
    try {
      await Api.instance.delete('/drive/${item.isFolder ? 'folders' : 'files'}/${item.id}');
      setState(() => _results = null);
      await _load(silent: true);
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }
  }

  String _csv(String v) => RegExp(r'[",\n]').hasMatch(v) ? '"${v.replaceAll('"', '""')}"' : v;

  Future<void> _exportCsv(List<DriveItem> items) async {
    final rows = <List<String>>[
      ['Name', 'Type', 'Content type', 'Size (bytes)', 'Owner', 'Owner email', 'Access', 'Location', 'Created', 'Modified', 'Last accessed', 'Last accessed by', 'Times opened'],
      for (final i in items)
        [
          i.name,
          i.isFolder ? 'folder' : 'file',
          i.contentType ?? '',
          '${i.sizeBytes}',
          i.ownerName,
          '${i.details?['owner_email'] ?? ''}',
          i.isPublic ? 'public' : 'private',
          '${i.details?['location'] ?? ''}',
          formatDateTime(i.createdAt, seconds: true),
          formatDateTime('${i.details?['updated_at']}', seconds: true),
          i.details?['last_accessed_at'] == null ? '' : formatDateTime('${i.details?['last_accessed_at']}', seconds: true),
          '${i.details?['last_accessed_by'] ?? ''}',
          '${i.details?['access_count'] ?? ''}',
        ],
    ];
    final text = '﻿${rows.map((r) => r.map(_csv).join(',')).join('\r\n')}';
    try {
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/taskflow-files-${isoDate(DateTime.now())}.csv');
      await file.writeAsString(text);
      await SharePlus.instance.share(ShareParams(files: [XFile(file.path)], text: 'TaskFlow file details'));
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e, 'Could not export.'));
    }
  }

  void _properties(DriveItem item) {
    final d = item.details ?? {};
    final rows = <(String, String)>[
      ('Type', item.isFolder ? 'Folder' : (item.contentType ?? 'File')),
      if (!item.isFolder) ('Size', item.sizeBytes > 0 ? '${formatSize(item.sizeBytes)} (${item.sizeBytes} bytes)' : '—'),
      ('Location', '${d['location'] ?? '—'}'),
      ('Owner', '${item.ownerName}${d['owner_email'] != null && '${d['owner_email']}'.isNotEmpty ? ' (${d['owner_email']})' : ''}'),
      ('Access', item.isPublic ? 'Public (whole organization)' : 'Private (owner only)'),
      ('Created', formatDateTime(item.createdAt, seconds: true)),
      ('Modified', formatDateTime('${d['updated_at']}', seconds: true)),
      if (!item.isFolder)
        ('Accessed', d['last_accessed_at'] == null ? 'Never opened' : '${formatDateTime('${d['last_accessed_at']}', seconds: true)}${d['last_accessed_by'] != null ? ' by ${d['last_accessed_by']}' : ''}'),
      if (!item.isFolder) ('Times opened', '${d['access_count'] ?? 0}'),
      if (!item.isFolder) ('Storage path', '${d['storage_path'] ?? '—'}'),
    ];
    showSheet<void>(context, title: item.isFolder ? 'Folder properties' : 'File properties', builder: (ctx) {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(item.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        const Gap(12),
        for (final (label, value) in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: ctx.app.muted)),
              SelectableText(value),
            ]),
          ),
      ]);
    });
  }

  void _menu(DriveItem item, bool isAdmin) {
    showSheet<void>(context, title: item.name, builder: (ctx) {
      Widget tile(IconData icon, String label, VoidCallback onTap, {bool danger = false}) => ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(icon, color: danger ? ctx.app.danger : null),
            title: Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: danger ? ctx.app.danger : null)),
            onTap: () {
              Navigator.pop(ctx);
              onTap();
            },
          );
      return Column(children: [
        if (!item.isFolder) tile(Icons.download_outlined, 'Download', () => _open(item, download: true)),
        if (item.isOwner) tile(Icons.edit_outlined, 'Rename or change access', () => _edit(item)),
        if (item.isOwner || isAdmin) tile(Icons.history, 'History', () => context.push('/activity?itemId=${item.id}&name=${Uri.encodeComponent(item.name)}')),
        if (isAdmin && item.details != null) tile(Icons.info_outline, 'Properties', () => _properties(item)),
        if (item.isOwner || (isAdmin && item.isPublic)) tile(Icons.delete_outline, 'Delete', () => _delete(item), danger: true),
      ]);
    });
  }

  IconData _icon(DriveItem i) {
    if (i.isFolder) return Icons.folder;
    final t = i.contentType ?? '';
    if (t.startsWith('image/')) return Icons.image_outlined;
    if (t.startsWith('video/')) return Icons.movie_outlined;
    if (t.startsWith('audio/')) return Icons.music_note_outlined;
    if (t == 'application/pdf' || t.startsWith('text/')) return Icons.description_outlined;
    return Icons.insert_drive_file_outlined;
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = context.watch<AuthController>().isAdmin;
    final source = _results ?? [..._folders, ..._files];
    final items = source.where((i) => _filter == 'mine' ? i.isOwner : _filter == 'shared' ? !i.isOwner : true).toList();
    final paged = Paged<DriveItem>(items, _page);
    final parent = _crumbs.length > 1 ? _crumbs[_crumbs.length - 2]['id'] : null;

    return RefreshIndicator(
      onRefresh: () => _load(silent: true),
      child: ListView(padding: kPad, children: [
        const Gap(8),
        Row(children: [
          const Expanded(child: Text('Files', style: TextStyle(fontSize: 27, fontWeight: FontWeight.w800, letterSpacing: -0.6))),
          IconButton(onPressed: () => context.push('/activity'), icon: const Icon(Icons.history), tooltip: 'Activity log'),
          if (isAdmin) IconButton(onPressed: items.isEmpty ? null : () => _exportCsv(items), icon: const Icon(Icons.ios_share), tooltip: 'Export details'),
        ]),
        Text('Shared with your organization', style: TextStyle(fontSize: 13, color: context.app.muted)),
        const Gap(12),
        SizedBox(
          height: 40,
          child: ListView(scrollDirection: Axis.horizontal, children: [
            ActionChip(avatar: const Icon(Icons.home_outlined, size: 18), label: const Text('My files'), onPressed: () => _enter(null)),
            for (final c in _crumbs) ...[
              const SizedBox(width: 8),
              ActionChip(label: Text(c['name']!), onPressed: () => _enter(c['id'])),
            ],
          ]),
        ),
        const Gap(12),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('New items are', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: context.app.muted)),
            const Gap(8),
            Segment2<bool>(
              value: _publicByDefault,
              options: const [(true, 'Public', Icons.public), (false, 'Private', Icons.lock_outline)],
              onChanged: (v) => setState(() => _publicByDefault = v),
            ),
            const Gap(12),
            Row(children: [
              Expanded(child: FilledButton.icon(onPressed: _busy.isEmpty ? _upload : null, icon: const Icon(Icons.upload), label: const Text('Upload'))),
              const SizedBox(width: 10),
              Expanded(child: OutlinedButton.icon(onPressed: _newFolder, icon: const Icon(Icons.create_new_folder_outlined), label: const Text('New folder'))),
            ]),
            if (_busy.isNotEmpty) ...[
              const Gap(10),
              const LinearProgressIndicator(),
              const Gap(6),
              Text(_busy, style: TextStyle(fontSize: 12, color: context.app.muted)),
            ],
          ]),
        ),
        const Gap(12),
        SearchField(controller: _search, hint: 'Search files and folders', onChanged: _onSearch),
        const Gap(12),
        Segment2<String>(
          value: _filter,
          options: const [('all', 'All', null), ('mine', 'Mine', null), ('shared', 'Shared with me', null)],
          onChanged: (v) => setState(() {
            _filter = v;
            _page = 1;
          }),
        ),
        if (_error.isNotEmpty) ...[const Gap(12), Banner_(_error, onClose: () => setState(() => _error = ''))],
        const Gap(12),
        if (_loading)
          const Loader()
        else ...[
          if (_folderId != null && _results == null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: AppCard(
                padding: const EdgeInsets.all(12),
                onTap: () => _enter(parent),
                child: Row(children: [Icon(Icons.subdirectory_arrow_left, color: context.app.muted), const SizedBox(width: 10), Text('Back', style: TextStyle(color: context.app.muted, fontWeight: FontWeight.w700))]),
              ),
            ),
          if (paged.items.isEmpty)
            EmptyState(
              icon: Icons.folder_open,
              title: _results != null ? 'Nothing matches' : 'This folder is empty',
              message: _results != null ? null : 'Upload files or create a folder.',
            )
          else
            for (final item in paged.items)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppCard(
                  padding: const EdgeInsets.all(12),
                  onTap: () => item.isFolder ? _enter(item.id) : _open(item),
                  child: Row(children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: item.isFolder ? context.cs.primary.withValues(alpha: 0.12) : context.app.surfaceAlt,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(_icon(item), color: item.isFolder ? context.cs.primary : context.app.muted),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(item.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                        const Gap(4),
                        Wrap(spacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                          Pill(item.isPublic ? 'Public' : 'Private', tone: item.isPublic ? Tone.success : Tone.neutral, icon: item.isPublic ? Icons.public : Icons.lock_outline),
                          Text('${item.isOwner ? 'You' : item.ownerName}${item.isFolder ? '' : ' · ${formatSize(item.sizeBytes)}'}',
                              style: TextStyle(fontSize: 11, color: context.app.muted)),
                        ]),
                      ]),
                    ),
                    IconButton(onPressed: () => _menu(item, isAdmin), icon: const Icon(Icons.more_vert)),
                  ]),
                ),
              ),
          PagerBar(page: paged.current, pageCount: paged.pageCount, total: paged.total, onPage: (p) => setState(() => _page = p)),
        ],
      ]),
    );
  }
}
