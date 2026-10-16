import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../state/auth_state.dart';
import '../ui/theme.dart';
import '../ui/widgets.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _signUp = false;
  bool _busy = false;
  bool _obscure = true;
  String _error = '';

  Future<void> _submit() async {
    final email = _email.text.trim();
    final password = _password.text;
    if (email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Enter your email and password.');
      return;
    }
    if (_signUp && _name.text.trim().isEmpty) {
      setState(() => _error = 'Enter your name.');
      return;
    }
    if (_signUp && password.length < 6) {
      setState(() => _error = 'Use a password with at least 6 characters.');
      return;
    }
    setState(() {
      _busy = true;
      _error = '';
    });
    final auth = context.read<AuthController>();
    try {
      if (_signUp) {
        await auth.signUp(email, password, _name.text.trim());
      } else {
        await auth.signIn(email, password);
      }
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e, 'Could not sign in.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(color: context.cs.primary, borderRadius: BorderRadius.circular(24)),
                  child: Icon(Icons.bolt, size: 38, color: context.cs.onPrimary),
                ),
                const Gap(14),
                const Text('TaskFlow', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800, letterSpacing: -0.8)),
                const Gap(4),
                Text('Tasks, timers, files and teamwork in one place.',
                    textAlign: TextAlign.center, style: TextStyle(color: context.app.muted)),
                const Gap(28),
                AppCard(
                  padding: const EdgeInsets.all(20),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Segment2<bool>(
                      value: _signUp,
                      options: const [(false, 'Sign in', null), (true, 'Create account', null)],
                      onChanged: (v) => setState(() {
                        _signUp = v;
                        _error = '';
                      }),
                    ),
                    const Gap(18),
                    if (_error.isNotEmpty) ...[Banner_(_error), const Gap(14)],
                    if (_signUp) ...[
                      TextField(controller: _name, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Full name')),
                      const Gap(14),
                    ],
                    TextField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      decoration: const InputDecoration(labelText: 'Email'),
                    ),
                    const Gap(14),
                    TextField(
                      controller: _password,
                      obscureText: _obscure,
                      onSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText: 'Password',
                        suffixIcon: IconButton(
                          icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                    ),
                    const Gap(20),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4))
                          : Text(_signUp ? 'Create account' : 'Sign in'),
                    ),
                    if (_signUp) ...[
                      const Gap(12),
                      Text('After signing up you will verify your phone and create or join an organization.',
                          textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: context.app.muted)),
                    ],
                  ]),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
