import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:taskflow/core/models.dart';
import 'package:taskflow/screens/board_screen.dart';
import 'package:taskflow/screens/calendar_screen.dart';
import 'package:taskflow/screens/more_screen.dart';
import 'package:taskflow/screens/login_screen.dart';
import 'package:taskflow/screens/task_screens.dart';
import 'package:taskflow/screens/tasks_screen.dart';
import 'package:taskflow/screens/timer_screen.dart';
import 'package:taskflow/state/auth_state.dart';
import 'package:taskflow/state/data_state.dart';
import 'package:taskflow/ui/theme.dart';
import 'package:taskflow/ui/theme_mode.dart';

final me = Profile(id: 'u1', email: 'una@example.com', fullName: 'Una Admin', role: 'admin', orgId: 'o1');

DataController seeded({bool admin = true}) {
  final data = DataController(userId: 'u1', isAdmin: admin, autoStart: false);
  final now = DateTime.now();
  data.people = [me, Profile(id: 'u2', email: 'bo@example.com', fullName: 'Bo Worker', role: 'employee', orgId: 'o1')];
  data.projects = [Project({'id': 'p1', 'name': 'Website'})];
  data.tasks = [
    Task({
      'id': 't1', 'title': 'Design landing page', 'status': 'in_progress', 'kanban_column': 'in_progress', 'priority': 'high',
      'assignee_ids': ['u1'], 'project_id': 'p1', 'project_name': 'Website', 'due_date': '2026-10-01', 'created_at': '2026-10-01T10:00:00Z',
    }),
    Task({
      'id': 't2', 'title': 'Write API docs', 'status': 'pending', 'kanban_column': 'to_do', 'priority': 'medium',
      'assignee_ids': ['u1', 'u2'], 'created_at': '2026-10-02T10:00:00Z',
    }),
    Task({
      'id': 't3', 'title': 'Fix login bug', 'status': 'submitted', 'kanban_column': 'done', 'priority': 'low',
      'assignee_ids': ['u2'], 'created_at': '2026-10-03T10:00:00Z',
    }),
    Task({
      'id': 't4', 'title': 'Ship release', 'status': 'completed', 'kanban_column': 'done', 'priority': 'medium', 'assignee_ids': ['u1'],
      'kanban_approved_at': now.subtract(const Duration(seconds: 10)).toUtc().toIso8601String(),
      'work_ended_at': now.subtract(const Duration(minutes: 5)).toUtc().toIso8601String(), 'created_at': '2026-10-04T10:00:00Z',
    }),
  ];
  data.meetings = [
    Meeting({'id': 'm1', 'title': 'Sprint planning', 'status': 'scheduled', 'meeting_date': '2026-10-20', 'meeting_time': '10:00:00', 'assignee_ids': ['u1']}),
  ];
  data.sessions = [
    TimerSession(id: 's1', taskId: 't1', userId: 'u1', startedAt: now.subtract(const Duration(hours: 3)), endedAt: now.subtract(const Duration(hours: 2))),
    TimerSession(id: 's2', taskId: 't1', userId: 'u1', startedAt: now.subtract(const Duration(minutes: 10))),
    TimerSession(id: 's3', taskId: 't4', userId: 'u1', startedAt: now.subtract(const Duration(days: 2)), endedAt: now.subtract(const Duration(days: 2, minutes: -45))),
  ];
  data.loading = false;
  return data;
}

Future<void> pumpScreen(WidgetTester tester, Widget screen, {bool admin = true}) async {
  tester.view.physicalSize = const Size(411 * 2.6, 880 * 2.6);
  tester.view.devicePixelRatio = 2.6;
  addTearDown(tester.view.reset);
  final profile = admin ? me : Profile(id: 'u1', email: 'una@example.com', fullName: 'Una', role: 'employee', orgId: 'o1');
  final data = seeded(admin: admin);
  await tester.pumpWidget(MultiProvider(
    key: UniqueKey(),
    providers: [
      ChangeNotifierProvider(create: (_) => AuthController.test(profile)),
      ChangeNotifierProvider.value(value: data),
      ChangeNotifierProvider(create: (_) => ThemeController()),
    ],
    child: MaterialApp(
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      home: Scaffold(body: SafeArea(child: screen)),
    ),
  ));
  await tester.pump(const Duration(milliseconds: 300));
}

void main() {
  testWidgets('Tasks screen lists tasks, filters and stats', (tester) async {
    await pumpScreen(tester, const TasksScreen());
    expect(find.text('Design landing page'), findsOneWidget);
    expect(find.text('Write API docs'), findsOneWidget);
    expect(find.textContaining('waiting for your review'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Meetings'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Sprint planning'), findsOneWidget);
  });

  testWidgets('Board shows columns, timer and approval countdown', (tester) async {
    await pumpScreen(tester, const BoardScreen(), admin: false);
    expect(find.text('Design landing page'), findsOneWidget);
    expect(find.text('Pause'), findsOneWidget);
    await tester.tap(find.textContaining('Done'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.textContaining('Clears in'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Timer screen renders analytics and switches units', (tester) async {
    await pumpScreen(tester, const TimerScreen());
    expect(find.text('By task'), findsOneWidget);
    await tester.tap(find.text('Days'));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.text('Over time'));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.text('This week'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(tester.takeException(), isNull);
  });

  testWidgets('Calendar and More render', (tester) async {
    await pumpScreen(tester, const CalendarScreen());
    expect(tester.takeException(), isNull);
    await pumpScreen(tester, const MoreScreen());
    expect(find.text('Projects'), findsOneWidget);
    expect(find.text('Team'), findsOneWidget);
    await pumpScreen(tester, const MoreScreen(), admin: false);
    expect(find.text('Team'), findsNothing);
  });

  testWidgets('Task detail shows review actions for an admin', (tester) async {
    await pumpScreen(tester, const TaskDetailScreen(id: 't3'));
    expect(find.text('Fix login bug'), findsWidgets);
    expect(find.text('Approve'), findsOneWidget);
    expect(find.text('Reject'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Task detail lets the assignee send work for review', (tester) async {
    await pumpScreen(tester, const TaskDetailScreen(id: 't1'), admin: false);
    expect(find.text('Submit for review'), findsOneWidget);
    expect(find.text('Pause'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('New task form and login render without overflow on a narrow phone', (tester) async {
    await pumpScreen(tester, const TaskFormScreen());
    expect(find.text('Create task'), findsOneWidget);
    expect(tester.takeException(), isNull);
    tester.view.physicalSize = const Size(360 * 2.6, 640 * 2.6);
    await tester.pumpWidget(MultiProvider(
      key: UniqueKey(),
      providers: [ChangeNotifierProvider(create: (_) => AuthController.test(me))],
      child: MaterialApp(theme: buildTheme(Brightness.dark), home: const LoginScreen()),
    ));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Sign in'), findsWidgets);
    expect(tester.takeException(), isNull);
  });
}
