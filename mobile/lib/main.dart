import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/env.dart';
import 'router.dart';
import 'state/auth_state.dart';
import 'state/data_state.dart';
import 'ui/theme.dart';
import 'ui/theme_mode.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (Env.isConfigured) {
    await Supabase.initialize(url: Env.supabaseUrl, anonKey: Env.supabaseAnonKey);
  }
  final themeController = ThemeController();
  await themeController.load();
  runApp(TaskFlowApp(themeController: themeController));
}

class TaskFlowApp extends StatelessWidget {
  const TaskFlowApp({super.key, required this.themeController});
  final ThemeController themeController;

  @override
  Widget build(BuildContext context) {
    if (!Env.isConfigured) {
      return MaterialApp(
        theme: buildTheme(Brightness.light),
        home: const Scaffold(
          body: Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: Text(
                'Missing configuration.\n\nBuild with --dart-define-from-file=env.json (see env.example.json).',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      );
    }
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: themeController),
        ChangeNotifierProvider(create: (_) => AuthController()),
      ],
      child: const _App(),
    );
  }
}

class _App extends StatefulWidget {
  const _App();
  @override
  State<_App> createState() => _AppState();
}

class _AppState extends State<_App> {
  late final AuthController _auth = context.read<AuthController>();
  late final _router = buildRouter(_auth);

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeController>();
    return MaterialApp.router(
      title: 'TaskFlow',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      themeMode: theme.mode,
      routerConfig: _router,
      builder: (context, child) => _DataScope(child: child ?? const SizedBox.shrink()),
    );
  }
}

/// Creates the shared data controller while a fully set-up user is signed in.
class _DataScope extends StatelessWidget {
  const _DataScope({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final profile = auth.profile;
    if (profile == null || profile.status != 'active') return child;
    return ChangeNotifierProvider<DataController>(
      key: ValueKey(profile.id),
      create: (_) => DataController(userId: profile.id, isAdmin: profile.isAdmin),
      child: child,
    );
  }
}
