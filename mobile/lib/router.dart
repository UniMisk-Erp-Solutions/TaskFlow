import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'screens/activity_screen.dart';
import 'screens/assistant_screen.dart';
import 'screens/board_screen.dart';
import 'screens/calendar_screen.dart';
import 'screens/chat_screen.dart';
import 'screens/files_screen.dart';
import 'screens/login_screen.dart';
import 'screens/meeting_screens.dart';
import 'screens/more_screen.dart';
import 'screens/notifications_screen.dart';
import 'screens/onboarding_screens.dart';
import 'screens/profile_screen.dart';
import 'screens/projects_screen.dart';
import 'screens/reminders_screen.dart';
import 'screens/shell.dart';
import 'screens/task_screens.dart';
import 'screens/tasks_screen.dart';
import 'screens/timer_screen.dart';
import 'screens/users_screen.dart';
import 'screens/whiteboard_screen.dart';
import 'state/auth_state.dart';

final _rootKey = GlobalKey<NavigatorState>();

GoRouter buildRouter(AuthController auth) {
  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/tasks',
    refreshListenable: auth,
    redirect: (context, state) {
      final here = state.matchedLocation;
      if (auth.loading) return here == '/splash' ? null : '/splash';
      if (!auth.isSignedIn) return here == '/login' ? null : '/login';
      final profile = auth.profile;
      // Signed in, but the profile is still loading (or failed to load): hold on the splash screen.
      if (profile == null) return here == '/splash' ? null : '/splash';
      final status = profile.status;
      if (status == 'needs_onboarding') return here == '/onboarding' ? null : '/onboarding';
      if (status == 'pending_approval' || status == 'rejected') return here == '/pending' ? null : '/pending';
      if (here == '/login' || here == '/onboarding' || here == '/pending' || here == '/splash') return '/tasks';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/onboarding', builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: '/pending', builder: (_, _) => const PendingScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AppShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/tasks', builder: (_, _) => const TasksScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/board', builder: (_, _) => const BoardScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/timer', builder: (_, _) => const TimerScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/files', builder: (_, _) => const FilesScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/more', builder: (_, _) => const MoreScreen())]),
        ],
      ),
      GoRoute(path: '/task/new', parentNavigatorKey: _rootKey, builder: (_, s) => TaskFormScreen(projectId: s.uri.queryParameters['projectId'])),
      GoRoute(path: '/task/:id', parentNavigatorKey: _rootKey, builder: (_, s) => TaskDetailScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/meeting/new', parentNavigatorKey: _rootKey, builder: (_, s) => MeetingFormScreen(date: s.uri.queryParameters['date'])),
      GoRoute(path: '/meeting/:id', parentNavigatorKey: _rootKey, builder: (_, s) => MeetingDetailScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/projects', parentNavigatorKey: _rootKey, builder: (_, _) => const ProjectsScreen()),
      GoRoute(path: '/calendar', parentNavigatorKey: _rootKey, builder: (_, _) => const CalendarScreen()),
      GoRoute(path: '/chat', parentNavigatorKey: _rootKey, builder: (_, _) => const ChatListScreen()),
      GoRoute(
        path: '/chat/:id',
        parentNavigatorKey: _rootKey,
        builder: (_, s) => ChatThreadScreen(id: s.pathParameters['id']!, title: s.uri.queryParameters['title'] ?? 'Chat'),
      ),
      GoRoute(path: '/assistant', parentNavigatorKey: _rootKey, builder: (_, _) => const AssistantScreen()),
      GoRoute(path: '/notifications', parentNavigatorKey: _rootKey, builder: (_, _) => const NotificationsScreen()),
      GoRoute(path: '/reminders', parentNavigatorKey: _rootKey, builder: (_, _) => const RemindersScreen()),
      GoRoute(path: '/users', parentNavigatorKey: _rootKey, builder: (_, _) => const UsersScreen()),
      GoRoute(path: '/profile', parentNavigatorKey: _rootKey, builder: (_, _) => const ProfileScreen()),
      GoRoute(path: '/whiteboard', parentNavigatorKey: _rootKey, builder: (_, _) => const WhiteboardScreen()),
      GoRoute(
        path: '/activity',
        parentNavigatorKey: _rootKey,
        builder: (_, s) => ActivityScreen(itemId: s.uri.queryParameters['itemId'], itemName: s.uri.queryParameters['name']),
      ),
    ],
  );
}
