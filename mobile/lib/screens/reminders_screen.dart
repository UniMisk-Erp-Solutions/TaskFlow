import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../state/auth_state.dart';
import '../ui/widgets.dart';

class RemindersScreen extends StatefulWidget {
  const RemindersScreen({super.key});
  @override
  State<RemindersScreen> createState() => _RemindersScreenState();
}

class _RemindersScreenState extends State<RemindersScreen> {
  bool _busy = false;
  String _result = '';
  String _error = '';

  Future<void> _send() async {
    setState(() {
      _busy = true;
      _result = '';
      _error = '';
    });
    try {
      final data = await Api.instance.post('/admin/send-reminders');
      final sent = (data as Map)['sent'] ?? 0;
      setState(() => _result = '$sent reminder${sent == 1 ? '' : 's'} sent.');
    } catch (e) {
      setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAdmin = context.watch<AuthController>().isAdmin;
    return Scaffold(
      appBar: AppBar(title: const Text('Reminders')),
      body: !isAdmin
          ? const EmptyState(icon: Icons.lock_outline, title: 'Admins only', message: 'Only administrators can send reminders.')
          : ListView(padding: kPad, children: [
              AppCard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const Text('Task reminders', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                  const Gap(8),
                  const Text('Notify everyone who has tasks that are due or overdue.'),
                  const Gap(14),
                  FilledButton.icon(onPressed: _busy ? null : _send, icon: const Icon(Icons.send), label: const Text('Send reminders now')),
                ]),
              ),
              if (_result.isNotEmpty) ...[const Gap(12), Banner_(_result, tone: Tone.success)],
              if (_error.isNotEmpty) ...[const Gap(12), Banner_(_error)],
            ]),
    );
  }
}
