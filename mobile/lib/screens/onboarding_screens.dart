import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../state/auth_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

const _countryCodes = <(String, String)>[
  ('91', 'India (+91)'),
  ('1', 'USA / Canada (+1)'),
  ('44', 'UK (+44)'),
  ('61', 'Australia (+61)'),
  ('971', 'UAE (+971)'),
  ('65', 'Singapore (+65)'),
  ('49', 'Germany (+49)'),
  ('33', 'France (+33)'),
  ('81', 'Japan (+81)'),
  ('86', 'China (+86)'),
];

/// Phone -> WhatsApp code -> create an organization or join one with its 6-digit code.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  int _step = 1;
  String _cc = '91';
  final _local = TextEditingController();
  final _code = TextEditingController();
  final _orgName = TextEditingController();
  final _orgCode = TextEditingController();
  bool _create = true;
  bool _busy = false;
  String _error = '';
  String _notice = '';
  String? _orgPreview;

  String get _phone => '$_cc${_local.text.replaceAll(RegExp(r'\D'), '')}';

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      await action();
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendOtp() => _run(() async {
        if (_local.text.replaceAll(RegExp(r'\D'), '').length < 6) throw Exception('Enter your mobile number.');
        await Api.instance.post('/auth/otp/send', {'phone': _phone});
        setState(() {
          _notice = 'We sent a 4-digit code to your WhatsApp on +$_phone.';
          _step = 2;
        });
      });

  Future<void> _verify() => _run(() async {
        if (!RegExp(r'^\d{4}$').hasMatch(_code.text)) throw Exception('Enter the 4-digit code.');
        await Api.instance.post('/auth/otp/verify', {'phone': _phone, 'code': _code.text});
        setState(() {
          _notice = '';
          _step = 3;
        });
      });

  Future<void> _lookup(String value) async {
    setState(() => _orgPreview = null);
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length != 6) return;
    try {
      final data = await Api.instance.get('/auth/org/lookup', query: {'code': digits});
      if (mounted) setState(() => _orgPreview = '${(data as Map)['name'] ?? 'this organization'}');
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e, 'No organization found with that code.'));
    }
  }

  Future<void> _finish() => _run(() async {
        if (_create && _orgName.text.trim().isEmpty) throw Exception('Enter a name for your organization.');
        final digits = _orgCode.text.replaceAll(RegExp(r'\D'), '');
        if (!_create && digits.length != 6) throw Exception('Enter the 6-digit organization code.');
        await Api.instance.post('/auth/onboarding', _create
            ? {'phone': _phone, 'mode': 'create', 'orgName': _orgName.text.trim()}
            : {'phone': _phone, 'mode': 'join', 'orgCode': digits});
        if (mounted) await context.read<AuthController>().refreshProfile();
      });

  @override
  void dispose() {
    _local.dispose();
    _code.dispose();
    _orgName.dispose();
    _orgCode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Gap(16),
            const Text('Finish setting up', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
            Text('Hi ${auth.profile?.displayName ?? 'there'}, step $_step of 3.', style: TextStyle(color: context.app.muted)),
            const Gap(20),
            AppCard(
              padding: const EdgeInsets.all(20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (_error.isNotEmpty) ...[Banner_(_error), const Gap(12)],
                if (_notice.isNotEmpty) ...[Banner_(_notice, tone: Tone.info), const Gap(12)],
                if (_step == 1) ...[
                  const Text('Your mobile number', style: TextStyle(fontWeight: FontWeight.w700)),
                  const Gap(12),
                  SelectField<String>(label: 'Country', value: _cc, options: _countryCodes, onChanged: (v) => setState(() => _cc = v)),
                  const Gap(12),
                  TextField(controller: _local, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Mobile number')),
                  const Gap(16),
                  FilledButton(onPressed: _busy ? null : _sendOtp, child: const Text('Send code on WhatsApp')),
                ],
                if (_step == 2) ...[
                  const Text('Enter the 4-digit code', style: TextStyle(fontWeight: FontWeight.w700)),
                  const Gap(12),
                  TextField(
                    controller: _code,
                    keyboardType: TextInputType.number,
                    maxLength: 4,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 26, letterSpacing: 10, fontWeight: FontWeight.w700),
                  ),
                  FilledButton(onPressed: _busy ? null : _verify, child: const Text('Verify')),
                  TextButton(onPressed: () => setState(() => _step = 1), child: const Text('Change number')),
                ],
                if (_step == 3) ...[
                  Segment2<bool>(
                    value: _create,
                    options: const [(true, 'Create organization', null), (false, 'Join with code', null)],
                    onChanged: (v) => setState(() => _create = v),
                  ),
                  const Gap(16),
                  if (_create)
                    TextField(controller: _orgName, decoration: const InputDecoration(labelText: 'Organization name'))
                  else ...[
                    TextField(
                      controller: _orgCode,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      onChanged: _lookup,
                      decoration: const InputDecoration(labelText: '6-digit organization code'),
                    ),
                    if (_orgPreview != null) Banner_('You will request to join $_orgPreview. An admin must approve you.', tone: Tone.success),
                  ],
                  const Gap(16),
                  FilledButton(onPressed: _busy ? null : _finish, child: Text(_create ? 'Create and continue' : 'Request to join')),
                ],
              ]),
            ),
            const Gap(12),
            TextButton(onPressed: () => context.read<AuthController>().signOut(), child: const Text('Sign out')),
          ]),
        ),
      ),
    );
  }
}

/// Shown while a join request waits for an admin's decision.
class PendingScreen extends StatefulWidget {
  const PendingScreen({super.key});
  @override
  State<PendingScreen> createState() => _PendingScreenState();
}

class _PendingScreenState extends State<PendingScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 20), (_) {
      final auth = context.read<AuthController>();
      if (auth.profile?.status != 'rejected') auth.refreshProfile();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final rejected = auth.profile?.status == 'rejected';
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(color: rejected ? context.app.dangerSoft : context.app.warningSoft, shape: BoxShape.circle),
                child: Icon(rejected ? Icons.cancel_outlined : Icons.hourglass_top, size: 38, color: rejected ? context.app.danger : context.app.warning),
              ),
              const Gap(20),
              Text(rejected ? 'Request declined' : 'Waiting for approval', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              const Gap(8),
              Text(
                rejected
                    ? 'The organization admin declined your request. Contact them, or sign out and try another code.'
                    : 'An admin has to approve your request. You will be let in automatically.',
                textAlign: TextAlign.center,
                style: TextStyle(color: context.app.muted),
              ),
              const Gap(20),
              if (!rejected) FilledButton.icon(onPressed: auth.refreshProfile, icon: const Icon(Icons.refresh), label: const Text('Check now')),
              TextButton(onPressed: auth.signOut, child: const Text('Sign out')),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Shown while the session and profile load, with a retry when the profile cannot be fetched.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final failed = auth.profileError && auth.profile == null && !auth.loading;
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(color: context.cs.primary, borderRadius: BorderRadius.circular(24)),
              child: Icon(Icons.bolt, size: 40, color: context.cs.onPrimary),
            ),
            const Gap(18),
            if (!failed) ...[
              const SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 2.6)),
            ] else ...[
              const Text('Could not load your profile', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              const Gap(6),
              Text('Check your connection and try again.', style: TextStyle(color: context.app.muted)),
              const Gap(16),
              FilledButton.icon(onPressed: auth.refreshProfile, icon: const Icon(Icons.refresh), label: const Text('Try again')),
              TextButton(onPressed: auth.signOut, child: const Text('Sign out')),
            ],
          ]),
        ),
      ),
    );
  }
}
