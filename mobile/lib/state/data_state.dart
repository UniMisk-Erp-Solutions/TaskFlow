import 'dart:async';
import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/api.dart';
import '../core/kanban.dart';
import '../core/models.dart';

/// Shared work data (tasks, meetings, projects, people, timers) with background refresh.
class DataController extends ChangeNotifier with WidgetsBindingObserver {
  DataController({required this.userId, required this.isAdmin, bool autoStart = true}) {
    if (!autoStart) {
      loading = false;
      return;
    }
    WidgetsBinding.instance.addObserver(this);
    load();
    _poll = Timer.periodic(const Duration(seconds: 15), (_) => load(silent: true));
    _channel = Supabase.instance.client
        .channel('taskflow-mobile-$userId')
        .onPostgresChanges(event: PostgresChangeEvent.all, schema: 'public', table: 'tasks', callback: (_) => load(silent: true))
        .onPostgresChanges(event: PostgresChangeEvent.all, schema: 'public', table: 'task_assignees', callback: (_) => load(silent: true))
        .onPostgresChanges(event: PostgresChangeEvent.all, schema: 'public', table: 'task_timer_sessions', callback: (_) => load(silent: true))
        .onPostgresChanges(event: PostgresChangeEvent.all, schema: 'public', table: 'meetings', callback: (_) => load(silent: true))
        .subscribe();
  }

  final String userId;
  final bool isAdmin;

  List<Task> tasks = [];
  List<Meeting> meetings = [];
  List<Project> projects = [];
  List<Profile> people = [];
  List<TimerSession> sessions = [];
  Map<String, String> timerNames = {};
  bool loading = true;
  bool refreshing = false;
  String error = '';

  Timer? _poll;
  RealtimeChannel? _channel;
  bool _inFlight = false;
  String _signature = '';
  bool _disposed = false;

  Map<String, String> get names {
    final map = <String, String>{...timerNames};
    for (final p in people) {
      map[p.id] = p.displayName;
    }
    return map;
  }

  String nameOf(String id) => names[id] ?? 'Member';

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) load(silent: true);
  }

  Future<void> load({bool silent = false}) async {
    if (_inFlight || _disposed) return;
    _inFlight = true;
    if (!silent) {
      refreshing = true;
      _notify();
    }
    final api = Api.instance;
    final results = await Future.wait<Object?>([
      _try(() => api.get('/tasks')),
      _try(() => api.get('/meetings')),
      _try(() => api.get('/projects')),
      _try(() => api.get('/auth/profiles')),
      _try(() => api.get('/tasks/timer-analytics')),
    ]);

    // Skip the rebuild entirely when nothing changed since the last refresh.
    final signature = results.map((r) => r == null ? '-' : jsonEncode(r)).join('|').hashCode.toString();
    final wasBusy = loading || refreshing;
    if (signature == _signature) {
      loading = false;
      refreshing = false;
      _inFlight = false;
      if (wasBusy) _notify();
      return;
    }
    _signature = signature;

    List<Map<String, dynamic>> list(Object? v) =>
        v is List ? v.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList() : <Map<String, dynamic>>[];

    var failed = false;
    if (results[0] is List) {
      tasks = list(results[0]).map(Task.new).toList();
    } else {
      failed = true;
    }
    if (results[1] is List) meetings = list(results[1]).map(Meeting.new).toList();
    if (results[2] is List) projects = list(results[2]).map(Project.new).toList();
    if (results[3] is List) people = list(results[3]).map(Profile.fromJson).toList();
    final timers = results[4];
    if (timers is Map) {
      sessions = list(timers['sessions']).map(TimerSession.fromJson).toList();
      final named = <String, String>{};
      for (final p in list(timers['people'])) {
        named['${p['id']}'] = '${p['full_name'] ?? p['email'] ?? 'Member'}';
      }
      timerNames = named;
    }
    error = failed ? 'Some data could not be loaded. Pull to refresh.' : '';
    loading = false;
    refreshing = false;
    _inFlight = false;
    _notify();
  }

  Future<Object?> _try(Future<dynamic> Function() call) async {
    try {
      return await call();
    } catch (_) {
      return null;
    }
  }

  void _replaceTask(Map<String, dynamic> json) {
    final id = '${json['id']}';
    tasks = [for (final t in tasks) if (t.id == id) t.copyWith(json) else t];
    _notify();
  }

  // ---- tasks ----
  Future<Task> createTask(Map<String, dynamic> payload) async {
    final data = Map<String, dynamic>.from(await Api.instance.post('/tasks', payload) as Map);
    final task = Task(data);
    tasks = [task, ...tasks];
    _notify();
    return task;
  }

  Future<void> updateTask(String id, Map<String, dynamic> payload) async {
    _replaceTask(Map<String, dynamic>.from(await Api.instance.patch('/tasks/$id', payload) as Map));
  }

  Future<void> updateStatus(String id, String status) async {
    final previous = taskById(id);
    if (previous != null) _replaceTask({...previous.json, 'status': status});
    try {
      _replaceTask(Map<String, dynamic>.from(await Api.instance.patch('/tasks/$id/status', {'status': status}) as Map));
    } catch (e) {
      if (previous != null) _replaceTask(previous.json);
      rethrow;
    }
  }

  Future<void> moveTask(String id, String column, double order, {DateTime? workEndedAt}) async {
    final previous = tasks.where((t) => t.id == id).cast<Task?>().firstWhere((_) => true, orElse: () => null);
    if (previous != null) {
      var status = previous.status;
      if (previous.kanbanColumn != column) {
        status = column == 'done' ? (isAdmin ? 'completed' : 'submitted') : column == 'in_progress' ? 'in_progress' : 'pending';
      }
      _replaceTask({...previous.json, 'kanban_column': column, 'kanban_order': order, 'status': status});
    }
    try {
      final data = await Api.instance.patch('/tasks/$id/board', {
        'kanban_column': column,
        'kanban_order': order,
        if (workEndedAt != null) 'work_ended_at': workEndedAt.toUtc().toIso8601String(),
      });
      _replaceTask(Map<String, dynamic>.from(data as Map));
    } catch (e) {
      if (previous != null) _replaceTask(previous.json);
      rethrow;
    }
  }

  Future<void> deleteTask(String id) async {
    await Api.instance.delete('/tasks/$id');
    tasks = tasks.where((t) => t.id != id).toList();
    _notify();
  }

  Future<void> _action(String id, String action, Map<String, dynamic> body) async {
    final data = await Api.instance.post('/tasks/$id/$action', body);
    _replaceTask(Map<String, dynamic>.from(data as Map));
  }

  Future<void> submitTask(String id, String note) => _action(id, 'submit', {'note': note});
  Future<void> approveTask(String id, String note) => _action(id, 'approve', {'note': note});
  Future<void> requestChanges(String id, String note) => _action(id, 'request-changes', {'note': note});

  // ---- meetings ----
  Future<Meeting> createMeeting(Map<String, dynamic> payload) async {
    final data = Map<String, dynamic>.from(await Api.instance.post('/meetings', payload) as Map);
    final m = Meeting(data);
    meetings = [m, ...meetings];
    _notify();
    return m;
  }

  Future<void> updateMeeting(String id, Map<String, dynamic> payload) async {
    final data = Map<String, dynamic>.from(await Api.instance.patch('/meetings/$id', payload) as Map);
    meetings = [for (final m in meetings) if (m.id == id) Meeting(data) else m];
    _notify();
  }

  Future<void> updateMeetingStatus(String id, String status) async {
    final data = Map<String, dynamic>.from(await Api.instance.patch('/meetings/$id/status', {'status': status}) as Map);
    meetings = [for (final m in meetings) if (m.id == id) Meeting(data) else m];
    _notify();
  }

  Future<void> deleteMeeting(String id) async {
    await Api.instance.delete('/meetings/$id');
    meetings = meetings.where((m) => m.id != id).toList();
    _notify();
  }

  // ---- projects ----
  Future<void> createProject(String name, String? description) async {
    await Api.instance.post('/projects', {'name': name, 'description': description});
    await load(silent: true);
  }

  Future<void> updateProject(String id, String name, String description) async {
    await Api.instance.patch('/projects/$id', {'name': name, 'description': description});
    await load(silent: true);
  }

  Future<void> deleteProject(String id) async {
    await Api.instance.delete('/projects/$id');
    await load(silent: true);
  }

  Future<void> setProjectArchived(String id, bool archived) async {
    await Api.instance.post('/projects/$id/${archived ? 'archive' : 'unarchive'}');
    await load(silent: true);
  }

  // ---- timers (optimistic: the button reacts instantly, the server catches up) ----
  Future<void> startTimer(String taskId) async {
    final temp = TimerSession(id: 'tmp-$taskId', taskId: taskId, userId: userId, startedAt: DateTime.now());
    sessions = [...sessions, temp];
    _notify();
    try {
      await Api.instance.post('/tasks/$taskId/timer/start');
    } catch (e) {
      sessions = sessions.where((s) => s.id != temp.id).toList();
      _notify();
      rethrow;
    }
    await load(silent: true);
  }

  Future<void> pauseTimer(String taskId) async {
    final before = sessions;
    final now = DateTime.now();
    sessions = [
      for (final s in sessions)
        if (s.taskId == taskId && s.userId == userId && s.endedAt == null)
          TimerSession(id: s.id, taskId: s.taskId, userId: s.userId, startedAt: s.startedAt, endedAt: now)
        else
          s,
    ];
    _notify();
    try {
      await Api.instance.post('/tasks/$taskId/timer/pause');
    } catch (e) {
      sessions = before;
      _notify();
      rethrow;
    }
    await load(silent: true);
  }

  // ---- helpers used by screens ----
  Task? taskById(String id) => tasks.where((t) => t.id == id).cast<Task?>().firstWhere((_) => true, orElse: () => null);
  Meeting? meetingById(String id) => meetings.where((m) => m.id == id).cast<Meeting?>().firstWhere((_) => true, orElse: () => null);

  List<Task> tasksIn(String column) => tasks.where((t) => columnFor(t) == column).toList()..sort(compareTasks);

  @override
  void dispose() {
    _disposed = true;
    _poll?.cancel();
    final channel = _channel;
    if (channel != null) Supabase.instance.client.removeChannel(channel);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
