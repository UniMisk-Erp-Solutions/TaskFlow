import 'dart:async';
import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/env.dart';
import '../core/format.dart';
import '../state/auth_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

SupabaseClient get _sb => Supabase.instance.client;

class _Member {
  _Member(this.id, this.name);
  final String id;
  final String name;
}

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});
  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  final _search = TextEditingController();
  List<Map<String, dynamic>> _conversations = [];
  Map<String, int> _unread = {};
  List<_Member> _members = [];
  bool _loading = true;
  String _error = '';
  RealtimeChannel? _channel;

  String get _me => context.read<AuthController>().profile!.id;

  @override
  void initState() {
    super.initState();
    _load();
    _channel = _sb
        .channel('chat-list-${DateTime.now().microsecondsSinceEpoch}')
        .onPostgresChanges(event: PostgresChangeEvent.all, schema: 'public', table: 'chat_messages', callback: (_) => _load())
        .subscribe();
  }

  @override
  void dispose() {
    final c = _channel;
    if (c != null) _sb.removeChannel(c);
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final orgId = context.read<AuthController>().profile!.orgId;
      await _sb.rpc('chat_ensure_general');
      final convs = await _sb
          .from('chat_conversations')
          .select('id, type, name, last_message_at, chat_participants(user_id)')
          .order('last_message_at', ascending: false);
      final counts = await _sb.rpc('chat_unread_counts');
      final members = await _sb.from('profiles').select('id, full_name, email').eq('org_id', orgId ?? '').order('full_name', ascending: true);
      if (!mounted) return;
      setState(() {
        _conversations = (convs as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _unread = {for (final row in (counts as List? ?? const [])) '${(row as Map)['conversation_id']}': int.tryParse('${row['unread']}') ?? 0};
        _members = (members as List).map((e) {
          final m = e as Map;
          return _Member('${m['id']}', '${m['full_name'] ?? m['email'] ?? 'Member'}');
        }).toList();
        _error = '';
      });
    } catch (e) {
      if (mounted) setState(() => _error = '$e'.replaceFirst('PostgrestException', '').trim());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _name(String id) => _members.where((m) => m.id == id).map((m) => m.name).firstOrNull ?? 'Direct message';

  String _title(Map<String, dynamic> c) {
    if (c['type'] == 'group') return '${c['name'] ?? 'General'}';
    final participants = (c['chat_participants'] as List? ?? const []).map((p) => '${(p as Map)['user_id']}');
    final peer = participants.where((id) => id != _me).firstOrNull;
    return peer == null ? 'Direct message' : _name(peer);
  }

  Future<void> _startDirect(String userId, String name) async {
    try {
      final id = await _sb.rpc('chat_get_or_create_dm', params: {'other': userId});
      if (mounted) context.push('/chat/$id?title=${Uri.encodeComponent(name)}');
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  Future<void> _newChat() async {
    final nameC = TextEditingController();
    var group = false;
    final picked = <String>{};
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setSheet) {
        final others = _members.where((m) => m.id != _me).toList();
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('New conversation', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            const Gap(12),
            Segment2<bool>(value: group, options: const [(false, 'Direct message', null), (true, 'Group', null)], onChanged: (v) => setSheet(() => group = v)),
            const Gap(12),
            Flexible(
              child: ListView(shrinkWrap: true, children: [
                if (group) ...[
                  TextField(controller: nameC, decoration: const InputDecoration(labelText: 'Group name')),
                  const Gap(8),
                ],
                for (final m in others)
                  group
                      ? CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          value: picked.contains(m.id),
                          title: Text(m.name),
                          secondary: Avatar(m.name, size: 34),
                          onChanged: (on) => setSheet(() => on == true ? picked.add(m.id) : picked.remove(m.id)),
                        )
                      : ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Avatar(m.name, size: 34),
                          title: Text(m.name),
                          onTap: () {
                            Navigator.pop(ctx);
                            _startDirect(m.id, m.name);
                          },
                        ),
              ]),
            ),
            if (group) ...[
              const Gap(8),
              FilledButton(
                onPressed: () async {
                  if (nameC.text.trim().isEmpty || picked.isEmpty) return;
                  Navigator.pop(ctx);
                  try {
                    final id = await _sb.rpc('chat_create_group', params: {'p_name': nameC.text.trim(), 'p_members': picked.toList()});
                    if (mounted) context.push('/chat/$id?title=${Uri.encodeComponent(nameC.text.trim())}');
                  } catch (e) {
                    if (mounted) setState(() => _error = '$e');
                  }
                },
                child: const Text('Create group'),
              ),
            ],
          ]),
        );
      }),
    );
    nameC.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final term = _search.text.trim().toLowerCase();
    final shown = _conversations.where((c) => _title(c).toLowerCase().contains(term)).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Chat'), actions: [IconButton(onPressed: _newChat, icon: const Icon(Icons.edit_square), tooltip: 'New conversation')]),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: kPad, children: [
          SearchField(controller: _search, hint: 'Search chats', onChanged: (_) => setState(() {})),
          if (_error.isNotEmpty) ...[const Gap(10), Banner_(_error, onClose: () => setState(() => _error = ''))],
          const Gap(12),
          if (_loading)
            const Loader()
          else if (shown.isEmpty)
            const EmptyState(icon: Icons.chat_bubble_outline, title: 'No conversations yet')
          else
            for (final c in shown)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppCard(
                  padding: const EdgeInsets.all(12),
                  onTap: () => context.push('/chat/${c['id']}?title=${Uri.encodeComponent(_title(c))}').then((_) => _load()),
                  child: Row(children: [
                    c['type'] == 'group'
                        ? Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(color: context.cs.primary.withValues(alpha: 0.12), shape: BoxShape.circle),
                            child: Icon(Icons.tag, size: 20, color: context.cs.primary),
                          )
                        : Avatar(_title(c)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(_title(c), style: const TextStyle(fontWeight: FontWeight.w700)),
                        Text(formatDateTime('${c['last_message_at']}'), style: TextStyle(fontSize: 12, color: context.app.muted)),
                      ]),
                    ),
                    if ((_unread['${c['id']}'] ?? 0) > 0) Pill('${_unread['${c['id']}']}', tone: Tone.primary),
                  ]),
                ),
              ),
        ]),
      ),
    );
  }
}

class ChatThreadScreen extends StatefulWidget {
  const ChatThreadScreen({super.key, required this.id, required this.title});
  final String id;
  final String title;
  @override
  State<ChatThreadScreen> createState() => _ChatThreadScreenState();
}

class _ChatThreadScreenState extends State<ChatThreadScreen> {
  static const _cols =
      'id, conversation_id, sender_id, body, created_at, edited_at, kind, reply_to_id, attachment_path, attachment_name, attachment_type, attachment_size';
  final _text = TextEditingController();
  final _scroll = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  Map<String, String> _names = {};
  bool _loading = true;
  bool _sending = false;
  String _error = '';
  Map<String, dynamic>? _replyTo;
  Map<String, dynamic>? _editing;
  RealtimeChannel? _channel;

  String get _me => context.read<AuthController>().profile!.id;

  @override
  void initState() {
    super.initState();
    _load();
    _channel = _sb
        .channel('chat-${widget.id}')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'chat_messages',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'conversation_id', value: widget.id),
          callback: (_) => _load(),
        )
        .subscribe();
  }

  @override
  void dispose() {
    final c = _channel;
    if (c != null) _sb.removeChannel(c);
    _text.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final rows = await _sb.from('chat_messages').select(_cols).eq('conversation_id', widget.id).order('created_at', ascending: false).limit(300);
      final list = (rows as List).map((e) => Map<String, dynamic>.from(e as Map)).toList().reversed.toList();
      final ids = list.map((m) => '${m['sender_id']}').toSet().toList();
      final names = <String, String>{..._names};
      if (ids.isNotEmpty) {
        final profiles = await _sb.from('profiles').select('id, full_name, email').inFilter('id', ids);
        for (final p in profiles as List) {
          final m = p as Map;
          names['${m['id']}'] = '${m['full_name'] ?? m['email'] ?? 'Member'}';
        }
      }
      if (!mounted) return;
      setState(() {
        _messages = list;
        _names = names;
        _loading = false;
      });
      _sb.rpc('chat_mark_read', params: {'conv': widget.id});
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent);
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = '$e';
          _loading = false;
        });
      }
    }
  }

  Future<void> _send() async {
    final body = _text.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _error = '';
    });
    try {
      if (_editing != null) {
        await _sb.from('chat_messages').update({'body': body, 'edited_at': DateTime.now().toUtc().toIso8601String()}).eq('id', _editing!['id']);
        _editing = null;
      } else {
        await _sb.from('chat_messages').insert({
          'conversation_id': widget.id,
          'org_id': context.read<AuthController>().profile!.orgId,
          'sender_id': _me,
          'body': body,
          'reply_to_id': _replyTo?['id'],
        });
        _replyTo = null;
      }
      _text.clear();
      await _load();
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _attach() async {
    final file = await FilePicker.pickFile();
    if (file == null || file.path == null) return;
    setState(() {
      _sending = true;
      _error = '';
    });
    try {
      final safe = file.name.replaceAll(RegExp(r'[^\w.\-]+'), '_');
      final path = '${widget.id}/${DateTime.now().millisecondsSinceEpoch}-$safe';
      final orgId = context.read<AuthController>().profile!.orgId;
      await _sb.storage.from(Env.chatBucket).upload(path, File(file.path!));
      await _sb.from('chat_messages').insert({
        'conversation_id': widget.id,
        'org_id': orgId,
        'sender_id': _me,
        'body': _text.text.trim(),
        'reply_to_id': _replyTo?['id'],
        'attachment_path': path,
        'attachment_name': file.name,
        'attachment_type': 'application/octet-stream',
        'attachment_size': await file.length(),
      });
      _text.clear();
      _replyTo = null;
      await _load();
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _openAttachment(Map<String, dynamic> m) async {
    try {
      final url = await _sb.storage.from(Env.chatBucket).createSignedUrl('${m['attachment_path']}', 3600);
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  void _actions(Map<String, dynamic> m) {
    final own = '${m['sender_id']}' == _me;
    showSheet<void>(context, title: 'Message', builder: (ctx) {
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
        tile(Icons.reply, 'Reply', () => setState(() {
              _replyTo = m;
              _editing = null;
            })),
        if (own && m['attachment_path'] == null)
          tile(Icons.edit_outlined, 'Edit', () {
            setState(() {
              _editing = m;
              _replyTo = null;
              _text.text = '${m['body']}';
            });
          }),
        if (own)
          tile(Icons.delete_outline, 'Delete', () async {
            try {
              await _sb.from('chat_messages').delete().eq('id', m['id']);
              await _load();
            } catch (e) {
              if (mounted) setState(() => _error = '$e');
            }
          }, danger: true),
      ]);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Column(children: [
        if (_error.isNotEmpty) Padding(padding: const EdgeInsets.all(12), child: Banner_(_error, onClose: () => setState(() => _error = ''))),
        Expanded(
          child: _loading
              ? const Loader()
              : _messages.isEmpty
                  ? Center(child: Text('No messages yet. Say hello!', style: TextStyle(color: context.app.muted)))
                  : ListView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.all(12),
                      itemCount: _messages.length,
                      itemBuilder: (context, i) => _bubble(context, _messages[i]),
                    ),
        ),
        if (_replyTo != null || _editing != null)
          Container(
            color: context.app.surfaceAlt,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Row(children: [
              Expanded(
                child: Text(
                  _editing != null
                      ? 'Editing message'
                      : 'Replying to ${_names['${_replyTo!['sender_id']}'] ?? 'Member'}: ${_replyTo!['body'] ?? _replyTo!['attachment_name'] ?? ''}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12, color: context.app.muted),
                ),
              ),
              IconButton(
                  onPressed: () => setState(() {
                        _replyTo = null;
                        _editing = null;
                        _text.clear();
                      }),
                  icon: const Icon(Icons.close, size: 18)),
            ]),
          ),
        SafeArea(
          top: false,
          child: Container(
            color: Theme.of(context).colorScheme.surface,
            padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              IconButton(onPressed: _sending ? null : _attach, icon: const Icon(Icons.attach_file)),
              Expanded(
                child: TextField(
                  controller: _text,
                  minLines: 1,
                  maxLines: 5,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(hintText: 'Message', isDense: true),
                ),
              ),
              const SizedBox(width: 6),
              IconButton.filled(
                onPressed: _sending ? null : _send,
                icon: Icon(_editing != null ? Icons.check : Icons.send, size: 20),
              ),
            ]),
          ),
        ),
      ]),
    );
  }

  Widget _bubble(BuildContext context, Map<String, dynamic> m) {
    final own = '${m['sender_id']}' == _me;
    final scheme = Theme.of(context).colorScheme;
    final fg = own ? scheme.onPrimary : scheme.onSurface;
    final reply = _messages.where((x) => x['id'] == m['reply_to_id']).firstOrNull;
    return Align(
      alignment: own ? Alignment.centerRight : Alignment.centerLeft,
      child: Column(crossAxisAlignment: own ? CrossAxisAlignment.end : CrossAxisAlignment.start, children: [
        if (!own)
          Padding(
            padding: const EdgeInsets.only(left: 6, bottom: 2),
            child: Text(_names['${m['sender_id']}'] ?? 'Member', style: TextStyle(fontSize: 11, color: context.app.muted)),
          ),
        GestureDetector(
          onLongPress: () => _actions(m),
          child: Container(
            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: own ? scheme.primary : scheme.surface,
              border: own ? null : Border.all(color: context.app.border),
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(own ? 16 : 4),
                bottomRight: Radius.circular(own ? 4 : 16),
              ),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (reply != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.only(left: 8),
                  decoration: BoxDecoration(border: Border(left: BorderSide(color: fg.withValues(alpha: 0.7), width: 3))),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_names['${reply['sender_id']}'] ?? 'Member', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: fg)),
                    Text('${reply['body'] ?? reply['attachment_name'] ?? 'Attachment'}', maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: fg)),
                  ]),
                ),
              if (m['attachment_path'] != null)
                InkWell(
                  onTap: () => _openAttachment(m),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.attach_file, size: 18, color: fg),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${m['attachment_name'] ?? 'File'}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, color: fg)),
                        Text(formatSize(m['attachment_size'] as num?), style: TextStyle(fontSize: 11, color: fg.withValues(alpha: 0.8))),
                      ]),
                    ),
                  ]),
                ),
              if ('${m['body'] ?? ''}'.isNotEmpty) Text('${m['body']}', style: TextStyle(color: fg, fontSize: 15)),
              const SizedBox(height: 2),
              Align(
                alignment: Alignment.bottomRight,
                child: Text('${formatDateTime('${m['created_at']}')}${m['edited_at'] != null ? ' · edited' : ''}',
                    style: TextStyle(fontSize: 10, color: fg.withValues(alpha: 0.75))),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}
