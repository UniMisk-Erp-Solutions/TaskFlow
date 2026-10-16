import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../state/auth_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});
  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  final _search = TextEditingController();
  List<Map<String, dynamic>> _users = [];
  List<Map<String, dynamic>> _requests = [];
  bool _loading = true;
  String _error = '';

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

  List<Map<String, dynamic>> _maps(dynamic v) => (v as List? ?? const []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();

  Future<void> _load() async {
    try {
      final users = await Api.instance.get('/admin/users');
      List<Map<String, dynamic>> requests = [];
      try {
        requests = _maps(await Api.instance.get('/admin/join-requests'));
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _users = _maps(users);
        _requests = requests;
        _error = '';
      });
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _run(Future<dynamic> Function() action) async {
    try {
      await action();
      await _load();
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }
  }

  Future<void> _createDialog() async {
    final name = TextEditingController();
    final email = TextEditingController();
    final phone = TextEditingController();
    final password = TextEditingController();
    var admin = false;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setD) {
        return AlertDialog(
          title: const Text('Add a person'),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(controller: name, decoration: const InputDecoration(labelText: 'Full name')),
              const Gap(10),
              TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
              const Gap(10),
              TextField(controller: phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone (with country code)')),
              const Gap(10),
              TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Temporary password')),
              const Gap(10),
              Segment2<bool>(value: admin, options: const [(false, 'Employee', null), (true, 'Admin', null)], onChanged: (v) => setD(() => admin = v)),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Create')),
          ],
        );
      }),
    );
    if (ok == true) {
      if (name.text.trim().isEmpty || email.text.trim().isEmpty || password.text.isEmpty) {
        setState(() => _error = 'Name, email and password are required.');
        return;
      }
      await _run(() => Api.instance.post('/admin/users', {
            'email': email.text.trim(),
            'password': password.text,
            'fullName': name.text.trim(),
            'role': admin ? 'admin' : 'employee',
            if (phone.text.trim().isNotEmpty) 'phone': phone.text.trim(),
          }));
    }
  }

  Future<void> _editDialog(Map<String, dynamic> user) async {
    final name = TextEditingController(text: '${user['full_name'] ?? ''}');
    final phone = TextEditingController(text: '${user['phone'] ?? ''}');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Edit person'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: name, decoration: const InputDecoration(labelText: 'Full name')),
          const Gap(10),
          TextField(controller: phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
        ],
      ),
    );
    if (ok == true) {
      await _run(() => Api.instance.patch('/admin/users/${user['id']}', {'fullName': name.text.trim(), 'phone': phone.text.trim()}));
    }
  }

  Future<void> _passwordDialog(Map<String, dynamic> user) async {
    final password = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Set a new password'),
        content: TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'New password')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Set password')),
        ],
      ),
    );
    if (ok == true) {
      if (password.text.length < 6) {
        setState(() => _error = 'Use at least 6 characters.');
        return;
      }
      await _run(() => Api.instance.post('/admin/users/${user['id']}/password', {'password': password.text}));
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final term = _search.text.trim().toLowerCase();
    final shown = _users.where((u) => '${u['full_name'] ?? ''} ${u['email'] ?? ''}'.toLowerCase().contains(term)).toList();
    final pending = _requests.where((r) => r['status'] == 'pending').toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Team'), actions: [IconButton(onPressed: _createDialog, icon: const Icon(Icons.person_add_alt), tooltip: 'Add a person')]),
      body: !auth.isAdmin
          ? const EmptyState(icon: Icons.lock_outline, title: 'Admins only', message: 'Only administrators can manage the team.')
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(padding: kPad, children: [
                SearchField(controller: _search, hint: 'Search people', onChanged: (_) => setState(() {})),
                if (_error.isNotEmpty) ...[const Gap(10), Banner_(_error, onClose: () => setState(() => _error = ''))],
                if (pending.isNotEmpty) ...[
                  const Gap(14),
                  SectionLabel('Join requests (${pending.length})'),
                  for (final r in pending)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: AppCard(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${(r['profile'] as Map?)?['full_name'] ?? (r['profile'] as Map?)?['email'] ?? 'Person'}', style: const TextStyle(fontWeight: FontWeight.w700)),
                          Text('${(r['profile'] as Map?)?['email'] ?? ''}', style: TextStyle(fontSize: 12, color: context.app.muted)),
                          const Gap(10),
                          Row(children: [
                            FilledButton(
                              onPressed: () => _run(() => Api.instance.post('/admin/join-requests/${r['id']}/approve')),
                              style: FilledButton.styleFrom(minimumSize: const Size(0, 38)),
                              child: const Text('Approve'),
                            ),
                            const SizedBox(width: 8),
                            OutlinedButton(
                              onPressed: () => _run(() => Api.instance.post('/admin/join-requests/${r['id']}/reject')),
                              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 38)),
                              child: const Text('Reject'),
                            ),
                          ]),
                        ]),
                      ),
                    ),
                ],
                const Gap(14),
                if (_loading)
                  const Loader()
                else
                  for (final u in shown)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: AppCard(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Avatar('${u['full_name'] ?? u['email']}'),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text('${u['full_name'] ?? u['email']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                                Text('${u['email'] ?? ''}${u['phone'] != null ? ' · ${u['phone']}' : ''}',
                                    maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: context.app.muted)),
                              ]),
                            ),
                            Pill(u['role'] == 'admin' ? 'Admin' : 'Employee', tone: u['role'] == 'admin' ? Tone.primary : Tone.neutral),
                          ]),
                          const Gap(10),
                          Wrap(spacing: 8, runSpacing: 6, children: [
                            OutlinedButton.icon(onPressed: () => _editDialog(u), icon: const Icon(Icons.edit_outlined, size: 16), label: const Text('Edit'), style: OutlinedButton.styleFrom(minimumSize: const Size(0, 36))),
                            OutlinedButton.icon(onPressed: () => _passwordDialog(u), icon: const Icon(Icons.key, size: 16), label: const Text('Password'), style: OutlinedButton.styleFrom(minimumSize: const Size(0, 36))),
                            if ('${u['id']}' != auth.profile?.id)
                              TextButton.icon(
                                onPressed: () async {
                                  final ok = await confirm(context,
                                      title: 'Remove user?', message: '${u['full_name'] ?? u['email']} will lose access.', action: 'Remove');
                                  if (ok) _run(() => Api.instance.delete('/admin/users/${u['id']}'));
                                },
                                icon: Icon(Icons.delete_outline, size: 16, color: context.app.danger),
                                label: Text('Remove', style: TextStyle(color: context.app.danger)),
                              ),
                          ]),
                        ]),
                      ),
                    ),
              ]),
            ),
    );
  }
}
