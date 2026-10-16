import 'package:flutter/material.dart';

import '../core/api.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  Map<String, dynamic>? _prefs;
  bool _loading = true;
  bool _busy = false;
  String _error = '';

  static const _rows = [
    ('notify_task_assigned', 'Task assignments', 'When a task is assigned to you'),
    ('notify_meeting_assigned', 'Meeting assignments', 'When you are added to a meeting'),
    ('notify_task_updates', 'Task updates', 'Status changes and reviews on your tasks'),
    ('notify_meeting_updates', 'Meeting updates', 'Changes to meetings you attend'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await Api.instance.get('/notifications/preferences');
      if (mounted) {
        setState(() {
          _prefs = Map<String, dynamic>.from(data as Map);
          _error = '';
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggle(String key, bool value) async {
    setState(() {
      _busy = true;
      _prefs = {...?_prefs, key: value};
    });
    try {
      final data = await Api.instance.patch('/notifications/preferences', {key: value});
      if (mounted) setState(() => _prefs = Map<String, dynamic>.from(data as Map));
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
      _load();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: ListView(padding: kPad, children: [
        Text('Choose which events notify you. These preferences are shared with the web app.', style: TextStyle(color: context.app.muted, fontSize: 13)),
        const Gap(14),
        if (_error.isNotEmpty) ...[Banner_(_error, onClose: () => setState(() => _error = '')), const Gap(12)],
        if (_loading)
          const Loader()
        else
          AppCard(
            padding: EdgeInsets.zero,
            child: Column(children: [
              for (var i = 0; i < _rows.length; i++) ...[
                SwitchListTile(
                  value: _prefs?[_rows[i].$1] != false,
                  onChanged: _busy ? null : (v) => _toggle(_rows[i].$1, v),
                  title: Text(_rows[i].$2, style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(_rows[i].$3),
                ),
                if (i < _rows.length - 1) const Divider(),
              ],
            ]),
          ),
      ]),
    );
  }
}
