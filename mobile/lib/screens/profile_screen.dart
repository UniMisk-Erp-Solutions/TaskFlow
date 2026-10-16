import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../state/auth_state.dart';
import '../ui/theme.dart';
import '../ui/theme_mode.dart';
import '../ui/widgets.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late final _name = TextEditingController(text: context.read<AuthController>().profile?.fullName ?? '');
  late final _phone = TextEditingController(text: context.read<AuthController>().profile?.phone ?? '');
  bool _saving = false;
  String _message = '';
  bool _ok = true;

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      setState(() {
        _ok = false;
        _message = 'Your name cannot be empty.';
      });
      return;
    }
    setState(() {
      _saving = true;
      _message = '';
    });
    try {
      await Api.instance.patch('/auth/me', {'fullName': _name.text.trim(), 'phone': _phone.text.trim()});
      if (mounted) await context.read<AuthController>().refreshProfile();
      setState(() {
        _ok = true;
        _message = 'Your profile was updated.';
      });
    } catch (e) {
      setState(() {
        _ok = false;
        _message = errorText(e, 'Could not update your profile.');
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final theme = context.watch<ThemeController>();
    final profile = auth.profile!;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(padding: kPad, children: [
        AppCard(
          child: Column(children: [
            Avatar(profile.displayName, size: 76),
            const Gap(12),
            Text(profile.displayName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            Text(profile.email, style: TextStyle(color: context.app.muted)),
            const Gap(10),
            Pill(profile.isAdmin ? 'Administrator' : 'Employee', tone: Tone.primary),
            if (profile.isAdmin && profile.orgCode != null) ...[
              const Gap(12),
              Text('Organization code', style: TextStyle(fontSize: 12, color: context.app.muted)),
              SelectableText(profile.orgCode!, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: 4)),
            ],
          ]),
        ),
        const Gap(12),
        if (_message.isNotEmpty) ...[Banner_(_message, tone: _ok ? Tone.success : Tone.danger, onClose: () => setState(() => _message = '')), const Gap(12)],
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            TextField(controller: _name, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Full name')),
            const Gap(14),
            TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Mobile number')),
            const Gap(16),
            FilledButton(onPressed: _saving ? null : _save, child: const Text('Save changes')),
          ]),
        ),
        const Gap(12),
        AppCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Appearance', style: TextStyle(fontWeight: FontWeight.w800)),
            const Gap(10),
            Segment2<ThemeMode>(
              value: theme.mode,
              options: const [
                (ThemeMode.system, 'System', Icons.smartphone),
                (ThemeMode.light, 'Light', Icons.light_mode_outlined),
                (ThemeMode.dark, 'Dark', Icons.dark_mode_outlined),
              ],
              onChanged: theme.set,
            ),
          ]),
        ),
        const Gap(16),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(foregroundColor: context.app.danger),
          onPressed: () async {
            if (await confirm(context, title: 'Sign out?', message: 'You will need to sign in again.', action: 'Sign out')) {
              await auth.signOut();
            }
          },
          icon: const Icon(Icons.logout),
          label: const Text('Sign out'),
        ),
      ]),
    );
  }
}
